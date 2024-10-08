from datetime import datetime
from datetime import timezone

from sqlalchemy.orm import Session

from enmedd.background.task_utils import name_cc_cleanup_task
from enmedd.background.task_utils import name_cc_prune_task
from enmedd.background.task_utils import name_document_set_sync_task
from enmedd.configs.app_configs import MAX_PRUNING_DOCUMENT_RETRIEVAL_PER_MINUTE
from enmedd.configs.app_configs import PREVENT_SIMULTANEOUS_PRUNING
from enmedd.connectors.cross_connector_utils.rate_limit_wrapper import (
    rate_limit_builder,
)
from enmedd.connectors.interfaces import BaseConnector
from enmedd.connectors.interfaces import IdConnector
from enmedd.connectors.interfaces import LoadConnector
from enmedd.connectors.interfaces import PollConnector
from enmedd.connectors.models import Document
from enmedd.db.engine import get_db_current_time
from enmedd.db.models import Connector
from enmedd.db.models import Credential
from enmedd.db.models import DocumentSet
from enmedd.db.tasks import check_task_is_live_and_not_timed_out
from enmedd.db.tasks import get_latest_task
from enmedd.db.tasks import get_latest_task_by_type
from enmedd.server.documents.models import DeletionAttemptSnapshot
from enmedd.utils.logger import setup_logger

logger = setup_logger()


def get_deletion_status(
    connector_id: int, credential_id: int, db_session: Session
) -> DeletionAttemptSnapshot | None:
    cleanup_task_name = name_cc_cleanup_task(
        connector_id=connector_id, credential_id=credential_id
    )
    task_state = get_latest_task(task_name=cleanup_task_name, db_session=db_session)

    if not task_state:
        return None

    return DeletionAttemptSnapshot(
        connector_id=connector_id,
        credential_id=credential_id,
        status=task_state.status,
    )


def should_sync_doc_set(document_set: DocumentSet, db_session: Session) -> bool:
    if document_set.is_up_to_date:
        return False

    task_name = name_document_set_sync_task(document_set.id)
    latest_sync = get_latest_task(task_name, db_session)

    if latest_sync and check_task_is_live_and_not_timed_out(latest_sync, db_session):
        logger.info(f"Document set '{document_set.id}' is already syncing. Skipping.")
        return False

    logger.info(f"Document set {document_set.id} syncing now!")
    return True


def should_prune_cc_pair(
    connector: Connector, credential: Credential, db_session: Session
) -> bool:
    if not connector.prune_freq:
        return False

    pruning_task_name = name_cc_prune_task(
        connector_id=connector.id, credential_id=credential.id
    )
    last_pruning_task = get_latest_task(pruning_task_name, db_session)
    current_db_time = get_db_current_time(db_session)

    if not last_pruning_task:
        time_since_initialization = current_db_time - connector.time_created
        if time_since_initialization.total_seconds() >= connector.prune_freq:
            return True
        return False

    if PREVENT_SIMULTANEOUS_PRUNING:
        pruning_type_task_name = name_cc_prune_task()
        last_pruning_type_task = get_latest_task_by_type(
            pruning_type_task_name, db_session
        )

        if last_pruning_type_task and check_task_is_live_and_not_timed_out(
            last_pruning_type_task, db_session
        ):
            logger.info("Another Connector is already pruning. Skipping.")
            return False

    if check_task_is_live_and_not_timed_out(last_pruning_task, db_session):
        logger.info(f"Connector '{connector.name}' is already pruning. Skipping.")
        return False

    if not last_pruning_task.start_time:
        return False

    time_since_last_pruning = current_db_time - last_pruning_task.start_time
    return time_since_last_pruning.total_seconds() >= connector.prune_freq


def document_batch_to_ids(doc_batch: list[Document]) -> set[str]:
    return {doc.id for doc in doc_batch}


def extract_ids_from_runnable_connector(runnable_connector: BaseConnector) -> set[str]:
    """
    If the PruneConnector hasnt been implemented for the given connector, just pull
    all docs using the load_from_state and grab out the IDs
    """
    all_connector_doc_ids: set[str] = set()

    doc_batch_generator = None
    if isinstance(runnable_connector, IdConnector):
        all_connector_doc_ids = runnable_connector.retrieve_all_source_ids()
    elif isinstance(runnable_connector, LoadConnector):
        doc_batch_generator = runnable_connector.load_from_state()
    elif isinstance(runnable_connector, PollConnector):
        start = datetime(1970, 1, 1, tzinfo=timezone.utc).timestamp()
        end = datetime.now(timezone.utc).timestamp()
        doc_batch_generator = runnable_connector.poll_source(start=start, end=end)
    else:
        raise RuntimeError("Pruning job could not find a valid runnable_connector.")

    if doc_batch_generator:
        doc_batch_processing_func = document_batch_to_ids
        if MAX_PRUNING_DOCUMENT_RETRIEVAL_PER_MINUTE:
            doc_batch_processing_func = rate_limit_builder(
                max_calls=MAX_PRUNING_DOCUMENT_RETRIEVAL_PER_MINUTE, period=60
            )(document_batch_to_ids)
        for doc_batch in doc_batch_generator:
            all_connector_doc_ids.update(doc_batch_processing_func(doc_batch))

    return all_connector_doc_ids
