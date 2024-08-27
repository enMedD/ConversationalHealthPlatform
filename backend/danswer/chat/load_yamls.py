from typing import cast

import yaml
from sqlalchemy.orm import Session

from danswer.configs.chat_configs import ASSISTANTS_YAML
from danswer.configs.chat_configs import MAX_CHUNKS_FED_TO_CHAT
from danswer.configs.chat_configs import PROMPTS_YAML
from danswer.db.assistant import get_prompt_by_name
from danswer.db.assistant import upsert_assistant
from danswer.db.assistant import upsert_prompt
from danswer.db.document_set import get_or_create_document_set_by_name
from danswer.db.engine import get_sqlalchemy_engine
from danswer.db.models import DocumentSet as DocumentSetDBModel
from danswer.db.models import Prompt as PromptDBModel
from danswer.search.enums import RecencyBiasSetting


def load_prompts_from_yaml(prompts_yaml: str = PROMPTS_YAML) -> None:
    with open(prompts_yaml, "r") as file:
        data = yaml.safe_load(file)

    all_prompts = data.get("prompts", [])
    with Session(get_sqlalchemy_engine()) as db_session:
        for prompt in all_prompts:
            upsert_prompt(
                user=None,
                prompt_id=prompt.get("id"),
                name=prompt["name"],
                description=prompt["description"].strip(),
                system_prompt=prompt["system"].strip(),
                task_prompt=prompt["task"].strip(),
                include_citations=prompt["include_citations"],
                datetime_aware=prompt.get("datetime_aware", True),
                default_prompt=True,
                assistants=None,
                db_session=db_session,
                commit=True,
            )


def load_assistants_from_yaml(
    assistants_yaml: str = ASSISTANTS_YAML,
    default_chunks: float = MAX_CHUNKS_FED_TO_CHAT,
) -> None:
    with open(assistants_yaml, "r") as file:
        data = yaml.safe_load(file)

    all_assistants = data.get("assistants", [])
    with Session(get_sqlalchemy_engine()) as db_session:
        for assistant in all_assistants:
            doc_set_names = assistant["document_sets"]
            doc_sets: list[DocumentSetDBModel] | None = [
                get_or_create_document_set_by_name(db_session, name)
                for name in doc_set_names
            ]

            # Assume if user hasn't set any document sets for the assistant, the user may want
            # to later attach document sets to the assistant manually, therefore, don't overwrite/reset
            # the document sets for the assistant
            if not doc_sets:
                doc_sets = None

            prompt_set_names = assistant["prompts"]
            if not prompt_set_names:
                prompts: list[PromptDBModel | None] | None = None
            else:
                prompts = [
                    get_prompt_by_name(prompt_name, user=None, db_session=db_session)
                    for prompt_name in prompt_set_names
                ]
                if any([prompt is None for prompt in prompts]):
                    raise ValueError("Invalid Assistant configs, not all prompts exist")

                if not prompts:
                    prompts = None

            p_id = assistant.get("id")
            upsert_assistant(
                user=None,
                # Negative to not conflict with existing assistants
                assistant_id=(-1 * p_id) if p_id is not None else None,
                name=assistant["name"],
                description=assistant["description"],
                num_chunks=assistant.get("num_chunks")
                if assistant.get("num_chunks") is not None
                else default_chunks,
                llm_relevance_filter=assistant.get("llm_relevance_filter"),
                starter_messages=assistant.get("starter_messages"),
                llm_filter_extraction=assistant.get("llm_filter_extraction"),
                llm_model_provider_override=None,
                llm_model_version_override=None,
                recency_bias=RecencyBiasSetting(assistant["recency_bias"]),
                prompts=cast(list[PromptDBModel] | None, prompts),
                document_sets=doc_sets,
                default_assistant=True,
                is_public=True,
                db_session=db_session,
            )


def load_chat_yamls(
    prompt_yaml: str = PROMPTS_YAML,
    assistants_yaml: str = ASSISTANTS_YAML,
) -> None:
    load_prompts_from_yaml(prompt_yaml)
    load_assistants_from_yaml(assistants_yaml)
