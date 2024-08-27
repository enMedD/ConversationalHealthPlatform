"use client";

import { TeamspacesIcon } from "@/components/icons/icons";
import { TeamspacesTable } from "./TeamspacesTable";
import { TeamspaceCreationForm } from "./TeamspaceCreationForm";
import { usePopup } from "@/components/admin/connectors/Popup";
import { useState } from "react";
import { ThreeDotsLoader } from "@/components/Loading";
import {
  useConnectorCredentialIndexingStatus,
  useTeamspaces,
  useUsers,
} from "@/lib/hooks";
import { AdminPageTitle } from "@/components/admin/Title";
import { Button, Divider } from "@tremor/react";

const Main = () => {
  const { popup, setPopup } = usePopup();
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
      {popup}
      <div className="my-3">
        <Button size="xs" color="green" onClick={() => setShowForm(true)}>
          Create New Teamspace
        </Button>
      </div>
      {data.length > 0 && (
        <div>
          <Divider />
          <TeamspacesTable
            teamspaces={data}
            setPopup={setPopup}
            refresh={refreshTeamspaces}
          />
        </div>
      )}
      {showForm && (
        <TeamspaceCreationForm
          onClose={() => {
            refreshTeamspaces();
            setShowForm(false);
          }}
          setPopup={setPopup}
          users={users.accepted}
          ccPairs={ccPairs}
        />
      )}
    </>
  );
};

const Page = () => {
  return (
    <div className="mx-auto container">
      <AdminPageTitle
        title="Manage Users Teamspaces"
        icon={<TeamspacesIcon size={32} />}
      />

      <Main />
    </div>
  );
};

export default Page;
