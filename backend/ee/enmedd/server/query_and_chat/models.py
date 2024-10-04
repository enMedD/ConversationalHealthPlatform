from typing import Optional

from pydantic import BaseModel

from enmedd.configs.constants import DocumentSource
from enmedd.db.enums import ChatSessionSharedStatus
from enmedd.search.enums import SearchType
from enmedd.search.models import ChunkContext
from enmedd.search.models import RetrievalDetails
from enmedd.server.models import MinimalTeamspaceSnapshot


class DocumentSearchRequest(ChunkContext):
    message: str
    search_type: SearchType
    retrieval_options: RetrievalDetails
    recency_bias_multiplier: float = 1.0
    # This is to forcibly skip (or run) the step, if None it uses the system defaults
    skip_rerank: Optional[bool] = None
    skip_llm_chunk_filter: Optional[bool] = None


class BasicCreateChatMessageRequest(ChunkContext):
    """Before creating messages, be sure to create a chat_session and get an id
    Note, for simplicity this option only allows for a single linear chain of messages
    """

    chat_session_id: int
    # New message contents
    message: str
    # Defaults to using retrieval with no additional filters
    retrieval_options: Optional[RetrievalDetails] = None
    # Allows the caller to specify the exact search query they want to use
    # will disable Query Rewording if specified
    query_override: Optional[str] = None
    # If search_doc_ids provided, then retrieval options are unused
    search_doc_ids: Optional[list[int]] = None


class SimpleDoc(BaseModel):
    semantic_identifier: str
    link: Optional[str]
    blurb: str
    match_highlights: list[str]
    source_type: DocumentSource


class ChatBasicResponse(BaseModel):
    # This is built piece by piece, any of these can be None as the flow could break
    answer: Optional[str] = None
    answer_citationless: Optional[str] = None
    simple_search_docs: Optional[list[SimpleDoc]] = None
    error_msg: Optional[str] = None
    message_id: Optional[int] = None


class ChatSessionDetails(BaseModel):
    id: int
    description: str
    assistant_id: int
    time_created: str
    shared_status: ChatSessionSharedStatus
    folder_id: Optional[int]
    current_alternate_model: Optional[str] = None
    groups: Optional[list[MinimalTeamspaceSnapshot]] = None
