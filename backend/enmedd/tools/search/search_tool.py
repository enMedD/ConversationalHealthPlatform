import json
from collections.abc import Generator
from typing import Any
from typing import cast

from pydantic import BaseModel
from sqlalchemy.orm import Session

from enmedd.chat.chat_utils import llm_doc_from_inference_section
from enmedd.chat.models import EnmeddContext
from enmedd.chat.models import EnmeddContexts
from enmedd.chat.models import LlmDoc
from enmedd.db.models import Assistant
from enmedd.db.models import User
from enmedd.dynamic_configs.interface import JSON_ro
from enmedd.llm.answering.doc_pruning import prune_documents
from enmedd.llm.answering.models import DocumentPruningConfig
from enmedd.llm.answering.models import PreviousMessage
from enmedd.llm.answering.models import PromptConfig
from enmedd.llm.interfaces import LLM
from enmedd.search.enums import QueryFlow
from enmedd.search.enums import SearchType
from enmedd.search.models import IndexFilters
from enmedd.search.models import InferenceSection
from enmedd.search.models import RetrievalDetails
from enmedd.search.models import SearchRequest
from enmedd.search.pipeline import SearchPipeline
from enmedd.secondary_llm_flows.choose_search import check_if_need_search
from enmedd.secondary_llm_flows.query_expansion import history_based_query_rephrase
from enmedd.tools.search.search_utils import llm_doc_to_dict
from enmedd.tools.tool import Tool
from enmedd.tools.tool import ToolResponse

SEARCH_RESPONSE_SUMMARY_ID = "search_response_summary"
SEARCH_DOC_CONTENT_ID = "search_doc_content"
SECTION_RELEVANCE_LIST_ID = "section_relevance_list"
FINAL_CONTEXT_DOCUMENTS = "final_context_documents"


class SearchResponseSummary(BaseModel):
    top_sections: list[InferenceSection]
    rephrased_query: str | None = None
    predicted_flow: QueryFlow | None
    predicted_search: SearchType | None
    final_filters: IndexFilters
    recency_bias_multiplier: float


search_tool_description = """
Runs a semantic search over the user's knowledge base. The default behavior is to use this tool. \
The only scenario where you should not use this tool is if:

- There is sufficient information in chat history to FULLY and ACCURATELY answer the query AND \
additional information or details would provide little or no value.
- The query is some form of request that does not require additional information to handle.

HINT: if you are unfamiliar with the user input OR think the user input is a typo, use this tool.
"""


