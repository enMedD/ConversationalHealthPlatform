"use client";

import { CustomModal } from "@/components/CustomModal";
import { SearchInput } from "@/components/SearchInput";
import { Button } from "@/components/ui/button";
import {
  CCPairDescriptor,
  ConnectorIndexingStatus,
  Teamspace,
} from "@/lib/types";
import { Globe, Pencil } from "lucide-react";
import { useEffect, useState } from "react";
import { DeleteModal } from "./DeleteModal";
import { useToast } from "@/hooks/use-toast";

interface TeamspaceDataSourceProps {
  teamspace: Teamspace & { gradient: string };
  ccPairs: ConnectorIndexingStatus<any, any>[] | undefined;
  refreshTeamspaces: () => void;
}

interface DataSourceContentProps {
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  filteredCurrentDataSources?: CCPairDescriptor<any, any>[];
  filteredGlobalDataSources?: ConnectorIndexingStatus<any, any>[] | undefined;
  isGlobal?: boolean;
  onSelect?: (cc_pair: ConnectorIndexingStatus<any, any>) => void;
  selectedDataSources?: ConnectorIndexingStatus<any, any>[] | undefined;
}

function isConnectorIndexingStatus(
  dataSource: ConnectorIndexingStatus<any, any> | CCPairDescriptor<any, any>
): dataSource is ConnectorIndexingStatus<any, any> {
  return (
    (dataSource as ConnectorIndexingStatus<any, any>).cc_pair_id !== undefined
  );
}

const DataSourceContent = ({
  searchTerm,
  setSearchTerm,
  filteredCurrentDataSources,
  filteredGlobalDataSources,
  isGlobal,
  onSelect,
  selectedDataSources,
}: DataSourceContentProps) => {
  const dataSources = isGlobal
    ? filteredGlobalDataSources
    : filteredCurrentDataSources;

  const getDataSourceId = (
    dataSource: ConnectorIndexingStatus<any, any> | CCPairDescriptor<any, any>
  ) => {
    if (isConnectorIndexingStatus(dataSource)) {
      return dataSource.cc_pair_id;
    } else {
      return dataSource.id;
    }
  };

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
        {dataSources?.map((dataSource) => (
          <div
            key={getDataSourceId(dataSource)}
            className={`border rounded-md flex items-center p-4 gap-4 ${
              selectedDataSources?.some(
                (selected) =>
                  getDataSourceId(selected) === getDataSourceId(dataSource)
              )
                ? "bg-primary-300 border-input-colored"
                : ""
            }`}
            onClick={() =>
              onSelect &&
              isConnectorIndexingStatus(dataSource) &&
              onSelect(dataSource)
            }
          >
            <Globe className="shrink-0 my-auto" />
            <h3 className="truncate">{dataSource.name}</h3>
            {!isGlobal && <DeleteModal type="Data Source" />}
          </div>
        ))}
      </div>
    </div>
  );
};

export const TeamspaceDataSource = ({
  teamspace,
  ccPairs,
  refreshTeamspaces,
}: TeamspaceDataSourceProps) => {
  const { toast } = useToast();
  const [isDataSourceModalOpen, setIsDataSourceModalOpen] = useState(false);
  const [selectedDataSources, setSelectedDataSources] = useState<
    ConnectorIndexingStatus<any, any>[]
  >([]);
  const [searchTermCurrent, setSearchTermCurrent] = useState("");
  const [searchTermGlobal, setSearchTermGlobal] = useState("");

  const filterDataSources = (
    ccPairs: ConnectorIndexingStatus<any, any>[] | undefined,
    searchTerm: string
  ) =>
    ccPairs?.filter(
      (ccPair) =>
        ccPair.public_doc &&
        !teamspace.cc_pairs.some(
          (currentCCPair) => currentCCPair.id === ccPair.cc_pair_id
        ) &&
        ccPair.name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

  const filteredCurrentDataSources = teamspace.cc_pairs.filter((ccPair) =>
    ccPair.name?.toLowerCase().includes(searchTermCurrent.toLowerCase())
  );

  const [filteredGlobalDataSources, setFilteredGlobalDataSources] = useState(
    () => filterDataSources(ccPairs, searchTermGlobal)
  );

  useEffect(() => {
    setFilteredGlobalDataSources(filterDataSources(ccPairs, searchTermGlobal));
  }, [ccPairs, teamspace.cc_pairs, searchTermGlobal]);

  const handleSelectDataSource = (
    ccPair: ConnectorIndexingStatus<any, any>
  ) => {
    setSelectedDataSources((prevSelected) =>
      prevSelected.some((selected) => selected.cc_pair_id === ccPair.cc_pair_id)
        ? prevSelected.filter(
            (selected) => selected.cc_pair_id !== ccPair.cc_pair_id
          )
        : [...prevSelected, ccPair]
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
            assistant_ids: teamspace.assistants.map(
              (assistant) => assistant.id
            ),
            document_set_ids: teamspace.cc_pairs.map((ccPair) => ccPair.id),
            cc_pair_ids: selectedDataSources.map((ccPair) => ccPair.cc_pair_id),
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
          title: "Data Source Updated",
          description:
            "Data Source have been successfully updated in the teamspace.",
          variant: "success",
        });
        refreshTeamspaces();
        setFilteredGlobalDataSources(
          filterDataSources(ccPairs, searchTermGlobal)
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
          onClick={() => setIsDataSourceModalOpen(true)}
        >
          <div className="flex items-center justify-between">
            <h3>
              Data Source <span className="px-2 font-normal">|</span>
              {teamspace.cc_pairs.length}
            </h3>
            <Button size="smallIcon">
              <Pencil size={16} />
            </Button>
          </div>
          {teamspace.cc_pairs.length > 0 ? (
            <div className="pt-8 flex flex-wrap -space-x-3">
              {teamspace.cc_pairs.slice(0, 8).map((teamspaceDataSource) => (
                <div
                  key={teamspaceDataSource.id}
                  className={`bg-primary w-10 h-10 rounded-full flex items-center justify-center font-semibold text-inverted text-lg uppercase`}
                >
                  {teamspaceDataSource.name!.charAt(0)}
                </div>
              ))}
              {teamspace.cc_pairs.length > 8 && (
                <div className="bg-background w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold">
                  +{teamspace.cc_pairs.length - 8}
                </div>
              )}
            </div>
          ) : (
            <p>There are no document sets.</p>
          )}
        </div>
      }
      title="Data Source"
      open={isDataSourceModalOpen}
      onClose={() => {
        setIsDataSourceModalOpen(false);
        setSelectedDataSources([]);
      }}
    >
      <div className="space-y-12">
        {teamspace.cc_pairs.length > 0 ? (
          <DataSourceContent
            searchTerm={searchTermCurrent}
            setSearchTerm={setSearchTermCurrent}
            filteredCurrentDataSources={filteredCurrentDataSources}
          />
        ) : (
          <p>There are no current document sets.</p>
        )}
        <DataSourceContent
          searchTerm={searchTermGlobal}
          setSearchTerm={setSearchTermGlobal}
          filteredGlobalDataSources={filteredGlobalDataSources}
          isGlobal
          onSelect={handleSelectDataSource}
          selectedDataSources={selectedDataSources}
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
