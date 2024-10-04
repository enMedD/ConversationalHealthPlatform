from collections.abc import Iterator
from datetime import datetime
from typing import Any

from pydantic import BaseModel

from enmedd.configs.constants import DocumentSource
from enmedd.search.enums import QueryFlow
from enmedd.search.enums import SearchType
from enmedd.search.models import RetrievalDocs
from enmedd.search.models import SearchResponse


class LlmDoc(BaseModel):
    """This contains the minimal set information for the LLM portion including citations"""

    document_id: str
    content: str
    blurb: str
    semantic_identifier: str
    source_type: DocumentSource
    metadata: dict[str, str | list[str]]
    updated_at: datetime | None
    link: str | None
    source_links: dict[int, str] | None


# First chunk of info for streaming QA
class QADocsResponse(RetrievalDocs):
    rephrased_query: str | None = None
    predicted_flow: QueryFlow | None
    predicted_search: SearchType | None
    applied_source_filters: list[DocumentSource] | None
    applied_time_cutoff: datetime | None
    recency_bias_multiplier: float

    def model_dump(self, *args: list, **kwargs: dict[str, Any]) -> dict[str, Any]:  # type: ignore
        initial_dict = super().model_dump(mode="json", *args, **kwargs)  # type: ignore
        initial_dict["applied_time_cutoff"] = (
            self.applied_time_cutoff.isoformat() if self.applied_time_cutoff else None
        )

        return initial_dict


# Second chunk of info for streaming QA
class LLMRelevanceFilterResponse(BaseModel):
    relevant_chunk_indices: list[int]


class RelevanceAnalysis(BaseModel):
    relevant: bool
    content: str | None = None


class SectionRelevancePiece(RelevanceAnalysis):
    """LLM analysis mapped to an Inference Section"""

    document_id: str
    chunk_id: int  # ID of the center chunk for a given inference section


# TODO: replace all the class names into enmedd
class AnswerPiece(BaseModel):
    # A small piece of a complete answer. Used for streaming back answers.
    answer_piece: str | None  # if None, specifies the end of an Answer


# An intermediate representation of citations, later translated into
# a mapping of the citation [n] number to SearchDoc
class CitationInfo(BaseModel):
    citation_num: int
    document_id: str


class StreamingError(BaseModel):
    error: str


class EnmeddQuote(BaseModel):
    # This is during inference so everything is a string by this point
    quote: str
    document_id: str
    link: str | None
    source_type: str
    semantic_identifier: str
    blurb: str


class EnmeddQuotes(BaseModel):
    quotes: list[EnmeddQuote]


class EnmeddContext(BaseModel):
    content: str
    document_id: str
    semantic_identifier: str
    blurb: str


class EnmeddContexts(BaseModel):
    contexts: list[EnmeddContext]


class EnmeddAnswer(BaseModel):
    answer: str | None


class QAResponse(SearchResponse, EnmeddAnswer):
    quotes: list[EnmeddQuote] | None
    contexts: list[EnmeddContexts] | None
    predicted_flow: QueryFlow
    predicted_search: SearchType
    eval_res_valid: bool | None = None
    llm_chunks_indices: list[int] | None = None
    error_msg: str | None = None


class ImageGenerationDisplay(BaseModel):
    file_ids: list[str]


class CustomToolResponse(BaseModel):
    response: dict
    tool_name: str


AnswerQuestionPossibleReturn = (
    AnswerPiece
    | EnmeddQuotes
    | CitationInfo
    | EnmeddContexts
    | ImageGenerationDisplay
    | CustomToolResponse
    | StreamingError
)


AnswerQuestionStreamReturn = Iterator[AnswerQuestionPossibleReturn]


class LLMMetricsContainer(BaseModel):
    prompt_tokens: int
    response_tokens: int
