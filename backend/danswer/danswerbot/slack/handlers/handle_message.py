import datetime
import logging
from typing import cast

from slack_sdk import WebClient
from slack_sdk.errors import SlackApiError
from sqlalchemy.orm import Session

from danswer.configs.danswerbot_configs import DANSWER_BOT_FEEDBACK_REMINDER
from danswer.configs.danswerbot_configs import DANSWER_REACT_EMOJI
from danswer.danswerbot.slack.blocks import get_feedback_reminder_blocks
from danswer.danswerbot.slack.constants import SLACK_CHANNEL_ID
from danswer.danswerbot.slack.handlers.handle_regular_answer import (
    handle_regular_answer,
)
from danswer.danswerbot.slack.handlers.handle_standard_answers import (
    handle_standard_answers,
)
from danswer.danswerbot.slack.models import SlackMessageInfo
from danswer.danswerbot.slack.utils import ChannelIdAdapter
from danswer.danswerbot.slack.utils import fetch_user_ids_from_emails
from danswer.danswerbot.slack.utils import fetch_user_ids_from_groups
from danswer.danswerbot.slack.utils import respond_in_thread
from danswer.danswerbot.slack.utils import slack_usage_report
from danswer.danswerbot.slack.utils import update_emote_react
from danswer.db.engine import get_sqlalchemy_engine
from danswer.db.models import SlackBotConfig
from danswer.utils.logger import setup_logger

logger_base = setup_logger()


def send_msg_ack_to_user(details: SlackMessageInfo, client: WebClient) -> None:
    if details.is_bot_msg and details.sender:
        respond_in_thread(
            client=client,
            channel=details.channel_to_respond,
            thread_ts=details.msg_to_respond,
            receiver_ids=[details.sender],
            text="Hi, we're evaluating your query :face_with_monocle:",
        )
        return

    update_emote_react(
        emoji=DANSWER_REACT_EMOJI,
        channel=details.channel_to_respond,
        message_ts=details.msg_to_respond,
        remove=False,
        client=client,
    )


def schedule_feedback_reminder(
    details: SlackMessageInfo, include_followup: bool, client: WebClient
) -> str | None:
    logger = cast(
        logging.Logger,
        ChannelIdAdapter(
            logger_base, extra={SLACK_CHANNEL_ID: details.channel_to_respond}
        ),
    )
    if not DANSWER_BOT_FEEDBACK_REMINDER:
        logger.info("Scheduled feedback reminder disabled...")
        return None

    try:
        permalink = client.chat_getPermalink(
            channel=details.channel_to_respond,
            message_ts=details.msg_to_respond,  # type:ignore
        )
    except SlackApiError as e:
        logger.error(f"Unable to generate the feedback reminder permalink: {e}")
        return None

    now = datetime.datetime.now()
    future = now + datetime.timedelta(minutes=DANSWER_BOT_FEEDBACK_REMINDER)

    try:
        response = client.chat_scheduleMessage(
            channel=details.sender,  # type:ignore
            post_at=int(future.timestamp()),
            blocks=[
                get_feedback_reminder_blocks(
                    thread_link=permalink.data["permalink"],  # type:ignore
                    include_followup=include_followup,
                )
            ],
            text="",
        )
        logger.info("Scheduled feedback reminder configured")
        return response.data["scheduled_message_id"]  # type:ignore
    except SlackApiError as e:
        logger.error(f"Unable to generate the feedback reminder message: {e}")
        return None


def remove_scheduled_feedback_reminder(
    client: WebClient, channel: str | None, msg_id: str
) -> None:
    logger = cast(
        logging.Logger,
        ChannelIdAdapter(logger_base, extra={SLACK_CHANNEL_ID: channel}),
    )

    try:
        client.chat_deleteScheduledMessage(
            channel=channel, scheduled_message_id=msg_id  # type:ignore
        )
        logger.info("Scheduled feedback reminder deleted")
    except SlackApiError as e:
        if e.response["error"] == "invalid_scheduled_message_id":
            logger.info(
                "Unable to delete the scheduled message. It must have already been posted"
            )


