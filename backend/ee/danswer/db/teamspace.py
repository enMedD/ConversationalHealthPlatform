from collections.abc import Sequence
from operator import and_
from uuid import UUID

from sqlalchemy import func
from sqlalchemy import select
from sqlalchemy.orm import Session

from danswer.db.models import ConnectorCredentialPair
from danswer.db.models import Document
from danswer.db.models import DocumentByConnectorCredentialPair
from danswer.db.models import Teamspace
from danswer.db.models import Teamspace__ConnectorCredentialPair
from danswer.db.models import TokenRateLimit__Teamspace
from danswer.db.models import User
from danswer.db.models import User__Teamspace
from danswer.server.documents.models import ConnectorCredentialPairIdentifier
from ee.danswer.server.teamspace.models import TeamspaceCreate
from ee.danswer.server.teamspace.models import TeamspaceUpdate


def fetch_teamspace(db_session: Session, teamspace_id: int) -> Teamspace | None:
    stmt = select(Teamspace).where(Teamspace.id == teamspace_id)
    return db_session.scalar(stmt)


def fetch_teamspaces(
    db_session: Session, only_current: bool = True
) -> Sequence[Teamspace]:
    stmt = select(Teamspace)
    if only_current:
        stmt = stmt.where(Teamspace.is_up_to_date == True)  # noqa: E712
    return db_session.scalars(stmt).all()


def fetch_teamspaces_for_user(
    db_session: Session, user_id: UUID
) -> Sequence[Teamspace]:
    stmt = (
        select(Teamspace)
        .join(User__Teamspace, User__Teamspace.teamspace_id == Teamspace.id)
        .join(User, User.id == User__Teamspace.user_id)  # type: ignore
        .where(User.id == user_id)  # type: ignore
    )
    return db_session.scalars(stmt).all()


def fetch_documents_for_teamspace_paginated(
    db_session: Session,
    teamspace_id: int,
    last_document_id: str | None = None,
    limit: int = 100,
) -> tuple[Sequence[Document], str | None]:
    stmt = (
        select(Document)
        .join(
            DocumentByConnectorCredentialPair,
            Document.id == DocumentByConnectorCredentialPair.id,
        )
        .join(
            ConnectorCredentialPair,
            and_(
                DocumentByConnectorCredentialPair.connector_id
                == ConnectorCredentialPair.connector_id,
                DocumentByConnectorCredentialPair.credential_id
                == ConnectorCredentialPair.credential_id,
            ),
        )
        .join(
            Teamspace__ConnectorCredentialPair,
            Teamspace__ConnectorCredentialPair.cc_pair_id == ConnectorCredentialPair.id,
        )
        .join(
            Teamspace,
            Teamspace__ConnectorCredentialPair.teamspace_id == Teamspace.id,
        )
        .where(Teamspace.id == teamspace_id)
        .order_by(Document.id)
        .limit(limit)
    )
    if last_document_id is not None:
        stmt = stmt.where(Document.id > last_document_id)
    stmt = stmt.distinct()

    documents = db_session.scalars(stmt).all()
    return documents, documents[-1].id if documents else None


def fetch_teamspaces_for_documents(
    db_session: Session,
    document_ids: list[str],
    cc_pair_to_delete: ConnectorCredentialPairIdentifier | None = None,
) -> Sequence[tuple[int, list[str]]]:
    stmt = (
        select(Document.id, func.array_agg(Teamspace.name))
        .join(
            Teamspace__ConnectorCredentialPair,
            Teamspace.id == Teamspace__ConnectorCredentialPair.teamspace_id,
        )
        .join(
            ConnectorCredentialPair,
            ConnectorCredentialPair.id == Teamspace__ConnectorCredentialPair.cc_pair_id,
        )
        .join(
            DocumentByConnectorCredentialPair,
            and_(
                DocumentByConnectorCredentialPair.connector_id
                == ConnectorCredentialPair.connector_id,
                DocumentByConnectorCredentialPair.credential_id
                == ConnectorCredentialPair.credential_id,
            ),
        )
        .join(Document, Document.id == DocumentByConnectorCredentialPair.id)
        .where(Document.id.in_(document_ids))
        .where(Teamspace__ConnectorCredentialPair.is_current == True)  # noqa: E712
        .group_by(Document.id)
    )

    # pretend that the specified cc pair doesn't exist
    if cc_pair_to_delete is not None:
        stmt = stmt.where(
            and_(
                ConnectorCredentialPair.connector_id != cc_pair_to_delete.connector_id,
                ConnectorCredentialPair.credential_id
                != cc_pair_to_delete.credential_id,
            )
        )

    return db_session.execute(stmt).all()  # type: ignore


