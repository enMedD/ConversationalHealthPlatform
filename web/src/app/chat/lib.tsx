import {
  AnswerPiecePacket,
  EnmeddDocument,
  Filters,
} from "@/lib/search/interfaces";
import { handleStream } from "@/lib/search/streamingUtils";
import { FeedbackType } from "./types";
import {
  Dispatch,
  MutableRefObject,
  RefObject,
  SetStateAction,
  useEffect,
  useRef,
} from "react";
import {
  BackendMessage,
  ChatSession,
  DocumentsResponse,
  FileDescriptor,
  ImageGenerationDisplay,
  Message,
  RetrievalType,
  StreamingError,
  ToolCallMetadata,
} from "./interfaces";
import { Persona } from "../admin/assistants/interfaces";
import { ReadonlyURLSearchParams } from "next/navigation";
import { SEARCH_PARAM_NAMES } from "./searchParams";

export async function updateModelOverrideForChatSession(
  chatSessionId: number,
  newAlternateModel: string
) {
  const response = await fetch("/api/chat/update-chat-session-model", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_session_id: chatSessionId,
      new_alternate_model: newAlternateModel,
    }),
  });
  return response;
}

export async function createChatSession(
  personaId: number,
  description: string | null
): Promise<number> {
  const createChatSessionResponse = await fetch(
    "/api/chat/create-chat-session",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        persona_id: personaId,
        description,
      }),
    }
  );
  if (!createChatSessionResponse.ok) {
    console.log(
      `Failed to create chat session - ${createChatSessionResponse.status}`
    );
    throw Error("Failed to create chat session");
  }
  const chatSessionResponseJson = await createChatSessionResponse.json();
  return chatSessionResponseJson.chat_session_id;
}

export type PacketType =
  | ToolCallMetadata
  | BackendMessage
  | AnswerPiecePacket
  | DocumentsResponse
  | ImageGenerationDisplay
  | StreamingError;

export async function* sendMessage({
  message,
  fileDescriptors,
  parentMessageId,
  chatSessionId,
  promptId,
  filters,
  selectedDocumentIds,
  queryOverride,
  forceSearch,
  modelProvider,
  modelVersion,
  temperature,
  systemPromptOverride,
  useExistingUserMessage,
  alternateAssistantId,
}: {
  message: string;
  fileDescriptors: FileDescriptor[];
  parentMessageId: number | null;
  chatSessionId: number;
  promptId: number | null | undefined;
  filters: Filters | null;
  selectedDocumentIds: number[] | null;
  queryOverride?: string;
  forceSearch?: boolean;
  // LLM overrides
  modelProvider?: string;
  modelVersion?: string;
  temperature?: number;
  // prompt overrides
  systemPromptOverride?: string;
  // if specified, will use the existing latest user message
  // and will ignore the specified `message`
  useExistingUserMessage?: boolean;
  alternateAssistantId?: number;
}) {
  const documentsAreSelected =
    selectedDocumentIds && selectedDocumentIds.length > 0;

  const sendMessageResponse = await fetch("/api/chat/send-message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      alternate_assistant_id: alternateAssistantId,
      chat_session_id: chatSessionId,
      parent_message_id: parentMessageId,
      message: message,
      prompt_id: promptId,
      search_doc_ids: documentsAreSelected ? selectedDocumentIds : null,
      file_descriptors: fileDescriptors,
      retrieval_options: !documentsAreSelected
        ? {
            run_search:
              promptId === null ||
              promptId === undefined ||
              queryOverride ||
              forceSearch
                ? "always"
                : "auto",
            real_time: true,
            filters: filters,
          }
        : null,
      query_override: queryOverride,
      prompt_override: systemPromptOverride
        ? {
            system_prompt: systemPromptOverride,
          }
        : null,
      llm_override:
        temperature || modelVersion
          ? {
              temperature,
              model_provider: modelProvider,
              model_version: modelVersion,
            }
          : null,
      use_existing_user_message: useExistingUserMessage,
    }),
  });
  if (!sendMessageResponse.ok) {
    const errorJson = await sendMessageResponse.json();
    const errorMsg = errorJson.message || errorJson.detail || "";
    throw Error(`Failed to send message - ${errorMsg}`);
  }

  yield* handleStream<PacketType>(sendMessageResponse);
}

export async function nameChatSession(chatSessionId: number, message: string) {
  const response = await fetch("/api/chat/rename-chat-session", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_session_id: chatSessionId,
      name: null,
      first_message: message,
    }),
  });
  return response;
}

export async function setMessageAsLatest(messageId: number) {
  const response = await fetch("/api/chat/set-message-as-latest", {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      message_id: messageId,
    }),
  });
  return response;
}

