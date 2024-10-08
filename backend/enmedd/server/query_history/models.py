from datetime import datetime
from typing import Literal

from pydantic import BaseModel

from enmedd.auth.users import get_display_email
from enmedd.configs.constants import MessageType
from enmedd.configs.constants import QAFeedbackType
from enmedd.db.models import ChatMessage
from enmedd.server.models import MinimalTeamspaceSnapshot


class AbridgedSearchDoc(BaseModel):
    """A subset of the info present in `SearchDoc`"""

    document_id: str
    semantic_identifier: str
    link: str | None


class MessageSnapshot(BaseModel):
    message: str
    message_type: MessageType
    documents: list[AbridgedSearchDoc]
    feedback_type: QAFeedbackType | None
    feedback_text: str | None
    time_created: datetime

    @classmethod
    def build(cls, message: ChatMessage) -> "MessageSnapshot":
        latest_messages_feedback_obj = (
            message.chat_message_feedbacks[-1]
            if len(message.chat_message_feedbacks) > 0
            else None
        )
        feedback_type = (
            (
                QAFeedbackType.LIKE
                if latest_messages_feedback_obj.is_positive
                else QAFeedbackType.DISLIKE
            )
            if latest_messages_feedback_obj
            else None
        )
        feedback_text = (
            latest_messages_feedback_obj.feedback_text
            if latest_messages_feedback_obj
            else None
        )
        return cls(
            message=message.message,
            message_type=message.message_type,
            documents=[
                AbridgedSearchDoc(
                    document_id=document.document_id,
                    semantic_identifier=document.semantic_id,
                    link=document.link,
                )
                for document in message.search_docs
            ],
            feedback_type=feedback_type,
            feedback_text=feedback_text,
            time_created=message.time_sent,
        )


class ChatSessionMinimal(BaseModel):
    id: int
    user_email: str
    name: str | None
    first_user_message: str
    first_ai_message: str
    assistant_name: str
    time_created: datetime
    feedback_type: QAFeedbackType | Literal["mixed"] | None
    groups: list[MinimalTeamspaceSnapshot] | None


class ChatSessionSnapshot(BaseModel):
    id: int
    user_email: str
    name: str | None
    messages: list[MessageSnapshot]
    assistant_name: str
    time_created: datetime
    groups: list[MinimalTeamspaceSnapshot] | None


class QuestionAnswerPairSnapshot(BaseModel):
    user_message: str
    ai_response: str
    retrieved_documents: list[AbridgedSearchDoc]
    feedback_type: QAFeedbackType | None
    feedback_text: str | None
    assistant_name: str
    user_email: str
    time_created: datetime

    @classmethod
    def from_chat_session_snapshot(
        cls,
        chat_session_snapshot: ChatSessionSnapshot,
    ) -> list["QuestionAnswerPairSnapshot"]:
        message_pairs: list[tuple[MessageSnapshot, MessageSnapshot]] = []
        for ind in range(1, len(chat_session_snapshot.messages), 2):
            message_pairs.append(
                (
                    chat_session_snapshot.messages[ind - 1],
                    chat_session_snapshot.messages[ind],
                )
            )

        return [
            cls(
                user_message=user_message.message,
                ai_response=ai_message.message,
                retrieved_documents=ai_message.documents,
                feedback_type=ai_message.feedback_type,
                feedback_text=ai_message.feedback_text,
                assistant_name=chat_session_snapshot.assistant_name,
                user_email=get_display_email(chat_session_snapshot.user_email),
                time_created=user_message.time_created,
            )
            for user_message, ai_message in message_pairs
        ]

    def to_json(self) -> dict[str, str]:
        return {
            "user_message": self.user_message,
            "ai_response": self.ai_response,
            "retrieved_documents": "|".join(
                [
                    doc.link or doc.semantic_identifier
                    for doc in self.retrieved_documents
                ]
            ),
            "feedback_type": self.feedback_type.value if self.feedback_type else "",
            "feedback_text": self.feedback_text or "",
            "assistant_name": self.assistant_name,
            "user_email": self.user_email,
            "time_created": str(self.time_created),
        }
