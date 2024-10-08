from collections.abc import Callable
from collections.abc import Iterator
from typing import cast

from sqlalchemy.orm import Session

from enmedd.chat.chat_utils import reorganize_citations
from enmedd.chat.models import AnswerPiece
from enmedd.chat.models import CitationInfo
from enmedd.chat.models import EnmeddContexts
from enmedd.chat.models import EnmeddQuotes
from enmedd.chat.models import LLMRelevanceFilterResponse
from enmedd.chat.models import QADocsResponse
from enmedd.chat.models import StreamingError
from enmedd.configs.chat_configs import MAX_CHUNKS_FED_TO_CHAT
from enmedd.configs.chat_configs import QA_TIMEOUT
from enmedd.configs.constants import MessageType
from enmedd.db.assistant import get_prompt_by_id
from enmedd.db.chat import create_chat_session
from enmedd.db.chat import create_db_search_doc
from enmedd.db.chat import create_new_chat_message
from enmedd.db.chat import get_or_create_root_message
from enmedd.db.chat import translate_db_message_to_chat_message_detail
from enmedd.db.chat import translate_db_search_doc_to_server_search_doc
from enmedd.db.engine import get_session_context_manager
from enmedd.db.models import User
from enmedd.llm.answering.answer import Answer
from enmedd.llm.answering.models import AnswerStyleConfig
from enmedd.llm.answering.models import CitationConfig
from enmedd.llm.answering.models import DocumentPruningConfig
from enmedd.llm.answering.models import PromptConfig
from enmedd.llm.answering.models import QuotesConfig
from enmedd.llm.factory import get_llms_for_assistant
from enmedd.llm.factory import get_main_llm_from_tuple
from enmedd.llm.utils import get_default_llm_token_encode
from enmedd.one_shot_answer.models import DirectQARequest
from enmedd.one_shot_answer.models import OneShotQAResponse
from enmedd.one_shot_answer.models import QueryRephrase
from enmedd.one_shot_answer.qa_utils import combine_message_thread
from enmedd.search.models import RerankMetricsContainer
from enmedd.search.models import RetrievalMetricsContainer
from enmedd.search.utils import chunks_or_sections_to_search_docs
from enmedd.search.utils import dedupe_documents
from enmedd.search.utils import drop_llm_indices
from enmedd.secondary_llm_flows.answer_validation import get_answer_validity
from enmedd.secondary_llm_flows.query_expansion import thread_based_query_rephrase
from enmedd.server.query_and_chat.models import ChatMessageDetail
from enmedd.server.utils import get_json_line
from enmedd.tools.force import ForceUseTool
from enmedd.tools.search.search_tool import SEARCH_DOC_CONTENT_ID
from enmedd.tools.search.search_tool import SEARCH_RESPONSE_SUMMARY_ID
from enmedd.tools.search.search_tool import SearchResponseSummary
from enmedd.tools.search.search_tool import SearchTool
from enmedd.tools.search.search_tool import SECTION_RELEVANCE_LIST_ID
from enmedd.tools.tool import ToolResponse
from enmedd.tools.tool_runner import ToolCallKickoff
from enmedd.utils.logger import setup_logger
from enmedd.utils.timing import log_generator_function_time

logger = setup_logger()

AnswerObjectIterator = Iterator[
    QueryRephrase
    | QADocsResponse
    | LLMRelevanceFilterResponse
    | AnswerPiece
    | EnmeddQuotes
    | EnmeddContexts
    | StreamingError
    | ChatMessageDetail
    | CitationInfo
    | ToolCallKickoff
]


