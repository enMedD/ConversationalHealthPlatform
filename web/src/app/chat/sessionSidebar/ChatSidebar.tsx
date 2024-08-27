"use client";

import React, { useState } from "react";
import {
  Search,
  MessageCircleMore,
  Headset,
  FolderPlus,
  Plus,
  PanelLeftClose,
} from "lucide-react";
import { useContext, useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { ChatSession } from "../interfaces";

import {
  NEXT_PUBLIC_DO_NOT_USE_TOGGLE_OFF_DANSWER_POWERED,
  NEXT_PUBLIC_NEW_CHAT_DIRECTS_TO_SAME_PERSONA,
} from "@/lib/constants";

import { ChatTab } from "./ChatTab";
import { Folder } from "../folders/interfaces";
import { createFolder } from "../folders/FolderManagement";
import { usePopup } from "@/components/admin/connectors/Popup";
import { SettingsContext } from "@/components/settings/SettingsProvider";

import Logo from "../../../../public/logo-brand.png";
import { HeaderTitle } from "@/components/header/Header";
import { useChatContext } from "@/components/context/ChatContext";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export const ChatSidebar = ({
  existingChats,
  currentChatSession,
  folders,
  openedFolders,
  toggleSideBar,
  isExpanded,
  isSearch,
  openSidebar,
}: {
  existingChats: ChatSession[];
  currentChatSession: ChatSession | null | undefined;
  folders: Folder[];
  openedFolders: { [key: number]: boolean };
  toggleSideBar?: () => void;
  isExpanded?: boolean;
  isSearch?: boolean;
  openSidebar?: boolean;
}) => {
  let { user } = useChatContext();
  const router = useRouter();
  const { popup, setPopup } = usePopup();

  const [isLgScreen, setIsLgScreen] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    const handleMediaQueryChange = (e: MediaQueryListEvent) => {
      setIsLgScreen(e.matches);
    };

    setIsLgScreen(mediaQuery.matches);

    mediaQuery.addEventListener("change", handleMediaQueryChange);

    return () => {
      mediaQuery.removeEventListener("change", handleMediaQueryChange);
    };
  }, []);

  const currentChatId = currentChatSession?.id;

  // prevent the NextJS Router cache from causing the chat sidebar to not
  // update / show an outdated list of chats
  useEffect(() => {
    router.refresh();
  }, [currentChatId]);

  const combinedSettings = useContext(SettingsContext);
  if (!combinedSettings) {
    return null;
  }
  const settings = combinedSettings.settings;
  const enterpriseSettings = combinedSettings.enterpriseSettings;

  let opacityClass = "opacity-100";

  if (isLgScreen) {
    opacityClass = isExpanded ? "lg:opacity-100 delay-200" : "lg:opacity-0";
  } else {
    opacityClass = openSidebar
      ? "opacity-100 delay-200"
      : "opacity-0 lg:opacity-100";
  }

  return (
    <>
      {popup}
      <div
        className={`py-6
            bg-background
            flex-col 
            h-full
            ease-in-out
            flex
            transition-[width] duration-500
            z-overlay
            w-full overflow-hidden lg:overflow-visible
            ${
              isExpanded
                ? "lg:w-sidebar border-r border-border"
                : "lg:w-0 border-none"
            }
            `}
        id="chat-sidebar"
      >
        <div
          className={`h-full overflow-hidden flex flex-col transition-opacity duration-300 ease-in-out ${opacityClass}`}
        >
          <div className="flex items-center gap-2 w-full relative justify-between px-4 pb-4">
            <Image src={Logo} alt="enmedd-logo" height={40} />

            <div className="lg:hidden">
              <Button variant="ghost" size="icon" onClick={toggleSideBar}>
                <PanelLeftClose size={24} />
              </Button>
            </div>
          </div>

          <div className="px-4 pb-6 pt-2 w-full">
            <Popover>
              <PopoverTrigger asChild className="w-full">
                <div className="flex p-2 rounded-regular cursor-pointer hover:bg-hover-light items-center gap-2 shadow-sm text-sm">
                  <div className="px-1.5 py-0.5 rounded bg-primary-foreground font-bold text-white">
                    D
                  </div>
                  <span>Default</span>
                </div>
              </PopoverTrigger>
              <PopoverContent className="w-full">
                <div className="flex p-2 rounded-regular cursor-pointer hover:bg-hover-light items-center gap-2 text-sm w-full">
                  <div className="px-1.5 py-0.5 rounded bg-primary-foreground font-bold text-white">
                    D
                  </div>
                  <span>Development Team</span>
                </div>
              </PopoverContent>
            </Popover>
          </div>

          <div className="h-full overflow-auto">
            <div className="flex px-4">
              {enterpriseSettings && enterpriseSettings.application_name ? (
                <div>
                  <HeaderTitle>
                    {enterpriseSettings.application_name}
                  </HeaderTitle>

                  {!NEXT_PUBLIC_DO_NOT_USE_TOGGLE_OFF_DANSWER_POWERED && (
                    <p className="text-xs text-subtle -mt-1.5">
                      Powered by enMedD AI
                    </p>
                  )}
                </div>
              ) : (
                <></>
              )}
            </div>
            <div className="px-4 text-sm text-emphasis font-medium flex flex-col gap-1">
              {settings.search_page_enabled && (
                <Link
                  href="/search"
                  className={`flex p-2 rounded-regular cursor-pointer hover:bg-hover-light items-center gap-2 ${
                    isSearch ? "shadow-sm" : ""
                  }`}
                >
                  <Search size={16} className="min-w-4 min-h-4" />
                  Search
                </Link>
              )}
              {settings.chat_page_enabled && (
                <>
                  <Link
                    href="/chat"
                    className={`flex p-2 rounded-regular cursor-pointer hover:bg-hover-light items-center gap-2 ${
                      !isSearch ? "shadow-sm" : ""
                    }`}
                  >
                    <MessageCircleMore size={16} className="min-w-4 min-h-4" />
                    Chat
                  </Link>
                  <Link
                    href="/assistants/mine"
                    className="flex p-2 rounded-regular cursor-pointer hover:bg-hover-light items-center gap-2"
                  >
                    <Headset size={16} />
                    <span className="truncate">Explore Assistants</span>
                  </Link>
                </>
              )}
              <Separator className="mt-4" />
            </div>

            {!isSearch && (
              <ChatTab
                existingChats={existingChats}
                currentChatId={currentChatId}
                folders={folders}
                openedFolders={openedFolders}
                toggleSideBar={toggleSideBar}
              />
            )}
          </div>

          {!isSearch && (
            <div className="flex items-center gap-3 px-4 pt-4 mt-auto">
              <Link
                href={
                  "/chat" +
                  (NEXT_PUBLIC_NEW_CHAT_DIRECTS_TO_SAME_PERSONA &&
                  currentChatSession
                    ? `?assistantId=${currentChatSession.persona_id}`
                    : "")
                }
                className=" w-full"
              >
                <Button
                  className="transition-all ease-in-out duration-300 w-full"
                  onClick={toggleSideBar}
                >
                  <Plus size={16} />
                  Start new chat
                </Button>
              </Link>
              <div>
                <Button
                  onClick={() =>
                    createFolder("New Folder")
                      .then((folderId) => {
                        console.log(`Folder created with ID: ${folderId}`);
                        router.refresh();
                      })
                      .catch((error) => {
                        console.error("Failed to create folder:", error);
                        setPopup({
                          message: `Failed to create folder: ${error.message}`,
                          type: "error",
                        });
                      })
                  }
                  size="icon"
                >
                  <FolderPlus size={16} />
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};
