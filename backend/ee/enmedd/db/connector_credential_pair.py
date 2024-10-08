from sqlalchemy.orm import Session

from enmedd.configs.constants import DocumentSource
from enmedd.db.models import Connector
from enmedd.db.models import ConnectorCredentialPair
from enmedd.utils.logger import setup_logger

logger = setup_logger()


def get_cc_pairs_by_source(
    source_type: DocumentSource,
    db_session: Session,
) -> list[ConnectorCredentialPair]:
    cc_pairs = (
        db_session.query(ConnectorCredentialPair)
        .join(ConnectorCredentialPair.connector)
        .filter(Connector.source == source_type)
        .all()
    )

    return cc_pairs
