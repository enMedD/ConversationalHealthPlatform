"use client";

import { GroupsIcon } from "@/components/icons/icons";
import { TeamspacesTable } from "./TeamspacesTable";
import { TeamspaceCreationForm } from "./TeamspaceCreationForm";
import { useState } from "react";
import { ThreeDotsLoader } from "@/components/Loading";
import {
  useConnectorCredentialIndexingStatus,
  useTeamspaces,
  useUsers,
} from "@/lib/hooks";
import { AdminPageTitle } from "@/components/admin/Title";
import { Button } from "@/components/ui/button";
import { CustomModal } from "@/components/CustomModal";

const Main = () => {
  const [showForm, setShowForm] = useState(false);

  const { data, isLoading, error, refreshTeamspaces } = useTeamspaces();

  const {
    data: ccPairs,
    isLoading: isCCPairsLoading,
    error: ccPairsError,
  } = useConnectorCredentialIndexingStatus();

  const {
    data: users,
    isLoading: userIsLoading,
    error: usersError,
  } = useUsers();

  if (isLoading || isCCPairsLoading || userIsLoading) {
    return <ThreeDotsLoader />;
  }

  if (error || !data) {
    return <div className="text-red-600">Error loading users</div>;
  }

  if (ccPairsError || !ccPairs) {
    return <div className="text-red-600">Error loading connectors</div>;
  }

  if (usersError || !users) {
    return <div className="text-red-600">Error loading users</div>;
  }

  return (
    <>
      <CustomModal
        trigger={
          <Button onClick={() => setShowForm(true)}>
            Create New User Group
          </Button>
        }
        onClose={() => setShowForm(false)}
        open={showForm}
      >
        <TeamspaceCreationForm
          onClose={() => {
            refreshTeamspaces();
            setShowForm(false);
          }}
          users={users.accepted}
          ccPairs={ccPairs}
        />
      </CustomModal>

      {data.length > 0 && (
        <div className="pt-5">
          <TeamspacesTable teamspaces={data} refresh={refreshTeamspaces} />
        </div>
      )}
    </>
  );
};

const Page = () => {
  return (
    <div className="py-24 md:py-32 lg:pt-16">
      <AdminPageTitle
        title="Manage Teamspaces"
        icon={<GroupsIcon size={32} />}
      />

      <Main />
    </div>
  );
};

export default Page;
