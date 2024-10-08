from sqlalchemy.orm import Session

from enmedd.background.task_name_builders import name_chat_ttl_task
from enmedd.background.task_name_builders import name_teamspace_sync_task
from enmedd.db.models import Teamspace
from enmedd.db.tasks import check_task_is_live_and_not_timed_out
from enmedd.db.tasks import get_latest_task
from enmedd.utils.logger import setup_logger

logger = setup_logger()


def should_sync_teamspaces(teamspace: Teamspace, db_session: Session) -> bool:
    if teamspace.is_up_to_date:
        return False
    task_name = name_teamspace_sync_task(teamspace.id)
    latest_sync = get_latest_task(task_name, db_session)

    if latest_sync and check_task_is_live_and_not_timed_out(latest_sync, db_session):
        logger.info("TTL check is already being performed. Skipping.")
        return False
    return True


def should_perform_chat_ttl_check(
    retention_limit_days: int | None, db_session: Session
) -> bool:
    # TODO: make this a check for None and add behavior for 0 day TTL
    if not retention_limit_days:
        return False

    task_name = name_chat_ttl_task(retention_limit_days)
    latest_task = get_latest_task(task_name, db_session)
    if not latest_task:
        return True

    if latest_task and check_task_is_live_and_not_timed_out(latest_task, db_session):
        logger.info("TTL check is already being performed. Skipping.")
        return False
    return True
