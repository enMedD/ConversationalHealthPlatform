import io
import re
import uuid
from typing import Optional

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request
from fastapi import Response
from fastapi import UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session

from enmedd.auth.users import current_user
from enmedd.chat.chat_utils import create_chat_chain
from enmedd.chat.models import AnswerPiece
from enmedd.chat.models import QADocsResponse
from enmedd.chat.models import StreamingError
from enmedd.chat.process_message import stream_chat_message
from enmedd.chat.process_message import stream_chat_message_objects
from enmedd.configs.app_configs import WEB_DOMAIN
from enmedd.configs.constants import FileOrigin
from enmedd.configs.constants import MessageType
from enmedd.db.assistant import get_assistant_by_id
from enmedd.db.chat import create_chat_session
from enmedd.db.chat import create_new_chat_message
from enmedd.db.chat import delete_chat_session
from enmedd.db.chat import get_chat_message
from enmedd.db.chat import get_chat_messages_by_session
from enmedd.db.chat import get_chat_session_by_id
from enmedd.db.chat import get_chat_sessions_by_user
from enmedd.db.chat import get_or_create_root_message
from enmedd.db.chat import set_as_latest_chat_message
from enmedd.db.chat import translate_db_message_to_chat_message_detail
from enmedd.db.chat import update_chat_session
from enmedd.db.engine import get_session
from enmedd.db.feedback import create_chat_message_feedback
from enmedd.db.feedback import create_doc_retrieval_feedback
from enmedd.db.models import User
from enmedd.document_index.document_index_utils import get_both_index_names
from enmedd.document_index.factory import get_default_document_index
from enmedd.file_processing.extract_file_text import extract_file_text
from enmedd.file_store.file_store import get_default_file_store
from enmedd.file_store.models import ChatFileType
from enmedd.file_store.models import FileDescriptor
from enmedd.llm.answering.prompts.citations_prompt import (
    compute_max_document_tokens_for_assistant,
)
from enmedd.llm.exceptions import GenAIDisabledException
from enmedd.llm.factory import get_default_llms
from enmedd.llm.headers import get_litellm_additional_request_headers
from enmedd.llm.utils import get_default_llm_tokenizer
from enmedd.search.models import OptionalSearchSetting
from enmedd.search.models import RetrievalDetails
from enmedd.secondary_llm_flows.chat_session_naming import (
    get_renamed_conversation_name,
)
from enmedd.server.models import MinimalTeamspaceSnapshot
from enmedd.server.models import MinimalWorkspaceSnapshot
from enmedd.server.query_and_chat.models import BasicCreateChatMessageRequest
from enmedd.server.query_and_chat.models import ChatBasicResponse
from enmedd.server.query_and_chat.models import ChatFeedbackRequest
from enmedd.server.query_and_chat.models import ChatMessageDetail
from enmedd.server.query_and_chat.models import ChatMessageIdentifier
from enmedd.server.query_and_chat.models import ChatRenameRequest
from enmedd.server.query_and_chat.models import ChatSessionCreationRequest
from enmedd.server.query_and_chat.models import ChatSessionDetailResponse
from enmedd.server.query_and_chat.models import ChatSessionDetails
from enmedd.server.query_and_chat.models import ChatSessionsResponse
from enmedd.server.query_and_chat.models import ChatSessionUpdateRequest
from enmedd.server.query_and_chat.models import CreateChatMessageRequest
from enmedd.server.query_and_chat.models import CreateChatSessionID
from enmedd.server.query_and_chat.models import LLMOverride
from enmedd.server.query_and_chat.models import PromptOverride
from enmedd.server.query_and_chat.models import RenameChatSessionResponse
from enmedd.server.query_and_chat.models import SearchFeedbackRequest
from enmedd.server.query_and_chat.models import SimpleDoc
from enmedd.server.query_and_chat.models import UpdateChatSessionThreadRequest
from enmedd.server.query_and_chat.token_limit import check_token_rate_limits
from enmedd.utils.logger import setup_logger

logger = setup_logger()

router = APIRouter(prefix="/chat")


