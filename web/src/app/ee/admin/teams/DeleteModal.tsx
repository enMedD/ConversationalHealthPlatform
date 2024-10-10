"use client";

import { CustomModal } from "@/components/CustomModal";
import { CustomTooltip } from "@/components/CustomTooltip";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { useState } from "react";

export function DeleteModal({ type }: { type: string }) {
  const [deleteModalIsOpen, setDeleteModalIsOpen] = useState(false);

  return (
    <CustomModal
      trigger={
        <CustomTooltip
          trigger={
            <Button
              variant="ghost"
              size="smallIcon"
              className="ml-auto"
              onClick={() => setDeleteModalIsOpen(true)}
            >
              <X size={16} />
            </Button>
          }
          asChild
        >
          Remove
        </CustomTooltip>
      }
      title={`Do you want to remove this ${type}?`}
      onClose={() => setDeleteModalIsOpen(false)}
      open={deleteModalIsOpen}
    >
      <p className="pb-4">
        You are about to remove this {type}, and it will no longer be available
        in your space.
      </p>
      <div className="flex justify-end gap-2 pt-6 border-t w-full">
        <Button onClick={() => setDeleteModalIsOpen(false)} variant="secondary">
          Keep {type}
        </Button>
        <Button
          onClick={() => setDeleteModalIsOpen(false)}
          variant="destructive"
        >
          Remove {type}
        </Button>
      </div>
    </CustomModal>
  );
}
