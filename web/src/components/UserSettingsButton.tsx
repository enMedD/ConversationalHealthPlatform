"use client";

import { BasicClickable } from "@/components/BasicClickable";
import { LOGOUT_DISABLED } from "@/lib/constants";
import { User } from "@/lib/types";
import { checkUserIsNoAuthUser, logout } from "@/lib/user";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { FiLogOut, FiTool } from "react-icons/fi";
import { Popover } from "./popover/Popover";

export function UserSettingsButton({ user }: { user: User | null }) {
  const [userInfoVisible, setUserInfoVisible] = useState(false);
  const userInfoRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const handleLogout = () => {
    logout().then((isSuccess) => {
      if (!isSuccess) {
        alert("Failed to logout");
      }
      router.push("/auth/login");
    });
  };

  const toPascalCase = (str: string) =>
    (str.match(/[a-zA-Z0-9]+/g) || [])
      .map((w) => `${w.charAt(0).toUpperCase()}${w.slice(1)}`)
      .join("");
  const showAdminPanel = !user || user.role === "admin";
  const showLogout =
    user && !checkUserIsNoAuthUser(user.id) && !LOGOUT_DISABLED;

  return (
    <div className="relative w-full px-3 py-2" ref={userInfoRef}>
      <Popover
        triggerMaxWidth={true}
        matchWidth={true}
        open={userInfoVisible}
        onOpenChange={setUserInfoVisible}
        content={
          <BasicClickable fullWidth>
            <div
              onClick={() => setUserInfoVisible(!userInfoVisible)}
              className="flex min-w-full items-center gap-3 cursor-pointer px-3 py-2 bg-white"
            >
              <div className="flex items-center justify-center bg-white rounded-full min-h-10 min-w-10 aspect-square text-base font-normal border-2 border-gray-900 shadow-md">
                {user && user.email ? user.email[0].toUpperCase() : "A"}
              </div>
              <div className="w-full h-full flex flex-col items-start justify-center truncate">
                {/* TODO: Set this as a user.name - which will be added to the schema of the user and the database schema user table */}
                <p className="text-base font-semibold">
                  {user && user.email
                    ? `${toPascalCase(user.email.split(".")[0])} ${toPascalCase(
                        user.email.split(".")[1].split("@")[0]
                      )}`
                    : "Admin"}
                </p>
                <p className="text-xs">
                  {user && user.email ? user.email : "admin@enmedd-ai.com"}
                </p>
              </div>
            </div>
          </BasicClickable>
        }
        popover={
          <div
            className={`
                z-[60]
                text-strong 
                text-sm 
                border 
                border-border 
                bg-background 
                rounded-lg 
                shadow-lg  
                flex 
                flex-col 
                w-full 
                max-h-96 
                overflow-y-auto 
                p-1 
                overscroll-contain 
              `}
          >
            {showAdminPanel && (
              <>
                <Link
                  href="/admin/indexing/status"
                  className="flex py-3 px-4 cursor-pointer rounded hover:bg-hover-light"
                >
                  <FiTool className="my-auto mr-2 text-lg" />
                  Admin Panel
                </Link>
              </>
            )}
            {showLogout && (
              <>
                {showAdminPanel && (
                  <div className="my-1 border-t border-border" />
                )}
                <div
                  onClick={handleLogout}
                  className="mt-1 flex py-3 px-4 cursor-pointer hover:bg-hover-light"
                >
                  <FiLogOut className="my-auto mr-2 text-lg" />
                  Log out
                </div>
              </>
            )}
          </div>
        }
        side="top"
        align="end"
        sideOffset={10}
      />
    </div>
  );
}
