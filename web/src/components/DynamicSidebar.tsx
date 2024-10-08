"use client";

import { AnimatePresence, motion } from "framer-motion";
import { WorkSpaceSidebar } from "@/app/chat/sessionSidebar/WorkSpaceSidebar";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { User } from "@/lib/types";
import { useContext, useEffect, useState } from "react";
import { SettingsContext } from "./settings/SettingsProvider";

interface SidebarProps {
  user?: User | null;
  isSearch?: boolean;
  openSidebar?: boolean;
  toggleLeftSideBar?: () => void;
  children?: React.ReactNode;
}

export function DynamicSidebar({
  user,
  isSearch,
  openSidebar,
  toggleLeftSideBar,
  children,
}: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isLgScreen, setIsLgScreen] = useState(false);

  const settings = useContext(SettingsContext);

  const toggleWidth = () => {
    setIsExpanded((prevState) => !prevState);
  };

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

  let opacityClass = "opacity-100";

  if (isLgScreen) {
    opacityClass = isExpanded ? "lg:opacity-100 delay-200" : "lg:opacity-0";
  } else {
    opacityClass = openSidebar
      ? "opacity-100"
      : "opacity-0 lg:opacity-100 delay-75";
  }

  return (
    <>
      <AnimatePresence>
        {openSidebar && (
          <motion.div
            className={`fixed w-full h-full bg-background-inverted bg-opacity-20 inset-0 z-overlay lg:hidden`}
            initial={{ opacity: 0 }}
            animate={{ opacity: openSidebar ? 1 : 0 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: 0.2,
              opacity: { delay: openSidebar ? 0 : 0.3 },
            }}
            style={{ pointerEvents: openSidebar ? "auto" : "none" }}
            onClick={toggleLeftSideBar}
          />
        )}
      </AnimatePresence>

      <div
        className={`fixed flex-none h-full z-overlay top-0 left-0 transition-[width] ease-in-out duration-500 overflow-hidden lg:overflow-visible lg:!w-auto ${
          openSidebar ? "w-[90vw] md:w-[75vw]" : "w-0"
        } ${isSearch ? "xl:relative" : "lg:relative"}`}
      >
        <div className="h-full relative flex w-full">
          <WorkSpaceSidebar openSidebar={openSidebar} user={user} />
          {children && (
            <>
              <div
                className={`bg-background h-full ease-in-out transition-[width] duration-500 w-full overflow-hidden lg:overflow-visible
          ${
            isExpanded
              ? "lg:w-sidebar border-r border-border"
              : "lg:w-0 border-none"
          }`}
              >
                <div
                  className={`h-full overflow-hidden flex flex-col transition-opacity duration-300 ease-in-out ${opacityClass}`}
                >
                  {children}
                </div>
              </div>
              <div className="h-full flex items-center justify-center">
                <button
                  onClick={toggleWidth}
                  className="border rounded-r py-2 border-l-0 bg-background hidden lg:flex"
                >
                  {isExpanded ? (
                    <ChevronLeft size={16} />
                  ) : (
                    <ChevronRight size={16} />
                  )}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
