from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ee.enmedd.db.teamspace import fetch_teamspace
from ee.enmedd.db.teamspace import fetch_teamspaces
from ee.enmedd.db.teamspace import insert_teamspace
from ee.enmedd.db.teamspace import prepare_teamspace_for_deletion
from ee.enmedd.db.teamspace import update_teamspace
from ee.enmedd.server.teamspace.models import Teamspace
from ee.enmedd.server.teamspace.models import TeamspaceCreate
from ee.enmedd.server.teamspace.models import TeamspaceUpdate
from enmedd.auth.users import current_admin_user
from enmedd.auth.users import current_user
from enmedd.db.engine import get_session
from enmedd.db.models import User

router = APIRouter(prefix="/manage")


# TODO: move this into another directory, not under /manage
@router.get("/teamspace/{teamspace_id}")
def get_teamspace_by_id(
    teamspace_id: int,
    _: User = Depends(current_user),
    db_session: Session = Depends(get_session),
) -> Teamspace:
    db_teamspace = fetch_teamspace(db_session, teamspace_id)
    if db_teamspace is None:
        raise HTTPException(
            status_code=404, detail=f"Teamspace with id '{teamspace_id}' not found"
        )
    return Teamspace.from_model(db_teamspace)


@router.get("/admin/teamspace")
def list_teamspaces(
    _: User = Depends(current_admin_user),
    db_session: Session = Depends(get_session),
) -> list[Teamspace]:
    teamspaces = fetch_teamspaces(db_session, only_current=False)
    return [Teamspace.from_model(teamspace) for teamspace in teamspaces]


@router.post("/admin/teamspace")
def create_teamspace(
    teamspace: TeamspaceCreate,
    current_user: User = Depends(current_admin_user),
    db_session: Session = Depends(get_session),
) -> Teamspace:
    try:
        db_teamspace = insert_teamspace(
            db_session, teamspace, creator_id=current_user.id
        )
    except IntegrityError:
        raise HTTPException(
            400,
            f"Teamspace with name '{teamspace.name}' already exists. Please "
            + "choose a different name.",
        )
    return Teamspace.from_model(db_teamspace)


@router.patch("/admin/teamspace/{teamspace_id}")
def patch_teamspace(
    teamspace_id: int,
    teamspace: TeamspaceUpdate,
    _: User = Depends(current_admin_user),
    db_session: Session = Depends(get_session),
) -> Teamspace:
    try:
        return Teamspace.from_model(
            update_teamspace(db_session, teamspace_id, teamspace)
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/admin/teamspace/{teamspace_id}")
def delete_teamspace(
    teamspace_id: int,
    _: User = Depends(current_admin_user),
    db_session: Session = Depends(get_session),
) -> None:
    try:
        prepare_teamspace_for_deletion(db_session, teamspace_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
