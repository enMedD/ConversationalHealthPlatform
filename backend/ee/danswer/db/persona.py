from uuid import UUID

from sqlalchemy.orm import Session

from danswer.db.models import Assistant__Teamspace
from danswer.db.models import Assistant__User


def make_assistant_private(
    assistant_id: int,
    user_ids: list[UUID] | None,
    group_ids: list[int] | None,
    db_session: Session,
) -> None:
    db_session.query(Assistant__User).filter(
        Assistant__User.assistant_id == assistant_id
    ).delete(synchronize_session="fetch")
    db_session.query(Assistant__Teamspace).filter(
        Assistant__Teamspace.assistant_id == assistant_id
    ).delete(synchronize_session="fetch")

    if user_ids:
        for user_uuid in user_ids:
            db_session.add(
                Assistant__User(assistant_id=assistant_id, user_id=user_uuid)
            )

    if group_ids:
        for group_id in group_ids:
            db_session.add(
                Assistant__Teamspace(assistant_id=assistant_id, teamspace_id=group_id)
            )

    db_session.commit()