@router.get("/get-user-chat-sessions")
def get_user_chat_sessions(
    teamspace_id: Optional[int] = None,
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> ChatSessionsResponse:
    user_id = user.id if user is not None else None

    try:
        chat_sessions = get_chat_sessions_by_user(
            user_id=user_id,
            teamspace_id=teamspace_id,
            deleted=False,
            db_session=db_session,
        )

    except ValueError:
        raise HTTPException(
            status_code=404, detail="Chat session does not exist or has been deleted"
        )

    return ChatSessionsResponse(
        sessions=[
            ChatSessionDetails(
                id=chat_session.id,
                name=chat_session.description,
                assistant_id=chat_session.assistant_id,
                time_created=chat_session.time_created.isoformat(),
                shared_status=chat_session.shared_status,
                folder_id=chat_session.folder_id,
                current_alternate_model=chat_session.current_alternate_model,
                groups=[
                    MinimalTeamspaceSnapshot(
                        id=teamspace.id,
                        name=teamspace.name,
                        workspace=[
                            MinimalWorkspaceSnapshot(
                                id=workspace.id, workspace_name=workspace.workspace_name
                            )
                            for workspace in teamspace.workspace
                        ],
                    )
                    for teamspace in chat_session.groups
                ],
            )
            for chat_session in chat_sessions
        ]
    )


@router.put("/update-chat-session-model")
def update_chat_session_model(
    update_thread_req: UpdateChatSessionThreadRequest,
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> None:
    chat_session = get_chat_session_by_id(
        chat_session_id=update_thread_req.chat_session_id,
        user_id=user.id if user is not None else None,
        db_session=db_session,
    )
    chat_session.current_alternate_model = update_thread_req.new_alternate_model

    db_session.add(chat_session)
    db_session.commit()


@router.get("/get-chat-session/{session_id}")
def get_chat_session(
    session_id: int,
    is_shared: bool = False,
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> ChatSessionDetailResponse:
    user_id = user.id if user is not None else None

    try:
        chat_session = get_chat_session_by_id(
            chat_session_id=session_id,
            user_id=user_id,
            db_session=db_session,
            is_shared=is_shared,
        )
    except ValueError:
        raise ValueError("Chat session does not exist or has been deleted")

    # for chat-seeding: if the session is unassigned, assign it now. This is done here
    # to avoid another back and forth between FE -> BE before starting the first
    # message generation
    if chat_session.user_id is None and user_id is not None:
        chat_session.user_id = user_id
        db_session.commit()

    session_messages = get_chat_messages_by_session(
        chat_session_id=session_id,
        user_id=user_id,
        db_session=db_session,
        # we already did a permission check above with the call to
        # `get_chat_session_by_id`, so we can skip it here
        skip_permission_check=True,
        # we need the tool call objs anyways, so just fetch them in a single call
        prefetch_tool_calls=True,
    )

    return ChatSessionDetailResponse(
        chat_session_id=session_id,
        description=chat_session.description,
        assistant_id=chat_session.assistant_id,
        assistant_name=chat_session.assistant.name,
        current_alternate_model=chat_session.current_alternate_model,
        messages=[
            translate_db_message_to_chat_message_detail(
                msg, remove_doc_content=is_shared  # if shared, don't leak doc content
            )
            for msg in session_messages
        ],
        time_created=chat_session.time_created,
        shared_status=chat_session.shared_status,
        groups=[
            MinimalTeamspaceSnapshot(
                id=teamspace.id,
                name=teamspace.name,
                workspace=[
                    MinimalWorkspaceSnapshot(
                        id=workspace.id, workspace_name=workspace.workspace_name
                    )
                    for workspace in teamspace.workspace
                ],
            )
            for teamspace in chat_session.groups
        ],
    )


@router.post("/create-chat-session")
def create_new_chat_session(
    chat_session_creation_request: ChatSessionCreationRequest,
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
    teamspace_id: Optional[int] = None,
) -> CreateChatSessionID:
    user_id = user.id if user is not None else None
    try:
        new_chat_session = create_chat_session(
            db_session=db_session,
            description=chat_session_creation_request.description
            or "",  # Leave the naming till later to prevent delay
            user_id=user_id,
            assistant_id=chat_session_creation_request.assistant_id,
            teamspace_id=teamspace_id,
        )
    except Exception as e:
        logger.exception(e)
        raise HTTPException(status_code=400, detail="Invalid Assistant provided.")

    return CreateChatSessionID(chat_session_id=new_chat_session.id)


@router.put("/rename-chat-session")
def rename_chat_session(
    rename_req: ChatRenameRequest,
    request: Request,
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> RenameChatSessionResponse:
    name = rename_req.name
    chat_session_id = rename_req.chat_session_id
    user_id = user.id if user is not None else None

    logger.info(f"Received rename request for chat session: {chat_session_id}")

    if name:
        update_chat_session(
            db_session=db_session,
            user_id=user_id,
            chat_session_id=chat_session_id,
            description=name,
        )
        return RenameChatSessionResponse(new_name=name)

    final_msg, history_msgs = create_chat_chain(
        chat_session_id=chat_session_id, db_session=db_session
    )
    full_history = history_msgs + [final_msg]

    try:
        llm, _ = get_default_llms(
            additional_headers=get_litellm_additional_request_headers(request.headers)
        )
    except GenAIDisabledException:
        # This may be longer than what the LLM tends to produce but is the most
        # clear thing we can do
        return RenameChatSessionResponse(new_name=full_history[0].message)

    new_name = get_renamed_conversation_name(full_history=full_history, llm=llm)

    update_chat_session(
        db_session=db_session,
        user_id=user_id,
        chat_session_id=chat_session_id,
        description=new_name,
    )

    return RenameChatSessionResponse(new_name=new_name)


@router.patch("/chat-session/{session_id}")
def patch_chat_session(
    session_id: int,
    chat_session_update_req: ChatSessionUpdateRequest,
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> None:
    user_id = user.id if user is not None else None
    update_chat_session(
        db_session=db_session,
        user_id=user_id,
        chat_session_id=session_id,
        sharing_status=chat_session_update_req.sharing_status,
    )
    return None


@router.delete("/delete-chat-session/{session_id}")
def delete_chat_session_by_id(
    session_id: int,
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> None:
    user_id = user.id if user is not None else None
    delete_chat_session(user_id, session_id, db_session)


@router.post("/send-message")
def handle_new_chat_message(
    chat_message_req: CreateChatMessageRequest,
    request: Request,
    user: User | None = Depends(current_user),
    _: None = Depends(check_token_rate_limits),
) -> StreamingResponse:
    """This endpoint is both used for all the following purposes:
    - Sending a new message in the session
    - Regenerating a message in the session (just send the same one again)
    - Editing a message (similar to regenerating but sending a different message)
    - Kicking off a seeded chat session (set `use_existing_user_message`)

    To avoid extra overhead/latency, this assumes (and checks) that previous messages on the path
    have already been set as latest"""
    logger.debug(f"Received new chat message: {chat_message_req.message}")

    if (
        not chat_message_req.message
        and chat_message_req.prompt_id is not None
        and not chat_message_req.use_existing_user_message
    ):
        raise HTTPException(status_code=400, detail="Empty chat message is invalid")

    packets = stream_chat_message(
        new_msg_req=chat_message_req,
        user=user,
        use_existing_user_message=chat_message_req.use_existing_user_message,
        litellm_additional_headers=get_litellm_additional_request_headers(
            request.headers
        ),
    )

    return StreamingResponse(packets, media_type="application/json")


@router.put("/set-message-as-latest")
def set_message_as_latest(
    message_identifier: ChatMessageIdentifier,
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> None:
    user_id = user.id if user is not None else None

    chat_message = get_chat_message(
        chat_message_id=message_identifier.message_id,
        user_id=user_id,
        db_session=db_session,
    )

    set_as_latest_chat_message(
        chat_message=chat_message,
        user_id=user_id,
        db_session=db_session,
    )


@router.post("/create-chat-message-feedback")
def create_chat_feedback(
    feedback: ChatFeedbackRequest,
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> None:
    user_id = user.id if user else None

    create_chat_message_feedback(
        is_positive=feedback.is_positive,
        feedback_text=feedback.feedback_text,
        predefined_feedback=feedback.predefined_feedback,
        chat_message_id=feedback.chat_message_id,
        user_id=user_id,
        db_session=db_session,
    )


@router.post("/document-search-feedback")
def create_search_feedback(
    feedback: SearchFeedbackRequest,
    _: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> None:
    """This endpoint isn't protected - it does not check if the user has access to the document
    Users could try changing boosts of arbitrary docs but this does not leak any data.
    """

    curr_ind_name, sec_ind_name = get_both_index_names(db_session)
    document_index = get_default_document_index(
        primary_index_name=curr_ind_name, secondary_index_name=sec_ind_name
    )

    create_doc_retrieval_feedback(
        message_id=feedback.message_id,
        document_id=feedback.document_id,
        document_rank=feedback.document_rank,
        clicked=feedback.click,
        feedback=feedback.search_feedback,
        document_index=document_index,
        db_session=db_session,
    )


class MaxSelectedDocumentTokens(BaseModel):
    max_tokens: int


@router.get("/max-selected-document-tokens")
def get_max_document_tokens(
    assistant_id: int,
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> MaxSelectedDocumentTokens:
    try:
        assistant = get_assistant_by_id(
            assistant_id=assistant_id,
            user=user,
            db_session=db_session,
            is_for_edit=False,
        )
    except ValueError:
        raise HTTPException(status_code=404, detail="Assistant not found")

    return MaxSelectedDocumentTokens(
        max_tokens=compute_max_document_tokens_for_assistant(assistant),
    )


"""Endpoints for chat seeding"""


class ChatSeedRequest(BaseModel):
    # standard chat session stuff
    assistant_id: int
    prompt_id: int | None = None

    # overrides / seeding
    llm_override: LLMOverride | None = None
    prompt_override: PromptOverride | None = None
    description: str | None = None
    message: str | None = None

    # TODO: support this
    # initial_message_retrieval_options: RetrievalDetails | None = None


class ChatSeedResponse(BaseModel):
    redirect_url: str


@router.post("/seed-chat-session")
def seed_chat(
    chat_seed_request: ChatSeedRequest,
    # NOTE: realistically, this will be an API key not an actual user
    _: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> ChatSeedResponse:
    try:
        new_chat_session = create_chat_session(
            db_session=db_session,
            description=chat_seed_request.description or "",
            user_id=None,  # this chat session is "unassigned" until a user visits the web UI
            assistant_id=chat_seed_request.assistant_id,
            llm_override=chat_seed_request.llm_override,
            prompt_override=chat_seed_request.prompt_override,
        )
    except Exception as e:
        logger.exception(e)
        raise HTTPException(status_code=400, detail="Invalid Assistant provided.")

    if chat_seed_request.message is not None:
        root_message = get_or_create_root_message(
            chat_session_id=new_chat_session.id, db_session=db_session
        )
        create_new_chat_message(
            chat_session_id=new_chat_session.id,
            parent_message=root_message,
            prompt_id=chat_seed_request.prompt_id
            or (
                new_chat_session.assistant.prompts[0].id
                if new_chat_session.assistant.prompts
                else None
            ),
            message=chat_seed_request.message,
            token_count=len(
                get_default_llm_tokenizer().encode(chat_seed_request.message)
            ),
            message_type=MessageType.USER,
            db_session=db_session,
        )

    return ChatSeedResponse(
        redirect_url=f"{WEB_DOMAIN}/chat?chatId={new_chat_session.id}&seeded=true"
    )


"""File upload"""


@router.post("/file")
def upload_files_for_chat(
    files: list[UploadFile],
    db_session: Session = Depends(get_session),
    _: User | None = Depends(current_user),
) -> dict[str, list[FileDescriptor]]:
    image_content_types = {"image/jpeg", "image/png", "image/webp"}
    text_content_types = {
        "text/plain",
        "text/csv",
        "text/markdown",
        "text/x-markdown",
        "text/x-config",
        "text/tab-separated-values",
        "application/json",
        "application/xml",
        "application/x-yaml",
    }
    document_content_types = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "message/rfc822",
        "application/epub+zip",
    }

    allowed_content_types = image_content_types.union(text_content_types).union(
        document_content_types
    )

    for file in files:
        if file.content_type not in allowed_content_types:
            if file.content_type in image_content_types:
                error_detail = "Unsupported image file type. Supported image types include .jpg, .jpeg, .png, .webp."
            elif file.content_type in text_content_types:
                error_detail = "Unsupported text file type. Supported text types include .txt, .csv, .md, .mdx, .conf, "
                ".log, .tsv."
            else:
                error_detail = (
                    "Unsupported document file type. Supported document types include .pdf, .docx, .pptx, .xlsx, "
                    ".json, .xml, .yml, .yaml, .eml, .epub."
                )
            raise HTTPException(status_code=400, detail=error_detail)

        if (
            file.content_type in image_content_types
            and file.size
            and file.size > 20 * 1024 * 1024
        ):
            raise HTTPException(
                status_code=400,
                detail="File size must be less than 20MB",
            )

    file_store = get_default_file_store(db_session)

    file_info: list[tuple[str, str | None, ChatFileType]] = []
    for file in files:
        if file.content_type in image_content_types:
            file_type = ChatFileType.IMAGE
        elif file.content_type in document_content_types:
            file_type = ChatFileType.DOC
        else:
            file_type = ChatFileType.PLAIN_TEXT

        # store the raw file
        file_id = str(uuid.uuid4())
        file_store.save_file(
            file_name=file_id,
            content=file.file,
            display_name=file.filename,
            file_origin=FileOrigin.CHAT_UPLOAD,
            file_type=file.content_type or file_type.value,
        )

        # if the file is a doc, extract text and store that so we don't need
        # to re-extract it every time we send a message
        if file_type == ChatFileType.DOC:
            extracted_text = extract_file_text(file_name=file.filename, file=file.file)
            text_file_id = str(uuid.uuid4())
            file_store.save_file(
                file_name=text_file_id,
                content=io.BytesIO(extracted_text.encode()),
                display_name=file.filename,
                file_origin=FileOrigin.CHAT_UPLOAD,
                file_type="text/plain",
            )
            # for DOC type, just return this for the FileDescriptor
            # as we would always use this as the ID to attach to the
            # message
            file_info.append((text_file_id, file.filename, ChatFileType.PLAIN_TEXT))
        else:
            file_info.append((file_id, file.filename, file_type))

    return {
        "files": [
            {"id": file_id, "type": file_type, "name": file_name}
            for file_id, file_name, file_type in file_info
        ]
    }


@router.get("/file/{file_id}")
def fetch_chat_file(
    file_id: str,
    db_session: Session = Depends(get_session),
    _: User | None = Depends(current_user),
) -> Response:
    file_store = get_default_file_store(db_session)
    file_io = file_store.read_file(file_id, mode="b")
    # NOTE: specifying "image/jpeg" here, but it still works for pngs
    # TODO: do this properly
    return Response(content=file_io.read(), media_type="image/jpeg")


# EE
def translate_doc_response_to_simple_doc(
    doc_response: QADocsResponse,
) -> list[SimpleDoc]:
    return [
        SimpleDoc(
            semantic_identifier=doc.semantic_identifier,
            link=doc.link,
            blurb=doc.blurb,
            match_highlights=[
                highlight for highlight in doc.match_highlights if highlight
            ],
            source_type=doc.source_type,
        )
        for doc in doc_response.top_documents
    ]


def remove_answer_citations(answer: str) -> str:
    pattern = r"\s*\[\[\d+\]\]\(http[s]?://[^\s]+\)"

    return re.sub(pattern, "", answer)


@router.post("/send-message-simple-api")
def handle_simplified_chat_message(
    chat_message_req: BasicCreateChatMessageRequest,
    user: User | None = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> ChatBasicResponse:
    """This is a Non-Streaming version that only gives back a minimal set of information"""
    logger.info(f"Received new simple api chat message: {chat_message_req.message}")

    if not chat_message_req.message:
        raise HTTPException(status_code=400, detail="Empty chat message is invalid")

    try:
        parent_message, _ = create_chat_chain(
            chat_session_id=chat_message_req.chat_session_id, db_session=db_session
        )
    except Exception:
        parent_message = get_or_create_root_message(
            chat_session_id=chat_message_req.chat_session_id, db_session=db_session
        )

    if (
        chat_message_req.retrieval_options is None
        and chat_message_req.search_doc_ids is None
    ):
        retrieval_options: RetrievalDetails | None = RetrievalDetails(
            run_search=OptionalSearchSetting.ALWAYS,
            real_time=False,
        )
    else:
        retrieval_options = chat_message_req.retrieval_options

    full_chat_msg_info = CreateChatMessageRequest(
        chat_session_id=chat_message_req.chat_session_id,
        parent_message_id=parent_message.id,
        message=chat_message_req.message,
        file_descriptors=[],
        prompt_id=None,
        search_doc_ids=chat_message_req.search_doc_ids,
        retrieval_options=retrieval_options,
        query_override=chat_message_req.query_override,
        chunks_above=chat_message_req.chunks_above,
        chunks_below=chat_message_req.chunks_below,
        full_doc=chat_message_req.full_doc,
    )

    packets = stream_chat_message_objects(
        new_msg_req=full_chat_msg_info,
        user=user,
        db_session=db_session,
    )

    response = ChatBasicResponse()

    answer = ""
    for packet in packets:
        # TODO: remove the AnswerPiece in the database
        if isinstance(packet, AnswerPiece) and packet.answer_piece:
            answer += packet.answer_piece
        elif isinstance(packet, QADocsResponse):
            response.simple_search_docs = translate_doc_response_to_simple_doc(packet)
        elif isinstance(packet, StreamingError):
            response.error_msg = packet.error
        elif isinstance(packet, ChatMessageDetail):
            response.message_id = packet.message_id

    response.answer = answer
    if answer:
        response.answer_citationless = remove_answer_citations(answer)

    return response