def stream_answer_objects(
    query_req: DirectQARequest,
    user: User | None,
    # These need to be passed in because in Web UI one shot flow,
    # we can have much more document as there is no history.
    # For Slack flow, we need to save more tokens for the thread context
    max_document_tokens: int | None,
    max_history_tokens: int | None,
    db_session: Session,
    # Needed to translate assistant num_chunks to tokens to the LLM
    default_num_chunks: float = MAX_CHUNKS_FED_TO_CHAT,
    timeout: int = QA_TIMEOUT,
    bypass_acl: bool = False,
    use_citations: bool = False,
    retrieval_metrics_callback: Callable[[RetrievalMetricsContainer], None]
    | None = None,
    rerank_metrics_callback: Callable[[RerankMetricsContainer], None] | None = None,
) -> AnswerObjectIterator:
    """Streams in order:
    1. [always] Retrieved documents, stops flow if nothing is found
    2. [conditional] LLM selected chunk indices if LLM chunk filtering is turned on
    3. [always] A set of streamed AnswerPiece and EnmeddQuotes at the end
                or an error anywhere along the line if something fails
    4. [always] Details on the final AI response message that is created
    """
    user_id = user.id if user is not None else None
    query_msg = query_req.messages[-1]
    history = query_req.messages[:-1]

    chat_session = create_chat_session(
        db_session=db_session,
        description="",  # One shot queries don't need naming as it's never displayed
        user_id=user_id,
        assistant_id=query_req.assistant_id,
        one_shot=True,
    )

    llm_tokenizer = get_default_llm_token_encode()

    # Create a chat session which will just store the root message, the query, and the AI response
    root_message = get_or_create_root_message(
        chat_session_id=chat_session.id, db_session=db_session
    )

    history_str = combine_message_thread(
        messages=history, max_tokens=max_history_tokens
    )

    rephrased_query = thread_based_query_rephrase(
        user_query=query_msg.message,
        history_str=history_str,
    )
    # Given back ahead of the documents for latency reasons
    # In chat flow it's given back along with the documents
    yield QueryRephrase(rephrased_query=rephrased_query)

    prompt = None
    if query_req.prompt_id is not None:
        # NOTE: let the user access any prompt as long as the Assistant is shared
        # with them
        prompt = get_prompt_by_id(
            prompt_id=query_req.prompt_id, user=None, db_session=db_session
        )
    if prompt is None:
        if not chat_session.assistant.prompts:
            raise RuntimeError(
                "Assistant does not have any prompts - this should never happen"
            )
        prompt = chat_session.assistant.prompts[0]

    # Create the first User query message
    new_user_message = create_new_chat_message(
        chat_session_id=chat_session.id,
        parent_message=root_message,
        prompt_id=query_req.prompt_id,
        message=query_msg.message,
        token_count=len(llm_tokenizer(query_msg.message)),
        message_type=MessageType.USER,
        db_session=db_session,
        commit=True,
    )

    llm, fast_llm = get_llms_for_assistant(assistant=chat_session.assistant)
    prompt_config = PromptConfig.from_model(prompt)
    document_pruning_config = DocumentPruningConfig(
        max_chunks=int(
            chat_session.assistant.num_chunks
            if chat_session.assistant.num_chunks is not None
            else default_num_chunks
        ),
        max_tokens=max_document_tokens,
        use_sections=query_req.chunks_above > 0 or query_req.chunks_below > 0,
    )
    search_tool = SearchTool(
        db_session=db_session,
        user=user,
        assistant=chat_session.assistant,
        retrieval_options=query_req.retrieval_options,
        prompt_config=prompt_config,
        llm=llm,
        fast_llm=fast_llm,
        pruning_config=document_pruning_config,
        bypass_acl=bypass_acl,
    )

    answer_config = AnswerStyleConfig(
        citation_config=CitationConfig() if use_citations else None,
        quotes_config=QuotesConfig() if not use_citations else None,
        document_pruning_config=document_pruning_config,
    )
    answer = Answer(
        question=query_msg.message,
        answer_style_config=answer_config,
        prompt_config=PromptConfig.from_model(prompt),
        llm=get_main_llm_from_tuple(
            get_llms_for_assistant(assistant=chat_session.assistant)
        ),
        single_message_history=history_str,
        tools=[search_tool],
        force_use_tool=ForceUseTool(
            tool_name=search_tool.name(),
            args={"query": rephrased_query},
        ),
        # for now, don't use tool calling for this flow, as we haven't
        # tested quotes with tool calling too much yet
        skip_explicit_tool_calling=True,
        return_contexts=query_req.return_contexts,
    )
    # won't be any ImageGenerationDisplay responses since that tool is never passed in
    dropped_inds: list[int] = []
    for packet in cast(AnswerObjectIterator, answer.processed_streamed_output):
        # for one-shot flow, don't currently do anything with these
        if isinstance(packet, ToolResponse):
            if packet.id == SEARCH_RESPONSE_SUMMARY_ID:
                search_response_summary = cast(SearchResponseSummary, packet.response)

                top_docs = chunks_or_sections_to_search_docs(
                    search_response_summary.top_sections
                )

                # Deduping happens at the last step to avoid harming quality by dropping content early on
                deduped_docs = top_docs
                if query_req.retrieval_options.dedupe_docs:
                    deduped_docs, dropped_inds = dedupe_documents(top_docs)

                reference_db_search_docs = [
                    create_db_search_doc(server_search_doc=doc, db_session=db_session)
                    for doc in deduped_docs
                ]

                response_docs = [
                    translate_db_search_doc_to_server_search_doc(db_search_doc)
                    for db_search_doc in reference_db_search_docs
                ]

                initial_response = QADocsResponse(
                    rephrased_query=rephrased_query,
                    top_documents=response_docs,
                    predicted_flow=search_response_summary.predicted_flow,
                    predicted_search=search_response_summary.predicted_search,
                    applied_source_filters=search_response_summary.final_filters.source_type,
                    applied_time_cutoff=search_response_summary.final_filters.time_cutoff,
                    recency_bias_multiplier=search_response_summary.recency_bias_multiplier,
                )
                yield initial_response
            elif packet.id == SECTION_RELEVANCE_LIST_ID:
                chunk_indices = packet.response

                if reference_db_search_docs is not None and dropped_inds:
                    chunk_indices = drop_llm_indices(
                        llm_indices=chunk_indices,
                        search_docs=reference_db_search_docs,
                        dropped_indices=dropped_inds,
                    )

                yield LLMRelevanceFilterResponse(relevant_chunk_indices=packet.response)
            elif packet.id == SEARCH_DOC_CONTENT_ID:
                yield packet.response
        else:
            yield packet

    # Saving Gen AI answer and responding with message info
    gen_ai_response_message = create_new_chat_message(
        chat_session_id=chat_session.id,
        parent_message=new_user_message,
        prompt_id=query_req.prompt_id,
        message=answer.llm_answer,
        token_count=len(llm_tokenizer(answer.llm_answer)),
        message_type=MessageType.ASSISTANT,
        error=None,
        reference_docs=reference_db_search_docs,
        db_session=db_session,
        commit=True,
    )

    msg_detail_response = translate_db_message_to_chat_message_detail(
        gen_ai_response_message
    )

    yield msg_detail_response


