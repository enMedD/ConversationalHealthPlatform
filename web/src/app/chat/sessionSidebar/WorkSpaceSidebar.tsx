import { UserSettingsButton } from "@/components/UserSettingsButton";
import { Ellipsis } from "lucide-react";
import Image from "next/image";

import ArnoldAi from "../../../../public/arnold_ai.png";
import enMedD from "../../../../public/logo.png";
import { Separator } from "@/components/ui/separator";
import { User } from "@/lib/types";
import { CustomTooltip } from "@/components/CustomTooltip";

interface WorkSpaceSidebarProps {
  openSidebar?: boolean;
  user?: User | null;
}

export const WorkSpaceSidebar = ({
  openSidebar,
  user,
}: WorkSpaceSidebarProps) => {
  return (
    <div className={`bg-background h-full px-4 py-6 border-r border-border`}>
      <div
        className={`h-full flex flex-col justify-between transition-opacity duration-300 ease-in-out lg:!opacity-100  ${
          openSidebar ? "opacity-100 delay-200" : "opacity-0 delay-100"
        }`}
      >
        <div className="flex flex-col items-center gap-6">
          <Image
            src={ArnoldAi}
            alt="ArnoldAi Logo"
            width={40}
            height={40}
            className="rounded-regular min-w-10 min-h-10"
          />
          <Separator />
          <div className="flex flex-col items-center gap-6">
            <CustomTooltip
              trigger={
                <div className="flex items-center">
                  <Image
                    src={enMedD}
                    alt="enMedD Logo"
                    width={40}
                    height={40}
                    className="rounded-full min-w-10 min-h-10"
                  />
                </div>
              }
              side="right"
              delayDuration={0}
            >
              enMeDd
            </CustomTooltip>

            <CustomTooltip
              trigger={
                <div className="h-10 w-10 hover:bg-light hover:text-accent-foreground flex items-center justify-center rounded-regular">
                  <Ellipsis size={16} strokeWidth={2.5} />
                </div>
              }
              side="right"
              delayDuration={0}
            >
              More
            </CustomTooltip>
          </div>
        </div>
        <div className="flex flex-col items-center gap-4">
          <UserSettingsButton user={user} />
        </div>
      </div>
    </div>
  );
};
