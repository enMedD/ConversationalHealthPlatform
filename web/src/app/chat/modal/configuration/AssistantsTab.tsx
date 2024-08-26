import { Assistant } from "@/app/admin/assistants/interfaces";
import { LLMProviderDescriptor } from "@/app/admin/models/llm/interfaces";
import { Bubble } from "@/components/Bubble";
import { AssistantIcon } from "@/components/assistants/AssistantIcon";
import { getFinalLLM } from "@/lib/llm/utils";
import React from "react";
import { FiBookmark, FiImage, FiSearch } from "react-icons/fi";
import { Card, CardContent } from "@/components/ui/card";

interface AssistantsTabProps {
  selectedAssistant: Assistant;
  availableAssistants: Assistant[];
  llmProviders: LLMProviderDescriptor[];
  onSelect: (assistant: Assistant) => void;
}

export function AssistantsTab({
  selectedAssistant,
  availableAssistants,
  llmProviders,
  onSelect,
}: AssistantsTabProps) {
  const [_, llmName] = getFinalLLM(llmProviders, null, null);

  return (
    <>
      <div className="my-3 grid md:grid-cols-2 lg:grid-cols-3 gap-5">
        {availableAssistants.map((assistant) => (
          <Card
            key={assistant.id}
            className={`
              cursor-pointer
              p-4 
              ${
                selectedAssistant.id === assistant.id
                  ? "border-accent"
                  : "border-border"
              }
            `}
            onClick={() => onSelect(assistant)}
          >
            <CardContent className="p-0 w-full flex gap-3">
              <AssistantIcon assistant={assistant} size="small" />
              <div>
                <div className="text-sm font-semibold text-dark-900 pt-1 pb-2">
                  {assistant.name}
                </div>

                <div className="text-sm text-dark-900 mb-2">
                  {assistant.description}
                </div>
                <div className="mt-2 flex flex-col gap-y-2">
                  {assistant.document_sets.length > 0 && (
                    <div className="text-xs text-subtle flex flex-wrap gap-2">
                      <p className="my-auto font-medium">Document Sets:</p>
                      {assistant.document_sets.map((set) => (
                        <Bubble key={set.id} isSelected={false}>
                          <div className="flex flex-row gap-1">
                            <FiBookmark className="mr-1 my-auto" />
                            {set.name}
                          </div>
                        </Bubble>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-subtle">
                    <span>Default Model:</span>{" "}
                    <i>{assistant.llm_model_version_override || llmName}</i>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </>
  );
}
