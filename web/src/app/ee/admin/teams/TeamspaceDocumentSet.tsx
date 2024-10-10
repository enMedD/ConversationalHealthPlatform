"use client";

import { CustomModal } from "@/components/CustomModal";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import { DocumentSet, Teamspace } from "@/lib/types";
import { Globe, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { DeleteModal } from "./DeleteModal";
import { useToast } from "@/hooks/use-toast";

interface TeamspaceDocumentSetProps {
  teamspace: Teamspace & { gradient: string };
  documentSets: DocumentSet[];
  refreshTeamspaces: () => void;
}

interface DocumentSetContentProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filteredDocumentSets: DocumentSet[];
  isGlobal?: boolean;
  onSelect?: (documentSet: DocumentSet) => void;
  selectedDocumentSets?: DocumentSet[];
}

const DocumentSetContent = ({
  searchTerm,
  setSearchTerm,
  filteredDocumentSets,
  isGlobal,
  onSelect,
  selectedDocumentSets,
}: DocumentSetContentProps) => {
  return (
    <div className={isGlobal ? "cursor-pointer" : ""}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg leading-none tracking-tight lg:text-xl font-semibold">
          {isGlobal ? "Available" : "Current"} Document Sets
        </h2>
        <div className="w-1/2">
          <SearchInput
            placeholder="Search document sets..."
            value={searchTerm}
            onChange={setSearchTerm}
          />
        </div>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {filteredDocumentSets.map((documentSet) => (
          <div
            key={documentSet.id}
            className={`border rounded-md flex items-start p-4 gap-4 ${
              selectedDocumentSets?.some(
                (selected) => selected.id === documentSet.id
              )
                ? "bg-primary-300 border-input-colored"
                : ""
            }`}
            onClick={() => onSelect && onSelect(documentSet)}
          >
            <Globe className="shrink-0" />
            <div className="w-full">
              <div className="flex justify-between w-full">
                <h3 className="line-clamp">{documentSet.name}</h3>
                {!isGlobal && <DeleteModal type="Document Set" />}
              </div>
              <p className="text-sm pt-2 line-clamp">
                {documentSet.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const TeamspaceDocumentSet = ({
  teamspace,
  documentSets,
  refreshTeamspaces,
}: TeamspaceDocumentSetProps) => {
  const { toast } = useToast();
  const [isDocumentSetModalOpen, setIsDocumentSetModalOpen] = useState(false);
  const [selectedDocumentSets, setSelectedDocumentSets] = useState<
    DocumentSet[]
  >([]);
  const [searchTermCurrent, setSearchTermCurrent] = useState("");
  const [searchTermGlobal, setSearchTermGlobal] = useState("");

  const filterDocumentSets = (
    documentSets: DocumentSet[],
    searchTerm: string
  ) =>
    documentSets.filter(
      (documentSet) =>
        documentSet.is_public &&
        !teamspace.document_sets.some(
          (currentDocumentSet) => currentDocumentSet.id === documentSet.id
        ) &&
        documentSet.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const filteredCurrentDocumentSets = teamspace.document_sets.filter(
    (documentSet) =>
      documentSet.name?.toLowerCase().includes(searchTermCurrent.toLowerCase())
  );

  const [filteredGlobalDocumentSets, setFilteredGlobalDocumentSets] = useState(
    () => filterDocumentSets(documentSets, searchTermGlobal)
  );

  useEffect(() => {
    setFilteredGlobalDocumentSets(
      filterDocumentSets(documentSets, searchTermGlobal)
    );
  }, [documentSets, teamspace.document_sets, searchTermGlobal]);

  const handleSelectDocumentSet = (documentSet: DocumentSet) => {
    setSelectedDocumentSets((prevSelected) =>
      prevSelected.some((selected) => selected.id === documentSet.id)
        ? prevSelected.filter((selected) => selected.id !== documentSet.id)
        : [...prevSelected, documentSet]
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
            assistant_ids: teamspace.assistants.map(
              (assistant) => assistant.id
            ),
            document_set_ids: selectedDocumentSets.map(
              (documentSet) => documentSet.id
            ),
          }),
        }
      );

      const responseJson = await response.json();

      if (!response.ok) {
        toast({
          title: "Update Failed",
          description: `Unable to update document sets: ${responseJson.detail || "Unknown error."}`,
          variant: "destructive",
        });
        return;
      } else {
        toast({
          title: "Document Sets Updated",
          description:
            "Document Sets have been successfully updated in the teamspace.",
          variant: "success",
        });
        refreshTeamspaces();
        setFilteredGlobalDocumentSets(
          filterDocumentSets(documentSets, searchTermGlobal)
        );
      }
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "An error occurred while updating document sets.",
        variant: "destructive",
      });
    }
  };

  return (
    <CustomModal
      trigger={
        <div
          className="rounded-md bg-muted w-full p-4 min-h-32 flex flex-col justify-between"
          onClick={() => setIsDocumentSetModalOpen(true)}
        >
          <div className="flex items-center justify-between">
            <h3>
              Document Set <span className="px-2 font-normal">|</span>{" "}
              {teamspace.document_sets.length}
            </h3>
            <Button size="smallIcon">
              <Pencil size={16} />
            </Button>
          </div>
          {teamspace.document_sets.length > 0 ? (
            <div className="pt-8 flex flex-wrap -space-x-3">
              {teamspace.document_sets
                .slice(0, 8)
                .map((teamspaceDocumentSet) => (
                  <div
                    key={teamspaceDocumentSet.id}
                    className={`bg-primary w-10 h-10 rounded-full flex items-center justify-center font-semibold text-inverted text-lg uppercase`}
                  >
                    {teamspaceDocumentSet.name!.charAt(0)}
                  </div>
                ))}
              {teamspace.document_sets.length > 8 && (
                <div className="bg-background w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold">
                  +{teamspace.document_sets.length - 8}
                </div>
              )}
            </div>
          ) : (
            <p>There are no document sets.</p>
          )}
        </div>
      }
      title="DocumentSets"
      open={isDocumentSetModalOpen}
      onClose={() => {
        setIsDocumentSetModalOpen(false);
        setSelectedDocumentSets([]);
      }}
    >
      <div className="space-y-12">
        {teamspace.document_sets.length > 0 ? (
          <DocumentSetContent
            searchTerm={searchTermCurrent}
            setSearchTerm={setSearchTermCurrent}
            filteredDocumentSets={filteredCurrentDocumentSets}
          />
        ) : (
          <p>There are no current document sets.</p>
        )}
        <DocumentSetContent
          searchTerm={searchTermGlobal}
          setSearchTerm={setSearchTermGlobal}
          filteredDocumentSets={filteredGlobalDocumentSets}
          isGlobal
          onSelect={handleSelectDocumentSet}
          selectedDocumentSets={selectedDocumentSets}
        />
      </div>

      <div className="pt-10 ml-auto">
        <Button
          onClick={handleSaveChanges}
          disabled={!teamspace.is_up_to_date || teamspace.is_up_for_deletion}
        >
          Save changes
        </Button>
      </div>
    </CustomModal>
  );
};