def _check_teamspace_is_modifiable(teamspace: Teamspace) -> None:
    if not teamspace.is_up_to_date:
        raise ValueError(
            "Specified teamspace is currently syncing. Wait until the current "
            "sync has finished before editing."
        )


def _add_user__teamspace_relationships__no_commit(
    db_session: Session, teamspace_id: int, user_ids: list[UUID]
) -> list[User__Teamspace]:
    """NOTE: does not commit the transaction."""
    relationships = [
        User__Teamspace(user_id=user_id, teamspace_id=teamspace_id)
        for user_id in user_ids
    ]
    db_session.add_all(relationships)
    return relationships


def _add_teamspace__cc_pair_relationships__no_commit(
    db_session: Session, teamspace_id: int, cc_pair_ids: list[int]
) -> list[Teamspace__ConnectorCredentialPair]:
    """NOTE: does not commit the transaction."""
    relationships = [
        Teamspace__ConnectorCredentialPair(
            teamspace_id=teamspace_id, cc_pair_id=cc_pair_id
        )
        for cc_pair_id in cc_pair_ids
    ]
    db_session.add_all(relationships)
    return relationships


def insert_teamspace(db_session: Session, teamspace: TeamspaceCreate) -> Teamspace:
    db_teamspace = Teamspace(name=teamspace.name)
    db_session.add(db_teamspace)
    db_session.flush()  # give the group an ID

    _add_user__teamspace_relationships__no_commit(
        db_session=db_session,
        teamspace_id=db_teamspace.id,
        user_ids=teamspace.user_ids,
    )
    _add_teamspace__cc_pair_relationships__no_commit(
        db_session=db_session,
        teamspace_id=db_teamspace.id,
        cc_pair_ids=teamspace.cc_pair_ids,
    )

    db_session.commit()
    return db_teamspace


def _cleanup_user__teamspace_relationships__no_commit(
    db_session: Session, teamspace_id: int
) -> None:
    """NOTE: does not commit the transaction."""
    user__teamspace_relationships = db_session.scalars(
        select(User__Teamspace).where(User__Teamspace.teamspace_id == teamspace_id)
    ).all()
    for user__teamspace_relationship in user__teamspace_relationships:
        db_session.delete(user__teamspace_relationship)


def _mark_teamspace__cc_pair_relationships_outdated__no_commit(
    db_session: Session, teamspace_id: int
) -> None:
    """NOTE: does not commit the transaction."""
    teamspace__cc_pair_relationships = db_session.scalars(
        select(Teamspace__ConnectorCredentialPair).where(
            Teamspace__ConnectorCredentialPair.teamspace_id == teamspace_id
        )
    )
    for teamspace__cc_pair_relationship in teamspace__cc_pair_relationships:
        teamspace__cc_pair_relationship.is_current = False


