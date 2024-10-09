"use client";

import { CustomTooltip } from "@/components/CustomTooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { errorHandlingFetcher } from "@/lib/fetcher";
import { Teamspace } from "@/lib/types";
import { Cpu, EllipsisVertical, File, Shield, Users } from "lucide-react";
import useSWR from "swr";
import { deleteTeamspace } from "./lib";
import { useToast } from "@/hooks/use-toast";
import { CustomModal } from "@/components/CustomModal";
import { useState } from "react";

interface TeamspaceWithGradient extends Teamspace {
  gradient?: string;
}

interface TeamspacesCardProps {
  teamspace: TeamspaceWithGradient;
  refresh: () => void;
  onClick: (teamspaceId: number) => void;
}

const DeleteArchiveModal = ({
  trigger,
  onClose,
  open,
  type,
  onConfirm,
}: {
  trigger: JSX.Element;
  onClose: () => void;
  open: boolean;
  type: string;
  onConfirm: (event: any) => Promise<void>;
}) => {
  return (
    <CustomModal
      trigger={trigger}
      title={`Are you sure you want to ${type} this Team Space?`}
      onClose={onClose}
      open={open}
    >
      <p className="pb-4">
        You are about to {type} this Team Space. Members will no longer have
        access to it, and it will be removed from their sidebar
      </p>
      <div className="flex justify-end gap-2 pt-6 border-t w-full">
        <Button onClick={onClose} variant="secondary">
          Cancel
        </Button>
        <Button onClick={onConfirm} variant="destructive">
          Confirm
        </Button>
      </div>
    </CustomModal>
  );
};

export const TeamspacesCard = ({
  teamspace,
  refresh,
  onClick,
}: TeamspacesCardProps) => {
  const { toast } = useToast();
  const { data, isLoading, error } = useSWR(
    `/api/admin/token-rate-limits/teamspace/${teamspace.id}`,
    errorHandlingFetcher
  );
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isArchiveModalOpen, setIsArchiveModalOpen] = useState(false);

  const tokenRate = data && data.length > 0 ? data[0] : null;

  return (
    <div className="relative">
      <Popover>
        <PopoverTrigger
          asChild
          className="absolute top-3 right-3 cursor-pointer"
        >
          <EllipsisVertical stroke="#ffffff" />
        </PopoverTrigger>
        <PopoverContent side="top" align="start">
          <div className="min-w-32">
            <DeleteArchiveModal
              trigger={
                <button
                  className="flex py-2 px-4 text-sm cursor-pointer rounded-regular hover:bg-primary hover:text-inverted w-full focus:outline-none"
                  onClick={() => setIsArchiveModalOpen(true)}
                >
                  Archive
                </button>
              }
              onClose={() => setIsArchiveModalOpen(false)}
              open={isArchiveModalOpen}
              type="Archive"
              onConfirm={async () => {
                setIsArchiveModalOpen(false);
              }}
            />

            <DeleteArchiveModal
              trigger={
                <button
                  className="flex py-2 px-4 text-sm cursor-pointer rounded-regular hover:bg-primary hover:text-inverted w-full focus:outline-none"
                  onClick={() => setIsDeleteModalOpen(true)}
                >
                  Delete
                </button>
              }
              onClose={() => setIsDeleteModalOpen(false)}
              open={isDeleteModalOpen}
              type="Delete"
              onConfirm={async (event) => {
                event.stopPropagation();
                const response = await deleteTeamspace(teamspace.id);
                if (response.ok) {
                  toast({
                    title: "Teamspace Deleted!",
                    description: `Successfully deleted the teamspace: "${teamspace.name}".`,
                    variant: "success",
                  });
                } else {
                  const errorMsg = (await response.json()).detail;
                  toast({
                    title: "Deletion Error",
                    description: `Failed to delete the teamspace: ${errorMsg}. Please try again.`,
                    variant: "destructive",
                  });
                }
                refresh();
              }}
            />
          </div>
        </PopoverContent>
      </Popover>
      <Card
        key={teamspace.id}
        className="overflow-hidden !rounded-xl cursor-pointer xl:min-w-[280px] md:max-w-[400px] justify-start items-start"
        onClick={() => onClick(teamspace.id)}
      >
        <CardHeader
          style={{ background: teamspace.gradient }}
          className="p-10"
        ></CardHeader>
        <CardContent className="flex flex-col justify-between min-h-48 relative bg-muted/50">
          <div className="absolute top-0 -translate-y-1/2 right-4">
            <span
              style={{ background: teamspace.gradient }}
              className="text-xl uppercase font-bold min-w-12 min-h-12 flex items-center justify-center rounded-lg text-inverted border-[5px] border-inverted w-full"
            >
              {teamspace.name.charAt(0)}
            </span>
          </div>
          <div className="pb-6">
            <h2 className="font-bold whitespace-normal break-all w-full">
              <span className="inline">{teamspace.name}</span>
              <CustomTooltip
                trigger={
                  <div
                    className={`inline-block ml-2 w-2.5 h-2.5 rounded-full ${
                      teamspace.is_up_to_date ? "bg-success" : "bg-secondary"
                    }`}
                  />
                }
              >
                {teamspace.is_up_to_date ? "Updated" : "Outdated"}
              </CustomTooltip>
            </h2>
            {/* TODO: replace with teamspace creator  */}
            {/* <span className="text-sm text-subtle">@mrquilbot</span> */}

            <span className="text-sm text-subtle">
              {teamspace.users.length > 0 ? teamspace.users[0].full_name : ""}
            </span>
          </div>

          <div className="w-full grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] text-sm gap-y-2 gap-x-6 font-light">
            <div className="flex items-center gap-2">
              <Users size={16} className="shrink-0" />
              <span className="whitespace-nowrap">
                {teamspace.users.length} People
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Cpu size={16} className="shrink-0" />
              <span className="whitespace-nowrap">
                {teamspace.assistants.length} Assistant
              </span>
            </div>

            <div className="flex items-center gap-2">
              <File size={16} className="shrink-0" />
              <span className="whitespace-nowrap">
                {teamspace.document_sets.length} Document Set
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Shield size={16} className="shrink-0" />
              <span className="whitespace-nowrap">
                {" "}
                {tokenRate
                  ? `${tokenRate.token_budget} Token Rate`
                  : "No Token Rate"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