export async function handleChatFeedback(
  messageId: number,
  feedback: FeedbackType,
  feedbackDetails: string,
  predefinedFeedback: string | undefined
) {
  const response = await fetch("/api/chat/create-chat-message-feedback", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_message_id: messageId,
      is_positive: feedback === "like",
      feedback_text: feedbackDetails,
      predefined_feedback: predefinedFeedback,
    }),
  });
  return response;
}
export async function renameChatSession(
  chatSessionId: number,
  newName: string
) {
  const response = await fetch(`/api/chat/rename-chat-session`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_session_id: chatSessionId,
      name: newName,
      first_message: null,
    }),
  });
  return response;
}

export async function deleteChatSession(chatSessionId: number) {
  const response = await fetch(
    `/api/chat/delete-chat-session/${chatSessionId}`,
    {
      method: "DELETE",
    }
  );
  return response;
}

export async function* simulateLLMResponse(input: string, delay: number = 30) {
  // Split the input string into tokens. This is a simple example, and in real use case, tokenization can be more complex.
  // Iterate over tokens and yield them one by one
  const tokens = input.match(/.{1,3}|\n/g) || [];

  for (const token of tokens) {
    // In a real-world scenario, there might be a slight delay as tokens are being generated
    await new Promise((resolve) => setTimeout(resolve, delay)); // 40ms delay to simulate response time

    // Yielding each token
    yield token;
  }
}

export function getHumanAndAIMessageFromMessageNumber(
  messageHistory: Message[],
  messageId: number
) {
  let messageInd;
  // -1 is special -> means use the last message
  if (messageId === -1) {
    messageInd = messageHistory.length - 1;
  } else {
    messageInd = messageHistory.findIndex(
      (message) => message.messageId === messageId
    );
  }
  if (messageInd !== -1) {
    const matchingMessage = messageHistory[messageInd];
    const pairedMessage =
      matchingMessage.type === "user"
        ? messageHistory[messageInd + 1]
        : messageHistory[messageInd - 1];

    const humanMessage =
      matchingMessage.type === "user" ? matchingMessage : pairedMessage;
    const aiMessage =
      matchingMessage.type === "user" ? pairedMessage : matchingMessage;

    return {
      humanMessage,
      aiMessage,
    };
  } else {
    return {
      humanMessage: null,
      aiMessage: null,
    };
  }
}

export function getCitedDocumentsFromMessage(message: Message) {
  if (!message.citations || !message.documents) {
    return [];
  }

  const documentsWithCitationKey: [string, EnmeddDocument][] = [];
  Object.entries(message.citations).forEach(([citationKey, documentDbId]) => {
    const matchingDocument = message.documents!.find(
      (document) => document.db_doc_id === documentDbId
    );
    if (matchingDocument) {
      documentsWithCitationKey.push([citationKey, matchingDocument]);
    }
  });
  return documentsWithCitationKey;
}

export function groupSessionsByDateRange(chatSessions: ChatSession[]) {
  const today = new Date();
  today.setHours(0, 0, 0, 0); // Set to start of today for accurate comparison

  const groups: Record<string, ChatSession[]> = {
    Today: [],
    "Previous 7 Days": [],
    "Previous 30 Days": [],
    "Over 30 days ago": [],
  };

  chatSessions.forEach((chatSession) => {
    const chatSessionDate = new Date(chatSession.time_created);

    const diffTime = today.getTime() - chatSessionDate.getTime();
    const diffDays = diffTime / (1000 * 3600 * 24); // Convert time difference to days

    if (diffDays < 1) {
      groups["Today"].push(chatSession);
    } else if (diffDays <= 7) {
      groups["Previous 7 Days"].push(chatSession);
    } else if (diffDays <= 30) {
      groups["Previous 30 Days"].push(chatSession);
    } else {
      groups["Over 30 days ago"].push(chatSession);
    }
  });

  return groups;
}

export function getLastSuccessfulMessageId(messageHistory: Message[]) {
  const lastSuccessfulMessage = messageHistory
    .slice()
    .reverse()
    .find(
      (message) =>
        message.type === "assistant" &&
        message.messageId !== -1 &&
        message.messageId !== null
    );
  return lastSuccessfulMessage ? lastSuccessfulMessage?.messageId : null;
}

