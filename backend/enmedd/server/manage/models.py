from typing import Optional
from typing import TYPE_CHECKING

from pydantic import BaseModel

from enmedd.auth.schemas import UserRole
from enmedd.configs.constants import AuthType
from enmedd.indexing.models import EmbeddingModelDetail
from enmedd.server.models import FullUserSnapshot
from enmedd.server.models import InvitedUserSnapshot

if TYPE_CHECKING:
    from enmedd.db.models import User as UserModel


class VersionResponse(BaseModel):
    backend_version: str


class AuthTypeResponse(BaseModel):
    auth_type: AuthType
    # specifies whether the current auth setup requires
    # users to have verified emails
    requires_verification: bool


class UserPreferences(BaseModel):
    chosen_assistants: list[int] | None


class UserInfo(BaseModel):
    id: str
    email: str
    is_active: bool
    is_superuser: bool
    is_verified: bool
    role: UserRole
    full_name: Optional[str]
    company_name: Optional[str]
    company_email: Optional[str]
    company_billing: Optional[str]
    billing_email_address: Optional[str]
    vat: Optional[str]
    preferences: UserPreferences

    @classmethod
    def from_model(cls, user: "UserModel") -> "UserInfo":
        return cls(
            id=str(user.id),
            email=user.email,
            is_active=user.is_active,
            is_superuser=user.is_superuser,
            is_verified=user.is_verified,
            role=user.role,
            full_name=user.full_name,
            company_name=user.company_name,
            company_email=user.company_email,
            company_billing=user.company_billing,
            billing_email_address=user.billing_email_address,
            vat=user.vat,
            preferences=UserPreferences(chosen_assistants=user.chosen_assistants),
        )


class UserByEmail(BaseModel):
    user_email: str


class UserRoleResponse(BaseModel):
    role: str


class BoostDoc(BaseModel):
    document_id: str
    semantic_id: str
    link: str
    boost: int
    hidden: bool


class BoostUpdateRequest(BaseModel):
    document_id: str
    boost: int


class HiddenUpdateRequest(BaseModel):
    document_id: str
    hidden: bool


class FullModelVersionResponse(BaseModel):
    current_model: EmbeddingModelDetail
    secondary_model: EmbeddingModelDetail | None


class AllUsersResponse(BaseModel):
    accepted: list[FullUserSnapshot]
    invited: list[InvitedUserSnapshot]
    accepted_pages: int
    invited_pages: int
