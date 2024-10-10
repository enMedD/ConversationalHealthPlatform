"use client";

import React, { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";

const PageSwitcher: React.FC = () => {
  useKeyboardShortcuts([
    {
      key: "s",
      handler: () => {
        window.location.href = "/search";
      },
      ctrlKey: true,
    },
    {
      key: "d",
      handler: () => {
        window.location.href = "/chat";
      },
      ctrlKey: true,
    },
    {
      key: "p",
      handler: () => {
        window.location.href = "/profile";
      },
      ctrlKey: true,
    },
    {
      key: "q",
      handler: () => {
        window.location.href = "/admin/indexing/status";
      },
      ctrlKey: true,
    },
  ]);

  return <div />;
};

export default PageSwitcher;