export function processRawChatHistory(
  rawMessages: BackendMessage[]
): Map<number, Message> {
  const messages: Map<number, Message> = new Map();
  const parentMessageChildrenMap: Map<number, number[]> = new Map();

  rawMessages.forEach((messageInfo) => {
    const hasContextDocs =
      (messageInfo?.context_docs?.top_documents || []).length > 0;
    let retrievalType;
    if (hasContextDocs) {
      if (messageInfo.rephrased_query) {
        retrievalType = RetrievalType.Search;
      } else {
        retrievalType = RetrievalType.SelectedDocs;
      }
    } else {
      retrievalType = RetrievalType.None;
    }

    const message: Message = {
      messageId: messageInfo.message_id,
      message: messageInfo.message,
      type: messageInfo.message_type as "user" | "assistant",
      files: messageInfo.files,
      alternateAssistantID: messageInfo.alternate_assistant_id
        ? Number(messageInfo.alternate_assistant_id)
        : null,
      // only include these fields if this is an assistant message so that
      // this is identical to what is computed at streaming time
      ...(messageInfo.message_type === "assistant"
        ? {
            retrievalType: retrievalType,
            query: messageInfo.rephrased_query,
            documents: messageInfo?.context_docs?.top_documents || [],
            citations: messageInfo?.citations || {},
          }
        : {}),
      toolCalls: messageInfo.tool_calls,
      parentMessageId: messageInfo.parent_message,
      childrenMessageIds: [],
      latestChildMessageId: messageInfo.latest_child_message,
    };

    messages.set(messageInfo.message_id, message);

    if (messageInfo.parent_message !== null) {
      if (!parentMessageChildrenMap.has(messageInfo.parent_message)) {
        parentMessageChildrenMap.set(messageInfo.parent_message, []);
      }
      parentMessageChildrenMap
        .get(messageInfo.parent_message)!
        .push(messageInfo.message_id);
    }
  });

  // Populate childrenMessageIds for each message
  parentMessageChildrenMap.forEach((childrenIds, parentId) => {
    childrenIds.sort((a, b) => a - b);
    const parentMesage = messages.get(parentId);
    if (parentMesage) {
      parentMesage.childrenMessageIds = childrenIds;
    }
  });

  return messages;
}

export function buildLatestMessageChain(
  messageMap: Map<number, Message>,
  additionalMessagesOnMainline: Message[] = []
): Message[] {
  const rootMessage = Array.from(messageMap.values()).find(
    (message) => message.parentMessageId === null
  );

  let finalMessageList: Message[] = [];
  if (rootMessage) {
    let currMessage: Message | null = rootMessage;
    while (currMessage) {
      finalMessageList.push(currMessage);
      const childMessageNumber = currMessage.latestChildMessageId;
      if (childMessageNumber && messageMap.has(childMessageNumber)) {
        currMessage = messageMap.get(childMessageNumber) as Message;
      } else {
        currMessage = null;
      }
    }
  }

  // remove system message
  if (finalMessageList.length > 0 && finalMessageList[0].type === "system") {
    finalMessageList = finalMessageList.slice(1);
  }
  return finalMessageList.concat(additionalMessagesOnMainline);
}

export function updateParentChildren(
  message: Message,
  completeMessageMap: Map<number, Message>,
  setAsLatestChild: boolean = false
) {
  // NOTE: updates the `completeMessageMap` in place
  const parentMessage = message.parentMessageId
    ? completeMessageMap.get(message.parentMessageId)
    : null;
  if (parentMessage) {
    if (setAsLatestChild) {
      parentMessage.latestChildMessageId = message.messageId;
    }

    const parentChildMessages = parentMessage.childrenMessageIds || [];
    if (!parentChildMessages.includes(message.messageId)) {
      parentChildMessages.push(message.messageId);
    }
    parentMessage.childrenMessageIds = parentChildMessages;
  }
}

export function removeMessage(
  messageId: number,
  completeMessageMap: Map<number, Message>
) {
  const messageToRemove = completeMessageMap.get(messageId);
  if (!messageToRemove) {
    return;
  }

  const parentMessage = messageToRemove.parentMessageId
    ? completeMessageMap.get(messageToRemove.parentMessageId)
    : null;
  if (parentMessage) {
    if (parentMessage.latestChildMessageId === messageId) {
      parentMessage.latestChildMessageId = null;
    }
    const currChildMessage = parentMessage.childrenMessageIds || [];
    const newChildMessage = currChildMessage.filter((id) => id !== messageId);
    parentMessage.childrenMessageIds = newChildMessage;
  }

  completeMessageMap.delete(messageId);
}

export function checkAnyAssistantHasSearch(
  messageHistory: Message[],
  availablePersonas: Persona[],
  livePersona: Persona
): boolean {
  const response =
    messageHistory.some((message) => {
      if (
        message.type !== "assistant" ||
        message.alternateAssistantID === null
      ) {
        return false;
      }

      const alternateAssistant = availablePersonas.find(
        (persona) => persona.id === message.alternateAssistantID
      );

      return alternateAssistant
        ? personaIncludesRetrieval(alternateAssistant)
        : false;
    }) || personaIncludesRetrieval(livePersona);

  return response;
}

