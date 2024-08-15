from sqlalchemy.orm import Session

from enmedd_ai.configs.app_configs import DISABLE_GENERATIVE_AI
from enmedd_ai.configs.model_configs import FAST_GEN_AI_MODEL_VERSION
from enmedd_ai.configs.model_configs import GEN_AI_API_ENDPOINT
from enmedd_ai.configs.model_configs import GEN_AI_API_KEY
from enmedd_ai.configs.model_configs import GEN_AI_API_VERSION
from enmedd_ai.configs.model_configs import GEN_AI_MODEL_PROVIDER
from enmedd_ai.configs.model_configs import GEN_AI_MODEL_VERSION
from enmedd_ai.db.llm import fetch_existing_llm_providers
from enmedd_ai.db.llm import update_default_provider
from enmedd_ai.db.llm import upsert_llm_provider
from enmedd_ai.llm.llm_provider_options import AZURE_PROVIDER_NAME
from enmedd_ai.llm.llm_provider_options import BEDROCK_PROVIDER_NAME
from enmedd_ai.llm.llm_provider_options import fetch_available_well_known_llms
from enmedd_ai.server.manage.llm.models import LLMProviderUpsertRequest
from enmedd_ai.utils.logger import setup_logger


logger = setup_logger()


def load_llm_providers(db_session: Session) -> None:
    existing_providers = fetch_existing_llm_providers(db_session)
    if existing_providers:
        return

    if not GEN_AI_API_KEY or DISABLE_GENERATIVE_AI:
        return

    well_known_provider_name_to_provider = {
        provider.name: provider
        for provider in fetch_available_well_known_llms()
        if provider.name != BEDROCK_PROVIDER_NAME
    }

    if GEN_AI_MODEL_PROVIDER not in well_known_provider_name_to_provider:
        logger.error(f"Cannot auto-transition LLM provider: {GEN_AI_MODEL_PROVIDER}")
        return None

    # Azure provider requires custom model names,
    # OpenAI / anthropic can just use the defaults
    model_names = (
        [
            name
            for name in [
                GEN_AI_MODEL_VERSION,
                FAST_GEN_AI_MODEL_VERSION,
            ]
            if name
        ]
        if GEN_AI_MODEL_PROVIDER == AZURE_PROVIDER_NAME
        else None
    )

    well_known_provider = well_known_provider_name_to_provider[GEN_AI_MODEL_PROVIDER]
    llm_provider_request = LLMProviderUpsertRequest(
        name=well_known_provider.display_name,
        provider=GEN_AI_MODEL_PROVIDER,
        api_key=GEN_AI_API_KEY,
        api_base=GEN_AI_API_ENDPOINT,
        api_version=GEN_AI_API_VERSION,
        custom_config={},
        default_model_name=(
            GEN_AI_MODEL_VERSION
            or well_known_provider.default_model
            or well_known_provider.llm_names[0]
        ),
        fast_default_model_name=(
            FAST_GEN_AI_MODEL_VERSION or well_known_provider.default_fast_model
        ),
        model_names=model_names,
    )
    llm_provider = upsert_llm_provider(db_session, llm_provider_request)
    update_default_provider(db_session, llm_provider.id)
    logger.info(
        f"Migrated LLM provider from env variables for provider '{GEN_AI_MODEL_PROVIDER}'"
    )