def handle_message(
    message_info: SlackMessageInfo,
    slack_bot_config: SlackBotConfig | None,
    client: WebClient,
    feedback_reminder_id: str | None,
) -> bool:
    """Potentially respond to the user message depending on filters and if an answer was generated

    Returns True if need to respond with an additional message to the user(s) after this
    function is finished. True indicates an unexpected failure that needs to be communicated
    Query thrown out by filters due to config does not count as a failure that should be notified
    Danswer failing to answer/retrieve docs does count and should be notified
    """
    channel = message_info.channel_to_respond

    logger = cast(
        logging.Logger,
        ChannelIdAdapter(logger_base, extra={SLACK_CHANNEL_ID: channel}),
    )

    messages = message_info.thread_messages
    sender_id = message_info.sender
    bypass_filters = message_info.bypass_filters
    is_bot_msg = message_info.is_bot_msg
    is_bot_dm = message_info.is_bot_dm

    action = "slack_message"
    if is_bot_msg:
        action = "slack_slash_message"
    elif bypass_filters:
        action = "slack_tag_message"
    elif is_bot_dm:
        action = "slack_dm_message"
    slack_usage_report(action=action, sender_id=sender_id, client=client)

    document_set_names: list[str] | None = None
    persona = slack_bot_config.persona if slack_bot_config else None
    prompt = None
    if persona:
        document_set_names = [
            document_set.name for document_set in persona.document_sets
        ]
        prompt = persona.prompts[0] if persona.prompts else None

    respond_tag_only = False
    respond_member_group_list = None

    channel_conf = None
    if slack_bot_config and slack_bot_config.channel_config:
        channel_conf = slack_bot_config.channel_config
        if not bypass_filters and "answer_filters" in channel_conf:
            if (
                "questionmark_prefilter" in channel_conf["answer_filters"]
                and "?" not in messages[-1].message
            ):
                logger.info(
                    "Skipping message since it does not contain a question mark"
                )
                return False

        logger.info(
            "Found slack bot config for channel. Restricting bot to use document "
            f"sets: {document_set_names}, "
            f"validity checks enabled: {channel_conf.get('answer_filters', 'NA')}"
        )

        respond_tag_only = channel_conf.get("respond_tag_only") or False
        respond_member_group_list = channel_conf.get("respond_member_group_list", None)

    if respond_tag_only and not bypass_filters:
        logger.info(
            "Skipping message since the channel is configured such that "
            "DanswerBot only responds to tags"
        )
        return False

    # List of user id to send message to, if None, send to everyone in channel
    send_to: list[str] | None = None
    missing_users: list[str] | None = None
    if respond_member_group_list:
        send_to, missing_ids = fetch_user_ids_from_emails(
            respond_member_group_list, client
        )

        user_ids, missing_users = fetch_user_ids_from_groups(missing_ids, client)
        send_to = list(set(send_to + user_ids)) if send_to else user_ids

        if missing_users:
            logger.warning(f"Failed to find these users/groups: {missing_users}")

    # If configured to respond to team members only, then cannot be used with a /DanswerBot command
    # which would just respond to the sender
    if send_to and is_bot_msg:
        if sender_id:
            respond_in_thread(
                client=client,
                channel=channel,
                receiver_ids=[sender_id],
                text="The CHP Bot slash command is not enabled for this channel",
                thread_ts=None,
            )

    try:
        send_msg_ack_to_user(message_info, client)
    except SlackApiError as e:
        logger.error(f"Was not able to react to user message due to: {e}")

    @retry(
        tries=num_retries,
        delay=0.25,
        backoff=2,
        logger=logger,
    )
    @rate_limits(client=client, channel=channel, thread_ts=message_ts_to_respond_to)
    def _get_answer(new_message_request: DirectQARequest) -> OneShotQAResponse | None:
        action = "slack_message"
        if is_bot_msg:
            action = "slack_slash_message"
        elif bypass_filters:
            action = "slack_tag_message"
        elif is_bot_dm:
            action = "slack_dm_message"

        slack_usage_report(action=action, sender_id=sender_id, client=client)

        max_document_tokens: int | None = None
        max_history_tokens: int | None = None

        with Session(get_sqlalchemy_engine()) as db_session:
            if len(new_message_request.messages) > 1:
                persona = cast(
                    Persona,
                    fetch_persona_by_id(db_session, new_message_request.persona_id),
                )
                llm, _ = get_llms_for_persona(persona)

                # In cases of threads, split the available tokens between docs and thread context
                input_tokens = get_max_input_tokens(
                    model_name=llm.config.model_name,
                    model_provider=llm.config.model_provider,
                )
                max_history_tokens = int(input_tokens * thread_context_percent)

                remaining_tokens = input_tokens - max_history_tokens

                query_text = new_message_request.messages[0].message
                if persona:
                    max_document_tokens = compute_max_document_tokens_for_persona(
                        persona=persona,
                        actual_user_input=query_text,
                        max_llm_token_override=remaining_tokens,
                    )
                else:
                    max_document_tokens = (
                        remaining_tokens
                        - 512  # Needs to be more than any of the QA prompts
                        - check_number_of_tokens(query_text)
                    )

            if DISABLE_GENERATIVE_AI:
                return None

            # This also handles creating the query event in postgres
            answer = get_search_answer(
                query_req=new_message_request,
                user=None,
                max_document_tokens=max_document_tokens,
                max_history_tokens=max_history_tokens,
                db_session=db_session,
                answer_generation_timeout=answer_generation_timeout,
                enable_reflexion=reflexion,
                bypass_acl=bypass_acl,
                use_citations=use_citations,
                danswerbot_flow=True,
            )
            if not answer.error_msg:
                return answer
            else:
                raise RuntimeError(answer.error_msg)

    try:
        # By leaving time_cutoff and favor_recent as None, and setting enable_auto_detect_filters
        # it allows the slack flow to extract out filters from the user query
        filters = BaseFilters(
            source_type=None,
            document_set=document_set_names,
            time_cutoff=None,
        )

        # Default True because no other ways to apply filters in Slack (no nice UI)
        auto_detect_filters = (
            persona.llm_filter_extraction if persona is not None else True
        )
        if disable_auto_detect_filters:
            auto_detect_filters = False

        retrieval_details = RetrievalDetails(
            run_search=OptionalSearchSetting.ALWAYS,
            real_time=False,
            filters=filters,
            enable_auto_detect_filters=auto_detect_filters,
        )

        # This includes throwing out answer via reflexion
        answer = _get_answer(
            DirectQARequest(
                messages=messages,
                prompt_id=prompt.id if prompt else None,
                persona_id=persona.id if persona is not None else 0,
                retrieval_options=retrieval_details,
                chain_of_thought=not disable_cot,
                skip_rerank=not ENABLE_RERANKING_ASYNC_FLOW,
            )
        )
    except Exception as e:
        logger.exception(
            f"Unable to process message - did not successfully answer "
            f"in {num_retries} attempts"
        )
        # Optionally, respond in thread with the error message, Used primarily
        # for debugging purposes
        if should_respond_with_error_msgs:
            respond_in_thread(
                client=client,
                channel=channel,
                receiver_ids=None,
                text=f"Encountered exception when trying to answer: \n\n```{e}```",
                thread_ts=message_ts_to_respond_to,
            )

        # In case of failures, don't keep the reaction there permanently
        try:
            update_emote_react(
                emoji=DANSWER_REACT_EMOJI,
                channel=message_info.channel_to_respond,
                message_ts=message_info.msg_to_respond,
                remove=True,
                client=client,
            )
        except SlackApiError as e:
            logger.error(f"Failed to remove Reaction due to: {e}")

        return True

    # Edge case handling, for tracking down the Slack usage issue
    if answer is None:
        assert DISABLE_GENERATIVE_AI is True
        try:
            respond_in_thread(
                client=client,
                channel=channel,
                receiver_ids=send_to,
                text="Hello! Danswer has some results for you!",
                blocks=[
                    SectionBlock(
                        text="Danswer is down for maintenance.\nWe're working hard on recharging the AI!"
                    )
                ],
                thread_ts=message_ts_to_respond_to,
                # don't unfurl, since otherwise we will have 5+ previews which makes the message very long
                unfurl=False,
            )

            # For DM (ephemeral message), we need to create a thread via a normal message so the user can see
            # the ephemeral message. This also will give the user a notification which ephemeral message does not.
            if respond_team_member_list or respond_slack_group_list:
                respond_in_thread(
                    client=client,
                    channel=channel,
                    text=(
                        "👋 Hi, we've just gathered and forwarded the relevant "
                        + "information to the team. They'll get back to you shortly!"
                    ),
                    thread_ts=message_ts_to_respond_to,
                )

            return False

        # if no standard answer applies, try a regular answer
        issue_with_regular_answer = handle_regular_answer(
            message_info=message_info,
            slack_bot_config=slack_bot_config,
            receiver_ids=send_to,
            client=client,
            channel=channel,
            receiver_ids=send_to,
            text="Hello! Danswer has some results for you!",
            blocks=all_blocks,
            thread_ts=message_ts_to_respond_to,
            # don't unfurl, since otherwise we will have 5+ previews which makes the message very long
            unfurl=False,
        )

        # For DM (ephemeral message), we need to create a thread via a normal message so the user can see
        # the ephemeral message. This also will give the user a notification which ephemeral message does not.
        if respond_team_member_list or respond_slack_group_list:
            respond_in_thread(
                client=client,
                channel=channel,
                text=(
                    "👋 Hi, we've just gathered and forwarded the relevant "
                    + "information to the team. They'll get back to you shortly!"
                ),
                thread_ts=message_ts_to_respond_to,
            )

        return False

    except Exception:
        logger.exception(
            f"Unable to process message - could not respond in slack in {num_retries} attempts"
        )
        return True