@log_generator_function_time()
def stream_search_answer(
    query_req: DirectQARequest,
    user: User | None,
    max_document_tokens: int | None,
    max_history_tokens: int | None,
) -> Iterator[str]:
    with get_session_context_manager() as session:
        objects = stream_answer_objects(
            query_req=query_req,
            user=user,
            max_document_tokens=max_document_tokens,
            max_history_tokens=max_history_tokens,
            db_session=session,
        )
        for obj in objects:
            yield get_json_line(obj.dict())


def get_search_answer(
    query_req: DirectQARequest,
    user: User | None,
    max_document_tokens: int | None,
    max_history_tokens: int | None,
    db_session: Session,
    answer_generation_timeout: int = QA_TIMEOUT,
    enable_reflexion: bool = False,
    bypass_acl: bool = False,
    use_citations: bool = False,
    retrieval_metrics_callback: Callable[[RetrievalMetricsContainer], None]
    | None = None,
    rerank_metrics_callback: Callable[[RerankMetricsContainer], None] | None = None,
) -> OneShotQAResponse:
    """Collects the streamed one shot answer responses into a single object"""
    qa_response = OneShotQAResponse()

    results = stream_answer_objects(
        query_req=query_req,
        user=user,
        max_document_tokens=max_document_tokens,
        max_history_tokens=max_history_tokens,
        db_session=db_session,
        bypass_acl=bypass_acl,
        use_citations=use_citations,
        timeout=answer_generation_timeout,
        retrieval_metrics_callback=retrieval_metrics_callback,
        rerank_metrics_callback=rerank_metrics_callback,
    )

    answer = ""
    for packet in results:
        if isinstance(packet, QueryRephrase):
            qa_response.rephrase = packet.rephrased_query
        if isinstance(packet, AnswerPiece) and packet.answer_piece:
            answer += packet.answer_piece
        elif isinstance(packet, QADocsResponse):
            qa_response.docs = packet
        elif isinstance(packet, LLMRelevanceFilterResponse):
            qa_response.llm_chunks_indices = packet.relevant_chunk_indices
        elif isinstance(packet, EnmeddQuotes):
            qa_response.quotes = packet
        elif isinstance(packet, CitationInfo):
            if qa_response.citations:
                qa_response.citations.append(packet)
            else:
                qa_response.citations = [packet]
        elif isinstance(packet, EnmeddContexts):
            qa_response.contexts = packet
        elif isinstance(packet, StreamingError):
            qa_response.error_msg = packet.error
        elif isinstance(packet, ChatMessageDetail):
            qa_response.chat_message_id = packet.message_id

    if answer:
        qa_response.answer = answer

    if enable_reflexion:
        # Because follow up messages are explicitly tagged, we don't need to verify the answer
        if len(query_req.messages) == 1:
            first_query = query_req.messages[0].message
            qa_response.answer_valid = get_answer_validity(first_query, answer)
        else:
            qa_response.answer_valid = True

    if use_citations and qa_response.answer and qa_response.citations:
        # Reorganize citation nums to be in the same order as the answer
        qa_response.answer, qa_response.citations = reorganize_citations(
            qa_response.answer, qa_response.citations
        )

    return qa_response
