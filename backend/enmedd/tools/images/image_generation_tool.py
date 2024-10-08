import json
from collections.abc import Generator
from typing import Any
from typing import cast

from litellm import image_generation  # type: ignore
from pydantic import BaseModel

from enmedd.chat.chat_utils import combine_message_chain
from enmedd.configs.model_configs import GEN_AI_HISTORY_CUTOFF
from enmedd.dynamic_configs.interface import JSON_ro
from enmedd.llm.answering.models import PreviousMessage
from enmedd.llm.headers import build_llm_extra_headers
from enmedd.llm.interfaces import LLM
from enmedd.llm.utils import build_content_with_imgs
from enmedd.llm.utils import message_to_string
from enmedd.prompts.constants import GENERAL_SEP_PAT
from enmedd.tools.tool import Tool
from enmedd.tools.tool import ToolResponse
from enmedd.utils.logger import setup_logger
from enmedd.utils.threadpool_concurrency import run_functions_tuples_in_parallel

logger = setup_logger()


IMAGE_GENERATION_RESPONSE_ID = "image_generation_response"

YES_IMAGE_GENERATION = "Yes Image Generation"
SKIP_IMAGE_GENERATION = "Skip Image Generation"

IMAGE_GENERATION_TEMPLATE = f"""
Given the conversation history and a follow up query, determine if the system should call \
an external image generation tool to better answer the latest user input.
Your default response is {SKIP_IMAGE_GENERATION}.

Respond "{YES_IMAGE_GENERATION}" if:
- The user is asking for an image to be generated.

Conversation History:
{GENERAL_SEP_PAT}
{{chat_history}}
{GENERAL_SEP_PAT}

If you are at all unsure, respond with {SKIP_IMAGE_GENERATION}.
Respond with EXACTLY and ONLY "{YES_IMAGE_GENERATION}" or "{SKIP_IMAGE_GENERATION}"

Follow Up Input:
{{final_query}}
""".strip()


class ImageGenerationResponse(BaseModel):
    revised_prompt: str
    url: str


class ImageGenerationTool(Tool):
    NAME = "run_image_generation"

    def __init__(
        self,
        api_key: str,
        model: str = "dall-e-3",
        num_imgs: int = 2,
        additional_headers: dict[str, str] | None = None,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.num_imgs = num_imgs

        self.additional_headers = additional_headers

    def name(self) -> str:
        return self.NAME

    def tool_definition(self) -> dict:
        return {
            "type": "function",
            "function": {
                "name": self.name(),
                "description": "Generate an image from a prompt",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "prompt": {
                            "type": "string",
                            "description": "Prompt used to generate the image",
                        },
                    },
                    "required": ["prompt"],
                },
            },
        }

    def get_args_for_non_tool_calling_llm(
        self,
        query: str,
        history: list[PreviousMessage],
        llm: LLM,
        force_run: bool = False,
    ) -> dict[str, Any] | None:
        args = {"prompt": query}
        if force_run:
            return args

        history_str = combine_message_chain(
            messages=history, token_limit=GEN_AI_HISTORY_CUTOFF
        )
        prompt = IMAGE_GENERATION_TEMPLATE.format(
            chat_history=history_str,
            final_query=query,
        )
        use_image_generation_tool_output = message_to_string(llm.invoke(prompt))

        logger.debug(
            f"Evaluated if should use ImageGenerationTool: {use_image_generation_tool_output}"
        )
        if (
            YES_IMAGE_GENERATION.split()[0]
        ).lower() in use_image_generation_tool_output.lower():
            return args

        return None

    def build_tool_message_content(
        self, *args: ToolResponse
    ) -> str | list[str | dict[str, Any]]:
        generation_response = args[0]
        image_generations = cast(
            list[ImageGenerationResponse], generation_response.response
        )

        return build_content_with_imgs(
            json.dumps(
                [
                    {
                        "revised_prompt": image_generation.revised_prompt,
                        "url": image_generation.url,
                    }
                    for image_generation in image_generations
                ]
            ),
            img_urls=[image_generation.url for image_generation in image_generations],
        )

    def _generate_image(self, prompt: str) -> ImageGenerationResponse:
        response = image_generation(
            prompt=prompt,
            model=self.model,
            api_key=self.api_key,
            n=1,
            extra_headers=build_llm_extra_headers(self.additional_headers),
        )
        return ImageGenerationResponse(
            revised_prompt=response.data[0]["revised_prompt"],
            url=response.data[0]["url"],
        )

    def run(self, **kwargs: str) -> Generator[ToolResponse, None, None]:
        prompt = cast(str, kwargs["prompt"])

        # dalle3 only supports 1 image at a time, which is why we have to
        # parallelize this via threading
        results = cast(
            list[ImageGenerationResponse],
            run_functions_tuples_in_parallel(
                [(self._generate_image, (prompt,)) for _ in range(self.num_imgs)]
            ),
        )
        yield ToolResponse(
            id=IMAGE_GENERATION_RESPONSE_ID,
            response=results,
        )

    def final_result(self, *args: ToolResponse) -> JSON_ro:
        image_generation_responses = cast(
            list[ImageGenerationResponse], args[0].response
        )
        return [
            image_generation_response.dict()
            for image_generation_response in image_generation_responses
        ]
