"use client";

import { humanReadableFormat } from "@/lib/time";
import { BackendChatSession } from "../../interfaces";
import {
  buildLatestMessageChain,
  getCitedDocumentsFromMessage,
  processRawChatHistory,
} from "../../lib";
import { AIMessage, HumanMessage } from "../../message/Messages";
import { Button, Callout, Divider } from "@tremor/react";
import { useRouter } from "next/navigation";
import { useChatContext } from "@/context/ChatContext";

// TODO: replace the component name
function BackToEnmeddButton() {
  const router = useRouter();

  return (
    <div className="absolute bottom-4 w-full flex border-t border-border pt-4">
      <div className="mx-auto">
        <Button onClick={() => router.push("/chat")}>Back to Chat</Button>
      </div>
    </div>
  );
}

export function SharedChatDisplay({
  chatSession,
}: {
  chatSession: BackendChatSession | null;
}) {
  let { availableAssistants } = useChatContext();
  if (!chatSession) {
    return (
      <div className="min-h-full w-full">
        <div className="mx-auto w-fit pt-8">
          <Callout color="red" title="Shared Chat Not Found">
            Did not find a shared chat with the specified ID.
          </Callout>
        </div>

        <BackToEnmeddButton />
      </div>
    );
  }

  const currentAssistant = availableAssistants.find(
    (assistant) => assistant.id === chatSession.assistant_id
  );

  const messages = buildLatestMessageChain(
    processRawChatHistory(chatSession.messages)
  );

  return (
    <div className="w-full overflow-hidden">
      <div className="flex max-h-full overflow-hidden pb-[72px]">
        <div className="flex w-full overflow-hidden overflow-y-scroll">
          <div className="mx-auto">
            <div className="px-5 pt-8">
              <h1 className="text-3xl text-strong font-bold">
                {chatSession.description ||
                  `Chat ${chatSession.chat_session_id}`}
              </h1>
              <p className="">
                {humanReadableFormat(chatSession.time_created)}
              </p>

              <Divider />
            </div>

            <div className="pb-16">
              {messages.map((message) => {
                if (message.type === "user") {
                  return (
                    <HumanMessage
                      key={message.messageId}
                      content={message.message}
                    />
                  );
                } else {
                  return (
                    <AIMessage
                      currentAssistant={currentAssistant!}
                      key={message.messageId}
                      messageId={message.messageId}
                      content={message.message}
                      assistantName={chatSession.assistant_name}
                      citedDocuments={getCitedDocumentsFromMessage(message)}
                      isComplete
                    />
                  );
                }
              })}
            </div>
          </div>
        </div>
      </div>

      <BackToEnmeddButton />
    </div>
  );
}
