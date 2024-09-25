"use client";

import { CustomModal } from "@/components/CustomModal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Teamspace } from "@/lib/types";
import { BookmarkIcon, Copy, Globe, Plus } from "lucide-react";
import { useState } from "react";

interface TeamspaceDocumentSetProps {
  teamspace: Teamspace & { gradient: string };
}

export const TeamspaceDocumentSet = ({
  teamspace,
}: TeamspaceDocumentSetProps) => {
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isDocumentSetModalOpen, setIsDocumentSetModalOpen] = useState(false);

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
        title="Add new document set"
        description="Your invite link has been created. Share this link to join
            your workspace."
        open={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
      >
        <div className="space-y-4">
          <div>
            <Label>Share link</Label>
            <div className="flex items-center gap-2">
              <Input />
              <Button variant="outline" size="icon">
                <Copy size={16} />
              </Button>
            </div>
          </div>

          <div>
            <Label>Invite user</Label>
            <div className="flex items-center gap-2">
              <Input placeholder="Enter email" />
              <Select>
                <SelectTrigger className="w-full lg:w-64">
                  <SelectValue placeholder="Role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="member">Member</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Label className="pt-1.5">
              We&rsquo;ll send them instructions and a magic link to join the
              workspace via email.
            </Label>
          </div>

          <div className="flex gap-2 justify-end pt-6">
            <Button variant="ghost" onClick={() => setIsInviteModalOpen(false)}>
              Cancel
            </Button>
            <Button>Send Invite</Button>
          </div>
        </div>
      </CustomModal>
      <CustomModal
        trigger={
          <div
            className="rounded-md bg-muted w-full p-4 min-h-32 flex flex-col justify-between"
            onClick={() => setIsDocumentSetModalOpen(true)}
          >
            <h3>
              Document Set <span className="px-2 font-normal">|</span>{" "}
              {teamspace.document_sets.length}
            </h3>

            {teamspace.document_sets.length > 0 ? (
              <div className="pt-4 flex flex-wrap gap-2">
                {teamspace.document_sets.map((documentSet) => {
                  return (
                    <Badge key={documentSet.id}>
                      <BookmarkIcon size={16} className="shrink-0" />
                      <span className="truncate">{documentSet.name}</span>
                    </Badge>
                  );
                })}
              </div>
            ) : (
              <p>There are document set.</p>
            )}
          </div>
        }
        title="Document Sets"
        open={isDocumentSetModalOpen}
        onClose={() => setIsDocumentSetModalOpen(false)}
      >
        {teamspace.document_sets.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-3">
            {teamspace.document_sets.map((document) => (
              <div
                key={document.id}
                className="border rounded-md flex p-4 gap-4"
              >
                <Globe />
                <div className="w-full">
                  <div className="flex items-center justify-between w-full">
                    <h3>{document.name}</h3>
                    <Checkbox />
                  </div>
                  <p className="text-sm pt-2 line-clamp">
                    {document.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          "There are no document sets."
        )}
      </CustomModal>
    </div>
  );
};