class SearchTool(Tool):
    NAME = "run_search"

    def __init__(
        self,
        db_session: Session,
        user: User | None,
        assistant: Assistant,
        retrieval_options: RetrievalDetails | None,
        prompt_config: PromptConfig,
        llm: LLM,
        fast_llm: LLM,
        pruning_config: DocumentPruningConfig,
        # if specified, will not actually run a search and will instead return these
        # sections. Used when the user selects specific docs to talk to
        selected_docs: list[LlmDoc] | None = None,
        chunks_above: int = 0,
        chunks_below: int = 0,
        full_doc: bool = False,
        bypass_acl: bool = False,
    ) -> None:
        self.user = user
        self.assistant = assistant
        self.retrieval_options = retrieval_options
        self.prompt_config = prompt_config
        self.llm = llm
        self.fast_llm = fast_llm
        self.pruning_config = pruning_config

        self.selected_docs = selected_docs

        self.chunks_above = chunks_above
        self.chunks_below = chunks_below
        self.full_doc = full_doc
        self.bypass_acl = bypass_acl
        self.db_session = db_session

    def name(self) -> str:
        return self.NAME

    """For explicit tool calling"""

    def tool_definition(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name(),
                "description": search_tool_description,
                "parameters": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "What to search for",
                        },
                    },
                    "required": ["query"],
                },
            },
        }

    def build_tool_message_content(
        self, *args: ToolResponse
    ) -> str | list[str | dict[str, Any]]:
        final_context_docs_response = next(
            response for response in args if response.id == FINAL_CONTEXT_DOCUMENTS
        )
        final_context_docs = cast(list[LlmDoc], final_context_docs_response.response)

        return json.dumps(
            {
                "search_results": [
                    llm_doc_to_dict(doc, ind)
                    for ind, doc in enumerate(final_context_docs)
                ]
            }
        )

    """For LLMs that don't support tool calling"""

    def get_args_for_non_tool_calling_llm(
        self,
        query: str,
        history: list[PreviousMessage],
        llm: LLM,
        force_run: bool = False,
    ) -> dict[str, Any] | None:
        if not force_run and not check_if_need_search(
            query=query, history=history, llm=llm
        ):
            return None

        rephrased_query = history_based_query_rephrase(
            query=query, history=history, llm=llm
        )
        return {"query": rephrased_query}

    """Actual tool execution"""

    def _build_response_for_specified_sections(
        self, query: str
    ) -> Generator[ToolResponse, None, None]:
        if self.selected_docs is None:
            raise ValueError("sections must be specified")

        yield ToolResponse(
            id=SEARCH_RESPONSE_SUMMARY_ID,
            response=SearchResponseSummary(
                rephrased_query=None,
                top_sections=[],
                predicted_flow=None,
                predicted_search=None,
                final_filters=IndexFilters(access_control_list=None),  # dummy filters
                recency_bias_multiplier=1.0,
            ),
        )
        yield ToolResponse(
            id=SECTION_RELEVANCE_LIST_ID,
            response=[i for i in range(len(self.selected_docs))],
        )
        yield ToolResponse(
            id=FINAL_CONTEXT_DOCUMENTS,
            response=prune_documents(
                docs=self.selected_docs,
                doc_relevance_list=None,
                prompt_config=self.prompt_config,
                llm_config=self.llm.config,
                question=query,
                document_pruning_config=self.pruning_config,
            ),
        )

    def run(self, **kwargs: str) -> Generator[ToolResponse, None, None]:
        query = cast(str, kwargs["query"])

        if self.selected_docs:
            yield from self._build_response_for_specified_sections(query)
            return

        search_pipeline = SearchPipeline(
            search_request=SearchRequest(
                query=query,
                human_selected_filters=(
                    self.retrieval_options.filters if self.retrieval_options else None
                ),
                assistant=self.assistant,
                offset=self.retrieval_options.offset
                if self.retrieval_options
                else None,
                limit=self.retrieval_options.limit if self.retrieval_options else None,
                chunks_above=self.chunks_above,
                chunks_below=self.chunks_below,
                full_doc=self.full_doc,
            ),
            user=self.user,
            llm=self.llm,
            fast_llm=self.fast_llm,
            bypass_acl=self.bypass_acl,
            db_session=self.db_session,
        )
        yield ToolResponse(
            id=SEARCH_RESPONSE_SUMMARY_ID,
            response=SearchResponseSummary(
                rephrased_query=query,
                top_sections=search_pipeline.reranked_sections,
                predicted_flow=search_pipeline.predicted_flow,
                predicted_search=search_pipeline.predicted_search_type,
                final_filters=search_pipeline.search_query.filters,
                recency_bias_multiplier=search_pipeline.search_query.recency_bias_multiplier,
            ),
        )
        yield ToolResponse(
            id=SEARCH_DOC_CONTENT_ID,
            response=EnmeddContexts(
                contexts=[
                    EnmeddContext(
                        content=section.content,
                        document_id=section.document_id,
                        semantic_identifier=section.semantic_identifier,
                        blurb=section.blurb,
                    )
                    for section in search_pipeline.reranked_sections
                ]
            ),
        )
        yield ToolResponse(
            id=SECTION_RELEVANCE_LIST_ID,
            response=search_pipeline.relevant_chunk_indices,
        )

        llm_docs = [
            llm_doc_from_inference_section(section)
            for section in search_pipeline.reranked_sections
        ]
        final_context_documents = prune_documents(
            docs=llm_docs,
            doc_relevance_list=[
                True if ind in search_pipeline.relevant_chunk_indices else False
                for ind in range(len(llm_docs))
            ],
            prompt_config=self.prompt_config,
            llm_config=self.llm.config,
            question=query,
            document_pruning_config=self.pruning_config,
        )
        yield ToolResponse(id=FINAL_CONTEXT_DOCUMENTS, response=final_context_documents)

    def final_result(self, *args: ToolResponse) -> JSON_ro:
        final_docs = cast(
            list[LlmDoc],
            next(arg.response for arg in args if arg.id == FINAL_CONTEXT_DOCUMENTS),
        )
        # NOTE: need to do this json.loads(doc.json()) stuff because there are some
        # subfields that are not serializable by default (datetime)
        # this forces pydantic to make them JSON serializable for us
        return [json.loads(doc.json()) for doc in final_docs]
