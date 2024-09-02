"use client";

import { useState } from "react";
import { ConnectorTitle } from "@/components/admin/connectors/ConnectorTitle";
import { AddMemberForm } from "./AddMemberForm";
import { updateUserGroup } from "./lib";
import { LoadingAnimation } from "@/components/Loading";
import { ConnectorIndexingStatus, User, UserGroup } from "@/lib/types";
import { AddConnectorForm } from "./AddConnectorForm";
import {
  Table,
  TableHead,
  TableRow,
  TableHeaderCell,
  TableBody,
  TableCell,
  Divider,
  Text,
} from "@tremor/react";
import { DeleteButton } from "@/components/DeleteButton";
import { Bubble } from "@/components/Bubble";
import { BookmarkIcon, RobotIcon } from "@/components/icons/icons";
import { AddTokenRateLimitForm } from "./AddTokenRateLimitForm";
import { GenericTokenRateLimitTable } from "@/app/admin/token-rate-limits/TokenRateLimitTables";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface GroupDisplayProps {
  users: User[];
  ccPairs: ConnectorIndexingStatus<any, any>[];
  userGroup: UserGroup;
  refreshUserGroup: () => void;
}

export const GroupDisplay = ({
  users,
  ccPairs,
  userGroup,
  refreshUserGroup,
}: GroupDisplayProps) => {
  const { toast } = useToast();
  const [addMemberFormVisible, setAddMemberFormVisible] = useState(false);
  const [addConnectorFormVisible, setAddConnectorFormVisible] = useState(false);

  return (
    <div>
      <div className="text-sm mb-3 flex">
        <Text className="mr-1">Status:</Text>{" "}
        {userGroup.is_up_to_date ? (
          <div className="text-success font-bold">Up to date</div>
        ) : (
          <div className="text-accent font-bold">
            <LoadingAnimation text="Syncing" />
          </div>
        )}
      </div>

      <Divider />

      <div className="flex w-full">
        <h2 className="text-xl font-bold">Users</h2>
      </div>

      <div className="mt-2">
        {userGroup.users.length > 0 ? (
          <>
            <Table className="overflow-visible">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Email</TableHeaderCell>
                  <TableHeaderCell className="flex w-full">
                    <div className="ml-auto">Remove User</div>
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {userGroup.users.map((user) => {
                  return (
                    <TableRow key={user.id}>
                      <TableCell className="whitespace-normal break-all">
                        {user.email}
                      </TableCell>
                      <TableCell>
                        <div className="flex w-full">
                          <div className="ml-auto m-2">
                            <DeleteButton
                              onClick={async () => {
                                const response = await updateUserGroup(
                                  userGroup.id,
                                  {
                                    user_ids: userGroup.users
                                      .filter(
                                        (userGroupUser) =>
                                          userGroupUser.id !== user.id
                                      )
                                      .map((userGroupUser) => userGroupUser.id),
                                    cc_pair_ids: userGroup.cc_pairs.map(
                                      (ccPair) => ccPair.id
                                    ),
                                  }
                                );
                                if (response.ok) {
                                  toast({
                                    title: "Success",
                                    description:
                                      "Successfully removed user from group",
                                    variant: "success",
                                  });
                                } else {
                                  const responseJson = await response.json();
                                  const errorMsg =
                                    responseJson.detail || responseJson.message;
                                  toast({
                                    title: "Error",
                                    description: `Error removing user from group - ${errorMsg}`,
                                    variant: "destructive",
                                  });
                                }
                                refreshUserGroup();
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        ) : (
          <div className="text-sm">No users in this group...</div>
        )}
      </div>

      <Button
        className="mt-3"
        onClick={() => setAddMemberFormVisible(true)}
        disabled={!userGroup.is_up_to_date}
      >
        Add Users
      </Button>

      {addMemberFormVisible && (
        <AddMemberForm
          users={users}
          userGroup={userGroup}
          onClose={() => {
            setAddMemberFormVisible(false);
            refreshUserGroup();
          }}
        />
      )}

      <Divider />

      <h2 className="text-xl font-bold mt-8">Connectors</h2>
      <div className="mt-2">
        {userGroup.cc_pairs.length > 0 ? (
          <>
            <Table className="overflow-visible">
              <TableHead>
                <TableRow>
                  <TableHeaderCell>Connector</TableHeaderCell>
                  <TableHeaderCell className="flex w-full">
                    <div className="ml-auto">Remove Connector</div>
                  </TableHeaderCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {userGroup.cc_pairs.map((ccPair) => {
                  return (
                    <TableRow key={ccPair.id}>
                      <TableCell className="whitespace-normal break-all">
                        <ConnectorTitle
                          connector={ccPair.connector}
                          ccPairId={ccPair.id}
                          ccPairName={ccPair.name}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex w-full">
                          <div className="ml-auto m-2">
                            <DeleteButton
                              onClick={async () => {
                                const response = await updateUserGroup(
                                  userGroup.id,
                                  {
                                    user_ids: userGroup.users.map(
                                      (userGroupUser) => userGroupUser.id
                                    ),
                                    cc_pair_ids: userGroup.cc_pairs
                                      .filter(
                                        (userGroupCCPair) =>
                                          userGroupCCPair.id != ccPair.id
                                      )
                                      .map((ccPair) => ccPair.id),
                                  }
                                );
                                if (response.ok) {
                                  toast({
                                    title: "Success",
                                    description:
                                      "Successfully removed connector from group",
                                    variant: "success",
                                  });
                                } else {
                                  const responseJson = await response.json();
                                  const errorMsg =
                                    responseJson.detail || responseJson.message;
                                  toast({
                                    title: "Error",
                                    description: `Error removing connector from group - ${errorMsg}`,
                                    variant: "destructive",
                                  });
                                }
                                refreshUserGroup();
                              }}
                            />
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </>
        ) : (
          <div className="text-sm">No connectors in this group...</div>
        )}
      </div>

      <Button
        className="mt-3"
        onClick={() => setAddConnectorFormVisible(true)}
        disabled={!userGroup.is_up_to_date}
      >
        Add Connectors
      </Button>

      {addConnectorFormVisible && (
        <AddConnectorForm
          ccPairs={ccPairs}
          userGroup={userGroup}
          onClose={() => {
            setAddConnectorFormVisible(false);
            refreshUserGroup();
          }}
        />
      )}

      <Divider />

      <h2 className="text-xl font-bold mt-8 mb-2">Document Sets</h2>

      <div>
        {userGroup.document_sets.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {userGroup.document_sets.map((documentSet) => {
              return (
                <Bubble isSelected key={documentSet.id}>
                  <div className="flex">
                    <BookmarkIcon />
                    <Text className="ml-1">{documentSet.name}</Text>
                  </div>
                </Bubble>
              );
            })}
          </div>
        ) : (
          <>
            <Text>No document sets in this group...</Text>
          </>
        )}
      </div>

      <Divider />

      <h2 className="text-xl font-bold mt-8 mb-2">Assistants</h2>

      <div>
        {userGroup.document_sets.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {userGroup.assistants.map((assistant) => {
              return (
                <Bubble isSelected key={assistant.id}>
                  <div className="flex">
                    <RobotIcon />
                    <Text className="ml-1">{assistant.name}</Text>
                  </div>
                </Bubble>
              );
            })}
          </div>
        ) : (
          <>
            <Text>No Assistants in this group...</Text>
          </>
        )}
      </div>

      <Divider />

      <h2 className="text-xl font-bold mt-8 mb-2">Token Rate Limits</h2>

      <GenericTokenRateLimitTable
        fetchUrl={`/api/admin/token-rate-limits/user-group/${userGroup.id}`}
        hideHeading
      />

      <AddTokenRateLimitForm userGroupId={userGroup.id} />
    </div>
  );
};
