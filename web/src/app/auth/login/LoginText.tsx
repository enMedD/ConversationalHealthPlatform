"use client";

import { SettingsContext } from "@/components/settings/SettingsProvider";
import { useContext } from "react";

export const LoginText = () => {
  const settings = useContext(SettingsContext);

  if (!settings) {
    throw new Error("SettingsContext is not available");
  }

  return (
    <div className="text-black">
      <h1 className="my-2 text-3xl font-bold">Login</h1>
      <p>
        Welcome back to{" "}
        {settings?.enterpriseSettings?.application_name || "Vanguard AI"}! Please
        enter your details
      </p>
    </div>
  );
};
