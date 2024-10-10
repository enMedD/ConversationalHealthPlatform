from typing import Optional

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from sqlalchemy.orm import Session

from enmedd.auth.users import current_admin_user
from enmedd.auth.users import current_user
from enmedd.db.engine import get_session
from enmedd.db.models import User
from enmedd.server.settings.models import Setting
from enmedd.server.settings.store import load_settings
from enmedd.server.settings.store import store_settings


admin_router = APIRouter(prefix="/admin/settings")
basic_router = APIRouter(prefix="/settings")


@admin_router.put("")
def put_settings(
    settings: Setting,
    db: Session = Depends(get_session),
    _: User | None = Depends(current_admin_user),
    teamspace_id: Optional[int] = None,
) -> None:
    try:
        settings.check_validity()
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    try:
        store_settings(settings, db, teamspace_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@basic_router.get("")
def fetch_settings(
    db: Session = Depends(get_session),
    _: User | None = Depends(current_user),
    teamspace_id: Optional[int] = None,
) -> Setting:
    return load_settings(db, teamspace_id)
