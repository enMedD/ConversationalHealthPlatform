from typing import Optional

from fastapi import Depends
from fastapi import HTTPException
from sqlalchemy.orm import Session

from enmedd.db.engine import get_session
from enmedd.db.models import TeamspaceSettings
from enmedd.db.models import WorkspaceSettings
from enmedd.server.settings.models import PageType
from enmedd.server.settings.models import Setting


def load_settings(
    db: Session = Depends(get_session), teamspace_id: Optional[int] = None
) -> Setting:
    if teamspace_id:
        settings_record = (
            db.query(TeamspaceSettings).filter_by(teamspace_id=teamspace_id).first()
        )
    else:
        settings_record = db.query(WorkspaceSettings).first()

    if not settings_record:
        settings_record = (
            TeamspaceSettings(
                chat_page_enabled=True,
                search_page_enabled=True,
                default_page=PageType.CHAT,
                maximum_chat_retention_days=None,
                teamspace_id=teamspace_id,
            )
            if teamspace_id
            else WorkspaceSettings(
                chat_page_enabled=True,
                search_page_enabled=True,
                default_page=PageType.CHAT,
                maximum_chat_retention_days=None,
            )
        )
        db.add(settings_record)
        db.commit()
        db.refresh(settings_record)

    return Setting(
        chat_page_enabled=settings_record.chat_page_enabled,
        search_page_enabled=settings_record.search_page_enabled,
        default_page=settings_record.default_page,
        maximum_chat_retention_days=settings_record.maximum_chat_retention_days,
    )


def store_settings(
    settings: Setting,
    db: Session = Depends(get_session),
    teamspace_id: Optional[int] = None,
) -> None:
    if teamspace_id:
        settings_record = (
            db.query(TeamspaceSettings).filter_by(teamspace_id=teamspace_id).first()
        )
    else:
        settings_record = db.query(WorkspaceSettings).first()

    if settings_record:
        settings_record.chat_page_enabled = settings.chat_page_enabled
        settings_record.search_page_enabled = settings.search_page_enabled
        settings_record.default_page = settings.default_page
        settings_record.maximum_chat_retention_days = (
            settings.maximum_chat_retention_days
        )
    else:
        new_record = (
            TeamspaceSettings(
                chat_page_enabled=settings.chat_page_enabled,
                search_page_enabled=settings.search_page_enabled,
                default_page=settings.default_page,
                maximum_chat_retention_days=settings.maximum_chat_retention_days,
                teamspace_id=teamspace_id,
            )
            if teamspace_id
            else WorkspaceSettings(
                chat_page_enabled=settings.chat_page_enabled,
                search_page_enabled=settings.search_page_enabled,
                default_page=settings.default_page,
                maximum_chat_retention_days=settings.maximum_chat_retention_days,
            )
        )
        db.add(new_record)

    try:
        db.commit()
    except Exception:
        db.rollback()
        raise HTTPException(status_code=500, detail="Failed to store settings.")