export function personaIncludesRetrieval(selectedPersona: Persona) {
  return selectedPersona.num_chunks !== 0;
}

const PARAMS_TO_SKIP = [
  SEARCH_PARAM_NAMES.SUBMIT_ON_LOAD,
  SEARCH_PARAM_NAMES.USER_MESSAGE,
  SEARCH_PARAM_NAMES.TITLE,
  // only use these if explicitly passed in
  SEARCH_PARAM_NAMES.CHAT_ID,
  SEARCH_PARAM_NAMES.PERSONA_ID,
];

export function buildChatUrl(
  existingSearchParams: ReadonlyURLSearchParams,
  chatSessionId: number | null,
  personaId: number | null
) {
  const finalSearchParams: string[] = [];
  if (chatSessionId) {
    finalSearchParams.push(`${SEARCH_PARAM_NAMES.CHAT_ID}=${chatSessionId}`);
  }
  if (personaId !== null) {
    finalSearchParams.push(`${SEARCH_PARAM_NAMES.PERSONA_ID}=${personaId}`);
  }

  existingSearchParams.forEach((value, key) => {
    if (!PARAMS_TO_SKIP.includes(key)) {
      finalSearchParams.push(`${key}=${value}`);
    }
  });
  const finalSearchParamsString = finalSearchParams.join("&");

  if (finalSearchParamsString) {
    return `/chat?${finalSearchParamsString}`;
  }

  return "/chat";
}

export async function uploadFilesForChat(
  files: File[]
): Promise<[FileDescriptor[], string | null]> {
  const formData = new FormData();
  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await fetch("/api/chat/file", {
    method: "POST",
    body: formData,
  });
  if (!response.ok) {
    return [[], `Failed to upload files - ${(await response.json()).detail}`];
  }
  const responseJson = await response.json();

  return [responseJson.files as FileDescriptor[], null];
}

export async function useScrollonStream({
  isStreaming,
  scrollableDivRef,
  scrollDist,
  endDivRef,
  distance,
  debounce,
}: {
  isStreaming: boolean;
  scrollableDivRef: RefObject<HTMLDivElement>;
  scrollDist: MutableRefObject<number>;
  endDivRef: RefObject<HTMLDivElement>;
  distance: number;
  debounce: number;
}) {
  const preventScrollInterference = useRef<boolean>(false);
  const preventScroll = useRef<boolean>(false);
  const blockActionRef = useRef<boolean>(false);
  const previousScroll = useRef<number>(0);

  useEffect(() => {
    if (isStreaming && scrollableDivRef && scrollableDivRef.current) {
      let newHeight: number = scrollableDivRef.current?.scrollTop!;
      const heightDifference = newHeight - previousScroll.current;
      previousScroll.current = newHeight;

      // Prevent streaming scroll
      if (heightDifference < 0 && !preventScroll.current) {
        scrollableDivRef.current.style.scrollBehavior = "auto";
        scrollableDivRef.current.scrollTop = scrollableDivRef.current.scrollTop;
        scrollableDivRef.current.style.scrollBehavior = "smooth";
        preventScrollInterference.current = true;
        preventScroll.current = true;

        setTimeout(() => {
          preventScrollInterference.current = false;
        }, 2000);
        setTimeout(() => {
          preventScroll.current = false;
        }, 10000);
      }

      // Ensure can scroll if scroll down
      else if (!preventScrollInterference.current) {
        preventScroll.current = false;
      }
      if (
        scrollDist.current < distance &&
        !blockActionRef.current &&
        !blockActionRef.current &&
        !preventScroll.current &&
        endDivRef &&
        endDivRef.current
      ) {
        // catch up if necessary!
        const scrollAmount = scrollDist.current + 10000;
        if (scrollDist.current > 140) {
          endDivRef.current.scrollIntoView();
        } else {
          blockActionRef.current = true;

          scrollableDivRef?.current?.scrollBy({
            left: 0,
            top: Math.max(0, scrollAmount),
            behavior: "smooth",
          });

          setTimeout(() => {
            blockActionRef.current = false;
          }, debounce);
        }
      }
    }
  });

  // scroll on end of stream if within distance
  useEffect(() => {
    if (scrollableDivRef?.current && !isStreaming) {
      if (scrollDist.current < distance) {
        scrollableDivRef?.current?.scrollBy({
          left: 0,
          top: Math.max(scrollDist.current + 600, 0),
          behavior: "smooth",
        });
      }
    }
  }, [isStreaming]);
}
