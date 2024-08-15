from sqlalchemy import distinct
from sqlalchemy.orm import Session

from enmedd_ai.configs.constants import DocumentSource
from enmedd_ai.db.models import Connector
from enmedd_ai.utils.logger import setup_logger

logger = setup_logger()


def fetch_sources_with_connectors(db_session: Session) -> list[DocumentSource]:
    sources = db_session.query(distinct(Connector.source)).all()  # type: ignore

    document_sources = [source[0] for source in sources]

    return document_sources
