"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { CustomModal } from "@/components/CustomModal";
import { Button } from "@/components/ui/button";
import { Teamspace } from "@/lib/types";
import { Plus } from "lucide-react";
import Logo from "../../../../../public/logo.png";
import { SearchInput } from "@/components/SearchInput";
import { DeleteModal } from "./DeleteModal";
import { Assistant } from "@/app/admin/assistants/interfaces";
import { useToast } from "@/hooks/use-toast";

interface TeamspaceAssistantProps {
  teamspace: Teamspace & { gradient: string };
  assistants: Assistant[];
  refreshTeamspaces: () => void;
}

interface AssistantContentProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filteredAssistants: Assistant[];
  isGlobal?: boolean;
  onSelect?: (assistant: Assistant) => void;
  selectedAssistants?: Assistant[];
}

const AssistantContent = ({
  searchTerm,
  setSearchTerm,
  filteredAssistants,
  isGlobal,
  onSelect,
  selectedAssistants,
}: AssistantContentProps) => {
  return (
    <div className={isGlobal ? "cursor-pointer" : ""}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg leading-none tracking-tight lg:text-xl font-semibold">
          {isGlobal ? "Available" : "Current"} Assistants
        </h2>
        <div className="w-1/2">
          <SearchInput
            placeholder="Search assistants..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {filteredAssistants.map((assistant) => (
          <div
            key={assistant.id}
            className={`border rounded-md flex items-start p-4 gap-4 ${
              selectedAssistants?.some(
                (selected) => selected.id === assistant.id
              )
                ? "bg-primary-300 border-input-colored"
                : ""
            }`}
            onClick={() => onSelect && onSelect(assistant)}
          >
            <div className="rounded-l-md flex items-center justify-center p-4 border-r">
              <Image src={Logo} alt={assistant.name} width={150} height={150} />
            </div>
            <div className="w-full p-4">
              <div className="flex items-center justify-between w-full">
                <h3>{assistant.name}</h3>
                {!isGlobal ? (
                  <DeleteModal type="Assistant" />
                ) : (
                  <Button variant="ghost" size="smallIcon">
                    <Plus size={16} />
                  </Button>
                )}
              </div>
              <p className="text-sm pt-2 line-clamp">{assistant.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TeamspaceAssistant = ({
  teamspace,
  assistants,
  refreshTeamspaces,
}: TeamspaceAssistantProps) => {
  const { toast } = useToast();
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isAssistantModalOpen, setIsAssistantModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedAssistants, setSelectedAssistants] = useState<Assistant[]>([]);

  const filterAssistants = (assistantsList: Assistant[]) =>
    assistantsList.filter(
      (assistant) =>
        assistant.is_public &&
        !teamspace.assistants.some(
          (currentAssistant) => currentAssistant.id === assistant.id
        ) &&
        assistant.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const filteredCurrentAssistants = teamspace.assistants.filter((assistant) =>
    assistant.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const [filteredGlobalAssistants, setFilteredGlobalAssistants] = useState(() =>
    filterAssistants(assistants)
  );

  useEffect(() => {
    setFilteredGlobalAssistants(filterAssistants(assistants));
  }, [assistants, teamspace.assistants, searchTerm]);

  const handleSelectAssistant = (assistant: Assistant) => {
    setSelectedAssistants((prevSelected) =>
      prevSelected.some((selected) => selected.id === assistant.id)
        ? prevSelected.filter((selected) => selected.id !== assistant.id)
        : [...prevSelected, assistant]
    );
  };

  const handleSaveChanges = async () => {
    try {
      const response = await fetch(
        `/api/manage/admin/teamspace/${teamspace.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_ids: teamspace.users.map((user) => user.id),
            cc_pair_ids: teamspace.cc_pairs.map((ccPair) => ccPair.id),
            document_set_ids: teamspace.document_sets.map(
              (docSet) => docSet.id
            ),
            assistant_ids: selectedAssistants.map((assistant) => assistant.id),
          }),
        }
      );

      const responseJson = await response.json();

      if (!response.ok) {
        toast({
          title: "Update Failed",
          description: `Unable to update assistants: ${responseJson.detail || "Unknown error."}`,
          variant: "destructive",
        });
        return;
      } else {
        toast({
          title: "Assistants Updated",
          description:
            "Assistants have been successfully updated in the teamspace.",
          variant: "success",
        });
        refreshTeamspaces();
        setFilteredGlobalAssistants(filterAssistants(assistants));
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "An error occurred while updating assistants.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="relative">
      <CustomModal
        trigger={
          <Button
            className="absolute top-4 right-4"
            onClick={() => setIsInviteModalOpen(true)}
          >
            <Plus size={16} /> Add
          </Button>
        }
        title="Add new assistant"
        description="Your invite link has been created. Share this link to join your workspace."
        open={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      >
        Add
      </CustomModal>

      <CustomModal
        trigger={
          <div
            className="rounded-md bg-muted w-full p-4 min-h-32 flex flex-col justify-between"
            onClick={() => setIsAssistantModalOpen(true)}
          >
            <h3>
              Assistant <span className="px-2 font-normal">|</span>{" "}
              {teamspace.assistants.length}
            </h3>
            {teamspace.assistants.length > 0 ? (
              <div className="pt-8 flex flex-wrap -space-x-3">
                {teamspace.assistants.slice(0, 8).map((teamspaceAssistant) => (
                  <div
                    key={teamspaceAssistant.id}
                    className={`bg-primary w-10 h-10 rounded-full flex items-center justify-center font-semibold text-inverted text-lg uppercase`}
                  >
                    {teamspaceAssistant.name!.charAt(0)}
                  </div>
                ))}
                {teamspace.assistants.length > 8 && (
                  <div className="bg-background w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold">
                    +{teamspace.assistants.length - 8}
                  </div>
                )}
              </div>
            ) : (
              <p>There are no assistants.</p>
            )}
          </div>
        }
        title="Assistants"
        open={isAssistantModalOpen}
        onClose={() => {
          setIsAssistantModalOpen(false);
          setSelectedAssistants([]);
        }}
      >
        <div className="space-y-12">
          {teamspace.assistants.length > 0 ? (
            <AssistantContent
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              filteredAssistants={filteredCurrentAssistants}
            />
          ) : (
            <p>There are no current assistants.</p>
          )}
          <AssistantContent
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filteredAssistants={filteredGlobalAssistants}
            isGlobal
            onSelect={handleSelectAssistant}
            selectedAssistants={selectedAssistants}
          />
        </div>

        <div className="pt-20 pb-8 ml-auto">
          <Button onClick={handleSaveChanges}>Save changes</Button>
        </div>
      </CustomModal>
    </div>
  );
};
