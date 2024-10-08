from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import joinedload
from sqlalchemy.orm import Session

from enmedd.auth.schemas import UserRole
from enmedd.db.models import User
from enmedd.db.models import Workspace
from enmedd.db.models import Workspace__Users


def upsert_workspace(
    db_session: Session,
    id: int,
    instance_id: int,
    workspace_name: str,
    custom_logo: str | None = None,
    custom_header_logo: str | None = None,
    commit: bool = True,
) -> Workspace:
    try:
        # Check if the workspace already exists
        workspace = db_session.scalar(select(Workspace).where(Workspace.id == id))

        if workspace:
            # Update existing workspace
            workspace.instance_id = instance_id
            workspace.workspace_name = workspace_name
            workspace.custom_logo = custom_logo
            workspace.custom_header_logo = custom_header_logo
        else:
            # Create new workspace
            workspace = Workspace(
                id=id,
                instance_id=instance_id,
                workspace_name=workspace_name,
                custom_logo=custom_logo,
                custom_header_logo=custom_header_logo,
            )
            db_session.add(workspace)

        if commit:
            db_session.commit()
        else:
            # Flush the session so that the Prompt has an ID
            db_session.flush()

        return workspace

    except SQLAlchemyError as e:
        # Roll back the changes in case of an error
        db_session.rollback()
        raise Exception(f"Error upserting workspace: {str(e)}") from e


def get_workspaces_for_user(user_id: int, db_session: Session) -> list[Workspace]:
    stmt = (
        select(Workspace)
        .join(Workspace__Users)
        .join(User)
        .where(User.id == user_id)
        .options(joinedload(Workspace.users))
    )

    workspaces = db_session.scalars(stmt).all()
    return workspaces


def get_workspace_by_id(
    workspace_id: int,
    db_session: Session,
    user: User | None = None,
) -> Workspace | None:
    stmt = select(Workspace).where(Workspace.id == workspace_id)

    if user and user.role == UserRole.BASIC:
        stmt = stmt.join(Workspace__Users).join(User).where(User.id == user.id)

    workspace = db_session.scalar(stmt)
    return workspace