def update_teamspace(
    db_session: Session, teamspace_id: int, teamspace: TeamspaceUpdate
) -> Teamspace:
    stmt = select(Teamspace).where(Teamspace.id == teamspace_id)
    db_teamspace = db_session.scalar(stmt)
    if db_teamspace is None:
        raise ValueError(f"Teamspace with id '{teamspace_id}' not found")

    _check_teamspace_is_modifiable(db_teamspace)

    existing_cc_pairs = db_teamspace.cc_pairs
    cc_pairs_updated = set([cc_pair.id for cc_pair in existing_cc_pairs]) != set(
        teamspace.cc_pair_ids
    )
    users_updated = set([user.id for user in db_teamspace.users]) != set(
        teamspace.user_ids
    )

    if users_updated:
        _cleanup_user__teamspace_relationships__no_commit(
            db_session=db_session, teamspace_id=teamspace_id
        )
        _add_user__teamspace_relationships__no_commit(
            db_session=db_session,
            teamspace_id=teamspace_id,
            user_ids=teamspace.user_ids,
        )
    if cc_pairs_updated:
        _mark_teamspace__cc_pair_relationships_outdated__no_commit(
            db_session=db_session, teamspace_id=teamspace_id
        )
        _add_teamspace__cc_pair_relationships__no_commit(
            db_session=db_session,
            teamspace_id=db_teamspace.id,
            cc_pair_ids=teamspace.cc_pair_ids,
        )

    # only needs to sync with Vespa if the cc_pairs have been updated
    if cc_pairs_updated:
        db_teamspace.is_up_to_date = False

    db_session.commit()
    return db_teamspace


def _cleanup_token_rate_limit__teamspace_relationships__no_commit(
    db_session: Session, teamspace_id: int
) -> None:
    """NOTE: does not commit the transaction."""
    token_rate_limit__teamspace_relationships = db_session.scalars(
        select(TokenRateLimit__Teamspace).where(
            TokenRateLimit__Teamspace.teamspace_id == teamspace_id
        )
    ).all()
    for (
        token_rate_limit__teamspace_relationship
    ) in token_rate_limit__teamspace_relationships:
        db_session.delete(token_rate_limit__teamspace_relationship)


def prepare_teamspace_for_deletion(db_session: Session, teamspace_id: int) -> None:
    stmt = select(Teamspace).where(Teamspace.id == teamspace_id)
    db_teamspace = db_session.scalar(stmt)
    if db_teamspace is None:
        raise ValueError(f"Teamspace with id '{teamspace_id}' not found")

    _check_teamspace_is_modifiable(db_teamspace)

    _cleanup_user__teamspace_relationships__no_commit(
        db_session=db_session, teamspace_id=teamspace_id
    )
    _mark_teamspace__cc_pair_relationships_outdated__no_commit(
        db_session=db_session, teamspace_id=teamspace_id
    )
    _cleanup_token_rate_limit__teamspace_relationships__no_commit(
        db_session=db_session, teamspace_id=teamspace_id
    )

    db_teamspace.is_up_to_date = False
    db_teamspace.is_up_for_deletion = True
    db_session.commit()


def _cleanup_teamspace__cc_pair_relationships__no_commit(
    db_session: Session, teamspace_id: int, outdated_only: bool
) -> None:
    """NOTE: does not commit the transaction."""
    stmt = select(Teamspace__ConnectorCredentialPair).where(
        Teamspace__ConnectorCredentialPair.teamspace_id == teamspace_id
    )
    if outdated_only:
        stmt = stmt.where(
            Teamspace__ConnectorCredentialPair.is_current == False  # noqa: E712
        )
    teamspace__cc_pair_relationships = db_session.scalars(stmt)
    for teamspace__cc_pair_relationship in teamspace__cc_pair_relationships:
        db_session.delete(teamspace__cc_pair_relationship)


def mark_teamspace_as_synced(db_session: Session, teamspace: Teamspace) -> None:
    # cleanup outdated relationships
    _cleanup_teamspace__cc_pair_relationships__no_commit(
        db_session=db_session, teamspace_id=teamspace.id, outdated_only=True
    )
    teamspace.is_up_to_date = True
    db_session.commit()


def delete_teamspace(db_session: Session, teamspace: Teamspace) -> None:
    _cleanup_user__teamspace_relationships__no_commit(
        db_session=db_session, teamspace_id=teamspace.id
    )
    _cleanup_teamspace__cc_pair_relationships__no_commit(
        db_session=db_session,
        teamspace_id=teamspace.id,
        outdated_only=False,
    )

    # need to flush so that we don't get a foreign key error when deleting the teamspace row
    db_session.flush()

    db_session.delete(teamspace)
    db_session.commit()
