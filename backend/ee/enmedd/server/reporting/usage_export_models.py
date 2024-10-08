from datetime import datetime
from enum import Enum

from pydantic import BaseModel

from enmedd.auth.schemas import UserStatus


class FlowType(str, Enum):
    CHAT = "chat"
    SEARCH = "search"


class ChatMessageSkeleton(BaseModel):
    message_id: int
    chat_session_id: int
    user_id: str | None
    flow_type: FlowType
    time_sent: datetime


class UserSkeleton(BaseModel):
    user_id: str
    status: UserStatus


class UsageReportMetadata(BaseModel):
    report_name: str
    requestor: str | None
    time_created: datetime
    period_from: datetime | None  # None = All time
    period_to: datetime | None
