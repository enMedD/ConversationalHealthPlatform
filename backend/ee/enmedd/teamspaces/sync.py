from sqlalchemy.orm import Session

from ee.enmedd.db.teamspace import delete_teamspace
from ee.enmedd.db.teamspace import fetch_documents_for_teamspace_paginated
from ee.enmedd.db.teamspace import fetch_teamspace
from ee.enmedd.db.teamspace import mark_teamspace_as_synced
from enmedd.access.access import get_access_for_documents
from enmedd.db.document import prepare_to_modify_documents
from enmedd.db.embedding_model import get_current_db_embedding_model
from enmedd.db.embedding_model import get_secondary_db_embedding_model
from enmedd.document_index.factory import get_default_document_index
from enmedd.document_index.interfaces import DocumentIndex
from enmedd.document_index.interfaces import UpdateRequest
from enmedd.utils.logger import setup_logger

logger = setup_logger()

_SYNC_BATCH_SIZE = 100


def _sync_teamspace_batch(
    document_ids: list[str], document_index: DocumentIndex, db_session: Session
) -> None:
    logger.debug(f"Syncing document sets for: {document_ids}")

    # Acquires a lock on the documents so that no other process can modify them
    with prepare_to_modify_documents(db_session=db_session, document_ids=document_ids):
        # get current state of document sets for these documents
        document_id_to_access = get_access_for_documents(
            document_ids=document_ids, db_session=db_session
        )

        # update Vespa
        document_index.update(
            update_requests=[
                UpdateRequest(
                    document_ids=[document_id],
                    access=document_id_to_access[document_id],
                )
                for document_id in document_ids
            ]
        )

        # Finish the transaction and release the locks
        db_session.commit()


def sync_teamspaces(teamspace_id: int, db_session: Session) -> None:
    """Sync the status of Postgres for the specified teamspace"""
    db_embedding_model = get_current_db_embedding_model(db_session)
    secondary_db_embedding_model = get_secondary_db_embedding_model(db_session)

    document_index = get_default_document_index(
        primary_index_name=db_embedding_model.index_name,
        secondary_index_name=secondary_db_embedding_model.index_name
        if secondary_db_embedding_model
        else None,
    )

    teamspace = fetch_teamspace(db_session=db_session, teamspace_id=teamspace_id)
    if teamspace is None:
        raise ValueError(f"Teamspace '{teamspace_id}' does not exist")

    cursor = None
    while True:
        # NOTE: this may miss some documents, but that is okay. Any new documents added
        # will be added with the correct group membership
        document_batch, cursor = fetch_documents_for_teamspace_paginated(
            db_session=db_session,
            teamspace_id=teamspace_id,
            last_document_id=cursor,
            limit=_SYNC_BATCH_SIZE,
        )

        _sync_teamspace_batch(
            document_ids=[document.id for document in document_batch],
            document_index=document_index,
            db_session=db_session,
        )

        if cursor is None:
            break

    if teamspace.is_up_for_deletion:
        delete_teamspace(db_session=db_session, teamspace=teamspace)
    else:
        mark_teamspace_as_synced(db_session=db_session, teamspace=teamspace)
