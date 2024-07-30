import React, {
  Dispatch,
  SetStateAction,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  FiSend,
  FiFilter,
  FiPlusCircle,
  FiCpu,
  FiX,
  FiPlus,
  FiInfo,
} from "react-icons/fi";
import ChatInputOption from "./ChatInputOption";
import { FaBrain } from "react-icons/fa";
import { Persona } from "@/app/admin/assistants/interfaces";
import { FilterManager, LlmOverrideManager } from "@/lib/hooks";
import { SelectedFilterDisplay } from "./SelectedFilterDisplay";
import { useChatContext } from "@/components/context/ChatContext";
import { getFinalLLM } from "@/lib/llm/utils";
import { FileDescriptor } from "../interfaces";
import { InputBarPreview } from "../files/InputBarPreview";
import { RobotIcon } from "@/components/icons/icons";
import { Hoverable } from "@/components/Hoverable";
import { AssistantIcon } from "@/components/assistants/AssistantIcon";
import { Tooltip } from "@/components/tooltip/Tooltip";
const MAX_INPUT_HEIGHT = 200;

export function ChatInputBar({
  personas,
  message,
  setMessage,
  onSubmit,
  isStreaming,
  setIsCancelled,
  retrievalDisabled,
  filterManager,
  llmOverrideManager,
  onSetSelectedAssistant,
  selectedAssistant,
  files,
  setFiles,
  handleFileUpload,
  setConfigModalActiveTab,
  textAreaRef,
  alternativeAssistant,
}: {
  onSetSelectedAssistant: (alternativeAssistant: Persona | null) => void;
  personas: Persona[];
  message: string;
  setMessage: (message: string) => void;
  onSubmit: () => void;
  isStreaming: boolean;
  setIsCancelled: (value: boolean) => void;
  retrievalDisabled: boolean;
  filterManager: FilterManager;
  llmOverrideManager: LlmOverrideManager;
  selectedAssistant: Persona;
  alternativeAssistant: Persona | null;
  files: FileDescriptor[];
  setFiles: (files: FileDescriptor[]) => void;
  handleFileUpload: (files: File[]) => void;
  setConfigModalActiveTab: (tab: string) => void;
  textAreaRef: React.RefObject<HTMLTextAreaElement>;
}) {
  // handle re-sizing of the text area
  useEffect(() => {
    const textarea = textAreaRef.current;
    if (textarea) {
      textarea.style.height = "0px";
      textarea.style.height = `${Math.min(
        textarea.scrollHeight,
        MAX_INPUT_HEIGHT
      )}px`;
    }
  }, [message]);

  const handlePaste = (event: React.ClipboardEvent) => {
    const items = event.clipboardData?.items;
    if (items) {
      const pastedFiles = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === "file") {
          const file = items[i].getAsFile();
          if (file) pastedFiles.push(file);
        }
      }
      if (pastedFiles.length > 0) {
        event.preventDefault();
        handleFileUpload(pastedFiles);
      }
    }
  };

  const { llmProviders } = useChatContext();
  const [_, llmName] = getFinalLLM(llmProviders, selectedAssistant, null);

  const suggestionsRef = useRef<HTMLDivElement | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const interactionsRef = useRef<HTMLDivElement | null>(null);

  const hideSuggestions = () => {
    setShowSuggestions(false);
    setAssistantIconIndex(0);
  };

  // Update selected persona
  const updateCurrentPersona = (persona: Persona) => {
    onSetSelectedAssistant(persona.id == selectedAssistant.id ? null : persona);
    hideSuggestions();
    setMessage("");
  };

  // Click out of assistant suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        (!interactionsRef.current ||
          !interactionsRef.current.contains(event.target as Node))
      ) {
        hideSuggestions();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Complete user input handling
  const handleInputChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = event.target.value;
    setMessage(text);

    if (!text.startsWith("@")) {
      hideSuggestions();
      return;
    }

    // If looking for an assistant...fup
    const match = text.match(/(?:\s|^)@(\w*)$/);
    if (match) {
      setShowSuggestions(true);
    } else {
      hideSuggestions();
    }
  };

  const filteredPersonas = personas.filter((persona) =>
    persona.name.toLowerCase().startsWith(
      message
        .slice(message.lastIndexOf("@") + 1)
        .split(/\s/)[0]
        .toLowerCase()
    )
  );

  const [assistantIconIndex, setAssistantIconIndex] = useState(0);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (
      showSuggestions &&
      filteredPersonas.length > 0 &&
      (e.key === "Tab" || e.key == "Enter")
    ) {
      e.preventDefault();
      if (assistantIconIndex == filteredPersonas.length) {
        window.open("/assistants/new", "_blank");
        hideSuggestions();
        setMessage("");
      } else {
        const option =
          filteredPersonas[assistantIconIndex >= 0 ? assistantIconIndex : 0];
        updateCurrentPersona(option);
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setAssistantIconIndex((assistantIconIndex) =>
        Math.min(assistantIconIndex + 1, filteredPersonas.length)
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAssistantIconIndex((assistantIconIndex) =>
        Math.max(assistantIconIndex - 1, 0)
      );
    }
  };

  return (
    <div>
      <div className="flex justify-center max-w-screen-lg pb-2 mx-auto mb-2">
        {/*  <div className="relative w-full px-4 mx-auto shrink w-searchbar-xs 2xl:w-searchbar-sm 3xl:w-searchbar"> */}
        <div className="relative w-full px-4 mx-auto shrink 2xl:w-searchbar-sm 3xl:w-searchbar">
          {showSuggestions && filteredPersonas.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute inset-x-0 top-0 w-full text-sm transform -translate-y-full"
            >
              <div className="rounded-lg py-1.5 bg-white border border-border-medium overflow-hidden shadow-lg mx-2 px-1.5 mt-2 rounded z-10">
                {filteredPersonas.map((currentPersona, index) => (
                  <button
                    key={index}
                    className={`px-2 ${
                      assistantIconIndex == index && "bg-hover"
                    } rounded content-start flex gap-x-1 py-1.5 w-full  hover:bg-hover cursor-pointer`}
                    onClick={() => {
                      updateCurrentPersona(currentPersona);
                    }}
                  >
                    <p className="font-bold ">{currentPersona.name}</p>
                    <p className="line-clamp-1">
                      {currentPersona.id == selectedAssistant.id &&
                        "(default) "}
                      {currentPersona.description}
                    </p>
                  </button>
                ))}
                <a
                  key={filteredPersonas.length}
                  target="_blank"
                  className={`${
                    assistantIconIndex == filteredPersonas.length && "bg-hover"
                  } px-3 flex gap-x-1 py-2 w-full  items-center  hover:bg-hover-light cursor-pointer"`}
                  href="/assistants/new"
                >
                  <FiPlus size={17} />
                  <p>Create a new assistant</p>
                </a>
              </div>
            </div>
          )}

          <div>
            <SelectedFilterDisplay filterManager={filterManager} />
          </div>

          <div
            className="
              opacity-100
              w-full
              h-fit
              flex
              flex-col
              border
              border-border-medium
              rounded-lg
              overflow-hidden
              bg-background-weak
              [&:has(textarea:focus)]::ring-1
              [&:has(textarea:focus)]::ring-black
            "
          >
            {alternativeAssistant && (
              <div className="flex flex-wrap gap-y-1 gap-x-2 px-2 pt-1.5 w-full">
                <div
                  ref={interactionsRef}
                  className="flex items-center w-full p-2 rounded-t-lg bg-background-subtle"
                >
                  <AssistantIcon assistant={alternativeAssistant} border />
                  <p className="my-auto ml-3 text-strong">
                    {alternativeAssistant.name}
                  </p>
                  <div className="flex ml-auto gap-x-1 ">
                    <Tooltip
                      content={
                        <p className="flex flex-wrap max-w-xs">
                          {alternativeAssistant.description}
                        </p>
                      }
                    >
                      <button>
                        <Hoverable icon={FiInfo} />
                      </button>
                    </Tooltip>

                    <Hoverable
                      icon={FiX}
                      onClick={() => onSetSelectedAssistant(null)}
                    />
                  </div>
                </div>
              </div>
            )}

            {files.length > 0 && (
              <div className="flex flex-wrap px-2 pt-2 gap-y-1 gap-x-2">
                {files.map((file) => (
                  <div key={file.id}>
                    <InputBarPreview
                      file={file}
                      onDelete={() => {
                        setFiles(
                          files.filter(
                            (fileInFilter) => fileInFilter.id !== file.id
                          )
                        );
                      }}
                      isUploading={file.isUploading || false}
                    />
                  </div>
                ))}
              </div>
            )}

            <textarea
              onPaste={handlePaste}
              onKeyDownCapture={handleKeyDown}
              onChange={handleInputChange}
              ref={textAreaRef}
              className={`
                m-0
                w-full
                shrink
                resize-none
                border-0
                bg-background-weak
                ${
                  textAreaRef.current &&
                  textAreaRef.current.scrollHeight > MAX_INPUT_HEIGHT
                    ? "overflow-y-auto mt-2"
                    : ""
                }
                overflow-hidden
                whitespace-normal
                break-word
                overscroll-contain
                outline-none
                placeholder-subtle
                resize-none
                pl-4
                pr-12
                py-4
                h-14
              `}
              autoFocus
              style={{ scrollbarWidth: "thin" }}
              role="textarea"
              aria-multiline
              placeholder="Send a message..."
              value={message}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" &&
                  !event.shiftKey &&
                  message &&
                  !isStreaming
                ) {
                  onSubmit();
                  event.preventDefault();
                }
              }}
              suppressContentEditableWarning={true}
            />
            <div className="flex items-center justify-between px-4 py-2 overflow-hidden">
              <div className="flex w-auto gap-2">
                <ChatInputOption
                  flexPriority="shrink"
                  name={
                    selectedAssistant ? selectedAssistant.name : "Assistants"
                  }
                  icon={FaBrain}
                  onClick={() => setConfigModalActiveTab("assistants")}
                />

                <ChatInputOption
                  flexPriority="second"
                  name={
                    llmOverrideManager.llmOverride.modelName ||
                    (selectedAssistant
                      ? selectedAssistant.llm_model_version_override || llmName
                      : llmName)
                  }
                  icon={FiCpu}
                  onClick={() => setConfigModalActiveTab("llms")}
                />

                {!retrievalDisabled && (
                  <ChatInputOption
                    flexPriority="stiff"
                    name="Filters"
                    icon={FiFilter}
                    onClick={() => setConfigModalActiveTab("filters")}
                  />
                )}
                <ChatInputOption
                  flexPriority="stiff"
                  name="File"
                  icon={FiPlusCircle}
                  onClick={() => {
                    const input = document.createElement("input");
                    input.type = "file";
                    input.multiple = true; // Allow multiple files
                    input.onchange = (event: any) => {
                      const files = Array.from(
                        event?.target?.files || []
                      ) as File[];
                      if (files.length > 0) {
                        handleFileUpload(files);
                      }
                    };
                    input.click();
                  }}
                />
              </div>
              <div>
                <div
                  className="flex flex-row items-center content-center w-auto gap-2 px-2.5 py-2.5 text-white truncate bg-blue-700 border rounded-full cursor-pointer sm:px-4 sm:py-2 sm:rounded-xl"
                  onClick={() => {
                    if (!isStreaming) {
                      if (message) {
                        onSubmit();
                      }
                    } else {
                      setIsCancelled(true);
                    }
                  }}
                >
                  <FiSend size={11} color="white" className="w-4 h-4" />
                  <p className="hidden font-light sm:flex">Send message</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
