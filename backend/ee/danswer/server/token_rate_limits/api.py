from collections import defaultdict

from fastapi import APIRouter
from fastapi import Depends
from sqlalchemy.orm import Session

from danswer.auth.users import current_admin_user
from danswer.db.engine import get_session
from danswer.db.models import User
from danswer.server.query_and_chat.token_limit import any_rate_limit_exists
from danswer.server.token_rate_limits.models import TokenRateLimitArgs
from danswer.server.token_rate_limits.models import TokenRateLimitDisplay
from ee.danswer.db.token_limit import fetch_all_teamspace_token_rate_limits
from ee.danswer.db.token_limit import fetch_all_teamspace_token_rate_limits_by_teamspace
from ee.danswer.db.token_limit import fetch_all_user_token_rate_limits
from ee.danswer.db.token_limit import insert_teamspace_token_rate_limit
from ee.danswer.db.token_limit import insert_user_token_rate_limit

router = APIRouter(prefix="/admin/token-rate-limits")


"""
Group Token Limit Settings
"""


@router.get("/teamspaces")
def get_all_teamspace_token_limit_settings(
    _: User | None = Depends(current_admin_user),
    db_session: Session = Depends(get_session),
) -> dict[str, list[TokenRateLimitDisplay]]:
    teamspaces_to_token_rate_limits = (
        fetch_all_teamspace_token_rate_limits_by_teamspace(db_session)
    )

    token_rate_limits_by_teamspace = defaultdict(list)
    for token_rate_limit, teamspace in teamspaces_to_token_rate_limits:
        token_rate_limits_by_teamspace[teamspace].append(
            TokenRateLimitDisplay.from_db(token_rate_limit)
        )

    return dict(token_rate_limits_by_teamspace)


@router.get("/teamspace/{teamspace}")
def get_teamspace_token_limit_settings(
    teamspace: int,
    _: User | None = Depends(current_admin_user),
    db_session: Session = Depends(get_session),
) -> list[TokenRateLimitDisplay]:
    return [
        TokenRateLimitDisplay.from_db(token_rate_limit)
        for token_rate_limit in fetch_all_teamspace_token_rate_limits(
            db_session, teamspace
        )
    ]


@router.post("/teamspace/{teamspace}")
def create_teamspace_token_limit_settings(
    teamspace: int,
    token_limit_settings: TokenRateLimitArgs,
    _: User | None = Depends(current_admin_user),
    db_session: Session = Depends(get_session),
) -> TokenRateLimitDisplay:
    rate_limit_display = TokenRateLimitDisplay.from_db(
        insert_teamspace_token_rate_limit(
            db_session=db_session,
            token_rate_limit_settings=token_limit_settings,
            teamspace=teamspace,
        )
    )
    # clear cache in case this was the first rate limit created
    any_rate_limit_exists.cache_clear()
    return rate_limit_display


"""
User Token Limit Settings
"""


@router.get("/users")
def get_user_token_limit_settings(
    _: User | None = Depends(current_admin_user),
    db_session: Session = Depends(get_session),
) -> list[TokenRateLimitDisplay]:
    return [
        TokenRateLimitDisplay.from_db(token_rate_limit)
        for token_rate_limit in fetch_all_user_token_rate_limits(db_session)
    ]


@router.post("/users")
def create_user_token_limit_settings(
    token_limit_settings: TokenRateLimitArgs,
    _: User | None = Depends(current_admin_user),
    db_session: Session = Depends(get_session),
) -> TokenRateLimitDisplay:
    rate_limit_display = TokenRateLimitDisplay.from_db(
        insert_user_token_rate_limit(db_session, token_limit_settings)
    )
    # clear cache in case this was the first rate limit created
    any_rate_limit_exists.cache_clear()
    return rate_limit_display
