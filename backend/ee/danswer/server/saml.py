import contextlib
import secrets
from typing import Any

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi import Request
from fastapi import Response
from fastapi import status
from fastapi_users import exceptions
from fastapi_users.password import PasswordHelper
from onelogin.saml2.auth import OneLogin_Saml2_Auth  # type: ignore
from pydantic import BaseModel
from pydantic import EmailStr
from sqlalchemy.orm import Session

from enmedd_ai.auth.schemas import UserCreate
from enmedd_ai.auth.schemas import UserRole
from enmedd_ai.auth.users import get_user_manager
from enmedd_ai.configs.app_configs import SESSION_EXPIRE_TIME_SECONDS
from enmedd_ai.db.auth import get_user_count
from enmedd_ai.db.auth import get_user_db
from enmedd_ai.db.engine import get_async_session
from enmedd_ai.db.engine import get_session
from enmedd_ai.db.models import User
from enmedd_ai.utils.logger import setup_logger
from ee.danswer.configs.app_configs import SAML_CONF_DIR
from ee.danswer.db.saml import expire_saml_account
from ee.danswer.db.saml import get_saml_account
from ee.danswer.db.saml import upsert_saml_account
from ee.danswer.utils.secrets import encrypt_string
from ee.danswer.utils.secrets import extract_hashed_cookie


logger = setup_logger()
router = APIRouter(prefix="/auth/saml")


async def upsert_saml_user(email: str) -> User:
    get_async_session_context = contextlib.asynccontextmanager(
        get_async_session
    )  # type:ignore
    get_user_db_context = contextlib.asynccontextmanager(get_user_db)
    get_user_manager_context = contextlib.asynccontextmanager(get_user_manager)

    async with get_async_session_context() as session:
        async with get_user_db_context(session) as user_db:
            async with get_user_manager_context(user_db) as user_manager:
                try:
                    return await user_manager.get_by_email(email)
                except exceptions.UserNotExists:
                    logger.info("Creating user from SAML login")

                user_count = await get_user_count()
                role = UserRole.ADMIN if user_count == 0 else UserRole.BASIC

                fastapi_users_pw_helper = PasswordHelper()
                password = fastapi_users_pw_helper.generate()
                hashed_pass = fastapi_users_pw_helper.hash(password)

                user: User = await user_manager.create(
                    UserCreate(
                        email=EmailStr(email),
                        password=hashed_pass,
                        is_verified=True,
                        role=role,
                    )
                )

                return user


async def prepare_from_fastapi_request(request: Request) -> dict[str, Any]:
    form_data = await request.form()
    if request.client is None:
        raise ValueError("Invalid request for SAML")

    rv: dict[str, Any] = {
        "http_host": request.client.host,
        "server_port": request.url.port,
        "script_name": request.url.path,
        "post_data": {},
        "get_data": {},
    }
    if request.query_params:
        rv["get_data"] = (request.query_params,)
    if "SAMLResponse" in form_data:
        SAMLResponse = form_data["SAMLResponse"]
        rv["post_data"]["SAMLResponse"] = SAMLResponse
    if "RelayState" in form_data:
        RelayState = form_data["RelayState"]
        rv["post_data"]["RelayState"] = RelayState
    return rv


class SAMLAuthorizeResponse(BaseModel):
    authorization_url: str


@router.get("/authorize")
async def saml_login(request: Request) -> SAMLAuthorizeResponse:
    req = await prepare_from_fastapi_request(request)
    auth = OneLogin_Saml2_Auth(req, custom_base_path=SAML_CONF_DIR)
    callback_url = auth.login()
    return SAMLAuthorizeResponse(authorization_url=callback_url)


@router.post("/callback")
async def saml_login_callback(
    request: Request,
    db_session: Session = Depends(get_session),
) -> Response:
    req = await prepare_from_fastapi_request(request)
    auth = OneLogin_Saml2_Auth(req, custom_base_path=SAML_CONF_DIR)
    auth.process_response()
    errors = auth.get_errors()
    if len(errors) != 0:
        logger.error(
            "Error when processing SAML Response: %s %s"
            % (", ".join(errors), auth.get_last_error_reason())
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Failed to parse SAML Response.",
        )

    if not auth.is_authenticated():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. User was not Authenticated.",
        )

    user_email = auth.get_attribute("email")
    if not user_email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SAML is not set up correctly, email attribute must be provided.",
        )

    user_email = user_email[0]

    user = await upsert_saml_user(email=user_email)

    # Generate a random session cookie and Sha256 encrypt before saving
    session_cookie = secrets.token_hex(16)
    saved_cookie = encrypt_string(session_cookie)

    upsert_saml_account(user_id=user.id, cookie=saved_cookie, db_session=db_session)

    # Redirect to main Danswer search page
    response = Response(status_code=status.HTTP_204_NO_CONTENT)

    response.set_cookie(
        key="session",
        value=session_cookie,
        httponly=True,
        secure=True,
        max_age=SESSION_EXPIRE_TIME_SECONDS,
    )

    return response


@router.post("/logout")
def saml_logout(
    request: Request,
    db_session: Session = Depends(get_session),
) -> None:
    saved_cookie = extract_hashed_cookie(request)

    if saved_cookie:
        saml_account = get_saml_account(cookie=saved_cookie, db_session=db_session)
        if saml_account:
            expire_saml_account(saml_account, db_session)

    return
