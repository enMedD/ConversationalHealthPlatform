import { ChatSession } from "../interfaces";
import { groupSessionsByDateRange } from "../lib";
import { ChatSessionDisplay } from "./ChatSessionDisplay";
import { removeChatFromFolder } from "../folders/FolderManagement";
import { FolderList } from "../folders/FolderList";
import { Folder } from "../folders/interfaces";
import { CHAT_SESSION_ID_KEY, FOLDER_ID_KEY } from "@/lib/drag/constants";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

export function ChatTab({
  existingChats,
  currentChatId,
  folders,
  openedFolders,
  toggleSideBar,
}: {
  existingChats: ChatSession[];
  currentChatId?: number;
  folders: Folder[];
  openedFolders: { [key: number]: boolean };
  toggleSideBar?: () => void;
}) {
  const groupedChatSessions = groupSessionsByDateRange(existingChats);
  const router = useRouter();
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const { toast } = useToast();

  const handleDropToRemoveFromFolder = async (
    event: React.DragEvent<HTMLDivElement>
  ) => {
    event.preventDefault();
    setIsDragOver(false); // Reset drag over state on drop
    const chatSessionId = parseInt(
      event.dataTransfer.getData(CHAT_SESSION_ID_KEY),
      10
    );
    const folderId = event.dataTransfer.getData(FOLDER_ID_KEY);

    if (folderId) {
      try {
        await removeChatFromFolder(parseInt(folderId, 10), chatSessionId);
        router.refresh(); // Refresh the page to reflect the changes
      } catch (error) {
        toast({
          title: "Error",
          description: "Failed to remove chat from folder",
          variant: "destructive",
        });
      }
    }
  };

  return (
    <div className="mb-1 px-4 transition-all ease-in-out">
      {folders.length > 0 && (
        <div>
          <div className="px-4 text-sm text-dark-900 flex pb-2 pt-4 font-semibold">
            Folders
          </div>
          <FolderList
            folders={folders}
            currentChatId={currentChatId}
            openedFolders={openedFolders}
          />
          <Separator className="mt-3" />
        </div>
      )}

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragOver(true);
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDropToRemoveFromFolder}
        className={`transition duration-300 ease-in-out ${
          isDragOver ? "bg-hover" : ""
        } rounded-xs`}
      >
        {Object.entries(groupedChatSessions).map(
          ([dateRange, chatSessions]) => {
            if (chatSessions.length > 0) {
              return (
                <div key={dateRange} className={`pt-4`}>
                  <div className="px-4 text-sm text-dark-900 flex pb-2 font-semibold">
                    {dateRange}
                  </div>
                  {chatSessions
                    .filter((chat) => chat.folder_id === null)
                    .map((chat) => {
                      const isSelected = currentChatId === chat.id;
                      return (
                        <div key={`${chat.id}-${chat.name}`}>
                          <ChatSessionDisplay
                            chatSession={chat}
                            isSelected={isSelected}
                            skipGradient={isDragOver}
                            toggleSideBar={toggleSideBar}
                          />
                        </div>
                      );
                    })}
                  <Separator className="mt-3" />
                </div>
              );
            }
          }
        )}
      </div>
    </div>
  );
}
