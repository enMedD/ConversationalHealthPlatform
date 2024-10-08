import csv
import io
from datetime import datetime
from datetime import timedelta
from datetime import timezone
from typing import Literal

from fastapi import APIRouter
from fastapi import Depends
from fastapi import HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

import enmedd.db.models as db_models
from enmedd.auth.users import current_admin_user
from enmedd.auth.users import get_display_email
from enmedd.chat.chat_utils import create_chat_chain
from enmedd.configs.constants import MessageType
from enmedd.configs.constants import QAFeedbackType
from enmedd.db.chat import get_chat_session_by_id
from enmedd.db.engine import get_session
from enmedd.db.models import ChatSession
from enmedd.db.query_history import fetch_chat_sessions_eagerly_by_time
from enmedd.server.query_history.models import ChatSessionMinimal
from enmedd.server.query_history.models import ChatSessionSnapshot
from enmedd.server.query_history.models import MessageSnapshot
from enmedd.server.query_history.models import QuestionAnswerPairSnapshot


router = APIRouter()


def fetch_and_process_chat_session_history_minimal(
    db_session: Session,
    start: datetime,
    end: datetime,
    feedback_filter: QAFeedbackType | None = None,
    limit: int | None = 500,
) -> list[ChatSessionMinimal]:
    chat_sessions = fetch_chat_sessions_eagerly_by_time(
        start=start, end=end, db_session=db_session, limit=limit
    )

    minimal_sessions = []
    for chat_session in chat_sessions:
        if not chat_session.messages:
            continue

        first_user_message = next(
            (
                message.message
                for message in chat_session.messages
                if message.message_type == MessageType.USER
            ),
            "",
        )
        first_ai_message = next(
            (
                message.message
                for message in chat_session.messages
                if message.message_type == MessageType.ASSISTANT
            ),
            "",
        )

        has_positive_feedback = any(
            feedback.is_positive
            for message in chat_session.messages
            for feedback in message.chat_message_feedbacks
        )

        has_negative_feedback = any(
            not feedback.is_positive
            for message in chat_session.messages
            for feedback in message.chat_message_feedbacks
        )

        feedback_type: QAFeedbackType | Literal["mixed"] | None = (
            "mixed"
            if has_positive_feedback and has_negative_feedback
            else QAFeedbackType.LIKE
            if has_positive_feedback
            else QAFeedbackType.DISLIKE
            if has_negative_feedback
            else None
        )

        if feedback_filter:
            if feedback_filter == QAFeedbackType.LIKE and not has_positive_feedback:
                continue
            if feedback_filter == QAFeedbackType.DISLIKE and not has_negative_feedback:
                continue

        minimal_sessions.append(
            ChatSessionMinimal(
                id=chat_session.id,
                user_email=get_display_email(
                    chat_session.user.email if chat_session.user else None
                ),
                name=chat_session.description,
                first_user_message=first_user_message,
                first_ai_message=first_ai_message,
                assistant_name=chat_session.assistant.name,
                time_created=chat_session.time_created,
                feedback_type=feedback_type,
            )
        )

    return minimal_sessions


def fetch_and_process_chat_session_history(
    db_session: Session,
    start: datetime,
    end: datetime,
    feedback_type: QAFeedbackType | None,
    limit: int | None = 500,
) -> list[ChatSessionSnapshot]:
    chat_sessions = fetch_chat_sessions_eagerly_by_time(
        start=start, end=end, db_session=db_session, limit=limit
    )

    chat_session_snapshots = [
        snapshot_from_chat_session(chat_session=chat_session, db_session=db_session)
        for chat_session in chat_sessions
    ]

    valid_snapshots = [
        snapshot for snapshot in chat_session_snapshots if snapshot is not None
    ]

    if feedback_type:
        valid_snapshots = [
            snapshot
            for snapshot in valid_snapshots
            if any(
                message.feedback_type == feedback_type for message in snapshot.messages
            )
        ]

    return valid_snapshots


def snapshot_from_chat_session(
    chat_session: ChatSession,
    db_session: Session,
) -> ChatSessionSnapshot | None:
    try:
        # Older chats may not have the right structure
        last_message, messages = create_chat_chain(
            chat_session_id=chat_session.id, db_session=db_session
        )
        messages.append(last_message)
    except RuntimeError:
        return None

    return ChatSessionSnapshot(
        id=chat_session.id,
        user_email=get_display_email(
            chat_session.user.email if chat_session.user else None
        ),
        name=chat_session.description,
        messages=[
            MessageSnapshot.build(message)
            for message in messages
            if message.message_type != MessageType.SYSTEM
        ],
        assistant_name=chat_session.assistant.name,
        time_created=chat_session.time_created,
    )


@router.get("/admin/chat-session-history")
def get_chat_session_history(
    feedback_type: QAFeedbackType | None = None,
    start: datetime | None = None,
    end: datetime | None = None,
    _: db_models.User | None = Depends(current_admin_user),
    db_session: Session = Depends(get_session),
) -> list[ChatSessionMinimal]:
    return fetch_and_process_chat_session_history_minimal(
        db_session=db_session,
        start=start
        or (
            datetime.now(tz=timezone.utc) - timedelta(days=30)
        ),  # default is 30d lookback
        end=end or datetime.now(tz=timezone.utc),
        feedback_filter=feedback_type,
    )


@router.get("/admin/chat-session-history/{chat_session_id}")
def get_chat_session_admin(
    chat_session_id: int,
    _: db_models.User | None = Depends(current_admin_user),
    db_session: Session = Depends(get_session),
) -> ChatSessionSnapshot:
    try:
        chat_session = get_chat_session_by_id(
            chat_session_id=chat_session_id,
            user_id=None,  # view chat regardless of user
            db_session=db_session,
            include_deleted=True,
        )
    except ValueError:
        raise HTTPException(
            400, f"Chat session with id '{chat_session_id}' does not exist."
        )
    snapshot = snapshot_from_chat_session(
        chat_session=chat_session, db_session=db_session
    )

    if snapshot is None:
        raise HTTPException(
            400,
            f"Could not create snapshot for chat session with id '{chat_session_id}'",
        )

    return snapshot


@router.get("/admin/query-history-csv")
def get_query_history_as_csv(
    _: db_models.User | None = Depends(current_admin_user),
    db_session: Session = Depends(get_session),
) -> StreamingResponse:
    complete_chat_session_history = fetch_and_process_chat_session_history(
        db_session=db_session,
        start=datetime.fromtimestamp(0, tz=timezone.utc),
        end=datetime.now(tz=timezone.utc),
        feedback_type=None,
        limit=None,
    )

    question_answer_pairs: list[QuestionAnswerPairSnapshot] = []
    for chat_session_snapshot in complete_chat_session_history:
        question_answer_pairs.extend(
            QuestionAnswerPairSnapshot.from_chat_session_snapshot(chat_session_snapshot)
        )

    # Create an in-memory text stream
    stream = io.StringIO()
    writer = csv.DictWriter(
        stream, fieldnames=list(QuestionAnswerPairSnapshot.__fields__.keys())
    )
    writer.writeheader()
    for row in question_answer_pairs:
        writer.writerow(row.to_json())

    # Reset the stream's position to the start
    stream.seek(0)

    return StreamingResponse(
        iter([stream.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment;filename=enMedDAI_query_history.csv"
        },
    )
