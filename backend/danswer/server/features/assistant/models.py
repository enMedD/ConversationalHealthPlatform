from uuid import UUID

from pydantic import BaseModel

from danswer.db.models import Assistant
from danswer.db.models import StarterMessage
from danswer.search.enums import RecencyBiasSetting
from danswer.server.features.document_set.models import DocumentSet
from danswer.server.features.prompt.models import PromptSnapshot
from danswer.server.features.tool.api import ToolSnapshot
from danswer.server.models import MinimalUserSnapshot
from danswer.utils.logger import setup_logger


logger = setup_logger()


class CreateAssistantRequest(BaseModel):
    name: str
    description: str
    num_chunks: float
    llm_relevance_filter: bool
    is_public: bool
    llm_filter_extraction: bool
    recency_bias: RecencyBiasSetting
    prompt_ids: list[int]
    document_set_ids: list[int]
    # e.g. ID of SearchTool or ImageGenerationTool or <USER_DEFINED_TOOL>
    tool_ids: list[int]
    llm_model_provider_override: str | None = None
    llm_model_version_override: str | None = None
    starter_messages: list[StarterMessage] | None = None
    # For Private Assistants, who should be able to access these
    users: list[UUID] | None = None
    teamspaces: list[int] | None = None


class AssistantSnapshot(BaseModel):
    id: int
    owner: MinimalUserSnapshot | None
    name: str
    is_visible: bool
    is_public: bool
    display_priority: int | None
    description: str
    num_chunks: float | None
    llm_relevance_filter: bool
    llm_filter_extraction: bool
    llm_model_provider_override: str | None
    llm_model_version_override: str | None
    starter_messages: list[StarterMessage] | None
    default_assistant: bool
    prompts: list[PromptSnapshot]
    tools: list[ToolSnapshot]
    document_sets: list[DocumentSet]
    users: list[MinimalUserSnapshot]
    teamspaces: list[int]

    @classmethod
    def from_model(
        cls, assistant: Assistant, allow_deleted: bool = False
    ) -> "AssistantSnapshot":
        if assistant.deleted:
            error_msg = f"Assistant with ID {assistant.id} has been deleted"
            if not allow_deleted:
                raise ValueError(error_msg)
            else:
                logger.warning(error_msg)

        return AssistantSnapshot(
            id=assistant.id,
            name=assistant.name,
            owner=(
                MinimalUserSnapshot(id=assistant.user.id, email=assistant.user.email)
                if assistant.user
                else None
            ),
            is_visible=assistant.is_visible,
            is_public=assistant.is_public,
            display_priority=assistant.display_priority,
            description=assistant.description,
            num_chunks=assistant.num_chunks,
            llm_relevance_filter=assistant.llm_relevance_filter,
            llm_filter_extraction=assistant.llm_filter_extraction,
            llm_model_provider_override=assistant.llm_model_provider_override,
            llm_model_version_override=assistant.llm_model_version_override,
            starter_messages=assistant.starter_messages,
            default_assistant=assistant.default_assistant,
            prompts=[PromptSnapshot.from_model(prompt) for prompt in assistant.prompts],
            tools=[ToolSnapshot.from_model(tool) for tool in assistant.tools],
            document_sets=[
                DocumentSet.from_model(document_set_model)
                for document_set_model in assistant.document_sets
            ],
            users=[
                MinimalUserSnapshot(id=user.id, email=user.email)
                for user in assistant.users
            ],
            teamspaces=[teamspace.id for teamspace in assistant.teamspaces],
        )


class PromptTemplateResponse(BaseModel):
    final_prompt_template: str
