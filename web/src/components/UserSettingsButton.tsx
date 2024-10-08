"use client";

import { useState, useRef, useContext } from "react";
import { FiTool, FiLogOut } from "react-icons/fi";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { User as UserTypes } from "@/lib/types";
import { checkUserIsNoAuthUser, logout } from "@/lib/user";
import { LOGOUT_DISABLED } from "@/lib/constants";
import {
  Bell,
  CircleUserRound,
  LogOut,
  MessageCircleMore,
  Search,
  User,
} from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { SettingsContext } from "./settings/SettingsProvider";

function getNameInitials(full_name: string) {
  const names = full_name.split(" ");
  return names[0][0].toUpperCase() + names[names.length - 1][0].toUpperCase();
}

export function UserSettingsButton({
  user,
  defaultPage,
}: {
  user?: UserTypes | null;
  defaultPage?: string;
}) {
  const [userInfoVisible, setUserInfoVisible] = useState(false);
  const userInfoRef = useRef<HTMLDivElement>(null);
  const settings = useContext(SettingsContext);
  const router = useRouter();

  const handleLogout = () => {
    logout().then((isSuccess) => {
      if (!isSuccess) {
        alert("Failed to logout");
      }
      router.push("/auth/login");
    });
  };

  const showAdminPanel = !user || user.role === "admin";
  const showLogout =
    user && !checkUserIsNoAuthUser(user.id) && !LOGOUT_DISABLED;

  return (
    <div className="relative" ref={userInfoRef}>
      <Popover>
        <PopoverTrigger
          asChild
          onClick={() => setUserInfoVisible(!userInfoVisible)}
          className="w-full relative cursor-pointer"
        >
          <div
            className="flex items-center justify-center bg-background rounded-full min-h-10 min-w-10 max-h-10 max-w-10 aspect-square text-base font-normal border-2 border-gray-900 ault py-2"
            onClick={() => setUserInfoVisible(!userInfoVisible)}
          >
            {user && user.full_name ? (
              // TODO: move the user's profile as a separate component
              getNameInitials(user.full_name)
            ) : (
              <User size={25} className="mx-auto" />
            )}
          </div>
        </PopoverTrigger>
        <PopoverContent className={`w-[250px] !z-modal mb-2 ml-4 text-sm`}>
          <div className="w-full">
            <>
              <div className="flex py-3 px-4 rounded-regular items-center gap-3 group">
                <div className="flex items-center justify-center bg-background rounded-full min-h-10 min-w-10 max-h-10 max-w-10 aspect-square text-base font-normal border-2 border-gray-900 ault py-2 text-default">
                  {user && user.full_name ? (
                    getNameInitials(user.full_name)
                  ) : (
                    <User size={25} className="mx-auto" />
                  )}
                </div>
                <div className="flex flex-col w-[160px]">
                  <span className="truncate">
                    {user?.full_name || "Unknown User"}
                  </span>
                  <span className="text-dark-500 truncate">
                    {user?.email || "anonymous@gmail.com"}
                  </span>
                </div>
              </div>
              <div className="my-1 border-b border-border" />
            </>
            {settings?.featureFlags.profile_page && (
              <Link
                href="/profile"
                className="flex py-3 px-4 cursor-pointer rounded-regular hover:bg-primary hover:text-inverted"
              >
                <User className="my-auto mr-3" size={24} strokeWidth={1.5} />
                Profile Settings
              </Link>
            )}
            <Link
              // redirect to default page
              href={`/${defaultPage}`}
              className="flex py-3 px-4 cursor-pointer rounded-regular hover:bg-primary hover:text-inverted"
            >
              <MessageCircleMore
                className="my-auto mr-3"
                size={24}
                strokeWidth={1.5}
              />
              Chat & Search
            </Link>
            {showAdminPanel && (
              <>
                <Link
                  href="/admin/indexing/status"
                  className="flex py-3 px-4 cursor-pointer rounded-regular hover:bg-primary hover:text-inverted"
                >
                  <FiTool
                    className="my-auto mr-3"
                    size={24}
                    strokeWidth={1.5}
                  />
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
                  className="mt-1 flex py-3 px-4 cursor-pointer hover:bg-destructive hover:text-inverted rounded-regular"
                >
                  <LogOut
                    className="my-auto mr-3"
                    size={24}
                    strokeWidth={1.5}
                  />
                  Log out
                </div>
              </>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
