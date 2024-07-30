"use client";

import { BasicClickable } from "@/components/BasicClickable";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useContext, useEffect } from "react";
import {
  FiEdit,
  FiFolderPlus,
  FiMessageSquare,
  FiSearch,
  FiX,
} from "react-icons/fi";
import { ChatSession } from "../interfaces";

import {
  NEXT_PUBLIC_DO_NOT_USE_TOGGLE_OFF_DANSWER_POWERED,
  NEXT_PUBLIC_NEW_CHAT_DIRECTS_TO_SAME_PERSONA,
} from "@/lib/constants";

import { usePopup } from "@/components/admin/connectors/Popup";
import { SettingsContext } from "@/components/settings/SettingsProvider";
import { createFolder } from "../folders/FolderManagement";
import { Folder } from "../folders/interfaces";
import { ChatTab } from "./ChatTab";

import { FaHeadset } from "react-icons/fa";
/* import { Logo } from "@/components/Logo"; */
import { UserSettingsButton } from "@/components/UserSettingsButton";
import { useChatContext } from "@/components/context/ChatContext";
import { HeaderTitle } from "@/components/header/Header";
import Logo from "../../../../public/logo-brand.png";

export const ChatSidebar = ({
  existingChats,
  currentChatSession,
  folders,
  openedFolders,
  handleClose,
  openSidebar,
}: {
  existingChats: ChatSession[];
  currentChatSession: ChatSession | null | undefined;
  folders: Folder[];
  openedFolders: { [key: number]: boolean };
  handleClose?: () => void;
  openSidebar?: boolean;
}) => {
  let { user } = useChatContext();
  const router = useRouter();
  const { popup, setPopup } = usePopup();

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

  return (
    <>
      {popup}
      <div
        className={`py-4
        flex-none
        bg-background-weak
        border-r 
        border-border 
        flex-col 
        h-screen
        transition-transform z-30 ${
          openSidebar ? "w-full md:w-80 left-0 absolute flex" : "hidden lg:flex"
        }`}
        id="chat-sidebar"
      >
        <div className="flex">
          <div
            className="w-full"
            /*  href={
              settings && settings.default_page === "chat" ? "/chat" : "/search"
            } */
          >
            <div className="flex items-center w-full px-4">
              <div className="flex items-center justify-between w-full">
                <Image
                  className="mx-auto"
                  src={Logo}
                  alt="enmedd-logo"
                  width={112}
                />
                <FiX onClick={handleClose} className="lg:hidden" />
              </div>

              {enterpriseSettings && enterpriseSettings.application_name ? (
                <div>
                  <HeaderTitle>
                    {enterpriseSettings.application_name}
                  </HeaderTitle>

                  {!NEXT_PUBLIC_DO_NOT_USE_TOGGLE_OFF_DANSWER_POWERED && (
                    <p className="text-xs text-subtle -mt-1.5">
                      Powered by Vanguard AI
                    </p>
                  )}
                </div>
              ) : (
                <></>
              )}
            </div>
          </div>
        </div>
        {/* <HeaderTitle>enMedD CHP</HeaderTitle> */}
        {
          <div className="mt-5">
            {settings.search_page_enabled && (
              <Link
                href="/search"
                className="flex px-4 py-2 rounded cursor-pointer hover:bg-hover-light"
              >
                <FiSearch className="my-auto mr-2 text-base" />
                Search
              </Link>
            )}
            {settings.chat_page_enabled && (
              <>
                <Link
                  href="/chat"
                  className="flex px-4 py-2 rounded cursor-pointer hover:bg-hover-light"
                >
                  <FiMessageSquare className="my-auto mr-2 text-base" />
                  Chat
                </Link>
                <Link
                  href="/assistants/mine"
                  className="flex px-4 py-2 rounded cursor-pointer hover:bg-hover-light"
                >
                  <FaHeadset className="my-auto mr-2 text-base" />
                  My Assistants
                </Link>
              </>
            )}
          </div>
        }
        <div className="pb-4 mx-3 border-b border-border" />

        <ChatTab
          existingChats={existingChats}
          currentChatId={currentChatId}
          folders={folders}
          openedFolders={openedFolders}
        />

        <div className="flex items-center gap-3 px-3 pb-1">
          <Link
            href={
              "/chat" +
              (NEXT_PUBLIC_NEW_CHAT_DIRECTS_TO_SAME_PERSONA &&
              currentChatSession
                ? `?assistantId=${currentChatSession.persona_id}`
                : "")
            }
            className="w-full"
          >
            <BasicClickable fullWidth>
              <div className="flex items-center px-2 py-1 text-base">
                <FiEdit className="ml-1 mr-2" /> New Chat
              </div>
            </BasicClickable>
          </Link>
          <div className="h-full ">
            <BasicClickable
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
            >
              <div className="flex items-center h-full px-2 text-base aspect-square">
                <FiFolderPlus className="mx-auto my-auto" />
              </div>
            </BasicClickable>
          </div>
        </div>
        <UserSettingsButton user={user} />
      </div>
    </>
  );
};
