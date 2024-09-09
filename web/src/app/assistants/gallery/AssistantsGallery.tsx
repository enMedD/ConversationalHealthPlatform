"use client";

import { Assistant } from "@/app/admin/assistants/interfaces";
import { AssistantIcon } from "@/components/assistants/AssistantIcon";
import { User } from "@/lib/types";
import Link from "next/link";
import { useState } from "react";
import { FiMinus, FiPlus } from "react-icons/fi";
import { NavigationButton } from "../NavigationButton";
import { AssistantsPageTitle } from "../AssistantsPageTitle";
import {
  addAssistantToList,
  removeAssistantFromList,
} from "@/lib/assistants/updateAssistantPreferences";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { FiMinus, FiPlus } from "react-icons/fi";
import { AssistantsPageTitle } from "../AssistantsPageTitle";
import { NavigationButton } from "../NavigationButton";
import { ToolsDisplay } from "../ToolsDisplay";
import { useToast } from "@/hooks/use-toast";
import { Minus, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function AssistantsGallery({
  assistants,
  user,
}: {
  assistants: Assistant[];
  user: User | null;
}) {
  function filterAssistants(
    assistants: Assistant[],
    query: string
  ): Assistant[] {
    return assistants.filter(
      (assistant) =>
        assistant.name.toLowerCase().includes(query.toLowerCase()) ||
        assistant.description.toLowerCase().includes(query.toLowerCase())
    );
  }

  const router = useRouter();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState("");

  const allAssistantIds = assistants.map((assistant) => assistant.id);
  const filteredAssistants = filterAssistants(assistants, searchQuery);

  return (
    <div className="mx-auto w-searchbar-xs 2xl:w-searchbar-sm 3xl:w-searchbar">
      <AssistantsPageTitle>Assistant Gallery</AssistantsPageTitle>
      <div className="flex justify-center mb-6">
        <Link href="/assistants/mine">
          <NavigationButton>View Your Assistants</NavigationButton>
        </Link>
      </div>

      <p className="text-center mb-6">
        Discover and create custom assistants that combine instructions, extra
        knowledge, and any combination of tools.
      </p>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Search assistants..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="
            w-full
            p-2
            border
            border-gray-300
            rounded
            focus:outline-none
            focus:ring-2
            focus:ring-blue-500
          "
        />
      </div>
      <div
        className="
          w-full
          grid
          grid-cols-2
          gap-4
          py-2
        "
      >
        {filteredAssistants.map((assistant) => (
          <div
            key={assistant.id}
            className="
              bg-background-emphasis
              rounded-regular
              shadow-md
              p-4
            "
          >
            <div className="flex items-center">
              <AssistantIcon assistant={assistant} />
              <h2
                className="
                  text-xl
                  font-semibold
                  mb-2
                  my-auto
                  ml-2
                  text-strong
                "
              >
                {assistant.name}
              </h2>
              {user && (
                <div className="ml-auto">
                  {!user.preferences?.chosen_assistants ||
                  user.preferences?.chosen_assistants?.includes(
                    assistant.id
                  ) ? (
                    <Button
                      onClick={async () => {
                        if (
                          user.preferences?.chosen_assistants &&
                          user.preferences?.chosen_assistants.length === 1
                        ) {
                          toast({
                            title: "Error",
                            description: `Cannot remove "${assistant.name}" - you must have at least one assistant.`,
                            variant: "destructive",
                          });
                          return;
                        }

                        const success = await removeAssistantFromList(
                          assistant.id,
                          user.preferences?.chosen_assistants || allAssistantIds
                        );
                        if (success) {
                          toast({
                            title: "Success",
                            description: `"${assistant.name}" has been removed from your list.`,
                            variant: "success",
                          });
                          router.refresh();
                        } else {
                          toast({
                            title: "Error",
                            description: `"${assistant.name}" could not be removed from your list.`,
                            variant: "destructive",
                          });
                        }
                      }}
                      size="smallIcon"
                      variant="destructive"
                    >
                      <Minus size={16} />
                    </Button>
                  ) : (
                    <Button
                      onClick={async () => {
                        const success = await addAssistantToList(
                          assistant.id,
                          user.preferences?.chosen_assistants || allAssistantIds
                        );
                        if (success) {
                          toast({
                            title: "Success",
                            description: `"${assistant.name}" has been added to your list.`,
                            variant: "success",
                          });
                          router.refresh();
                        } else {
                          toast({
                            title: "Error",
                            description: `"${assistant.name}" could not be added to your list.`,
                            variant: "destructive",
                          });
                        }
                      }}
                      size="icon"
                      variant="ghost"
                    >
                      <Plus size={16} />
                    </Button>
                  )}
                </div>
              )}
            </div>
            {assistant.tools.length > 0 && (
              <ToolsDisplay tools={assistant.tools} />
            )}
            <p className="text-sm mt-2">{assistant.description}</p>
            <p className="text-subtle text-sm mt-2">
              Author: {assistant.owner?.email || "enMedD AI"}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
