import "./globals.css";
import { Inter as FontSans } from "next/font/google";
import { getCombinedSettings } from "@/components/settings/lib";
import { CUSTOM_ANALYTICS_ENABLED } from "@/lib/constants";
import { SettingsProvider } from "@/components/settings/SettingsProvider";
import { Metadata } from "next";
import { buildClientUrl } from "@/lib/utilsSS";
import { Toaster } from "@/components/ui/toaster";

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
});

export async function generateMetadata(): Promise<Metadata> {
  const dynamicSettings = await getCombinedSettings({ forceRetrieval: true });
  const logoLocation =
    dynamicSettings.workspaces && dynamicSettings.workspaces?.use_custom_logo
      ? "/api/workspace/logo"
      : buildClientUrl("/vanguard-ai.ico");

  return {
    title: dynamicSettings.workspaces?.workspace_name || "Vanguard AI",
    description:
      dynamicSettings.workspaces?.workspace_description ||
      "Vanguard AI: offers an AI model specifically designed to acquire \
      knowledge and understanding complex legal and regulatory frameworks \
      - such as Export Control",
    icons: {
      icon: logoLocation,
    },
  };
}

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const combinedSettings = await getCombinedSettings({});

  return (
    <html lang="en">
      {CUSTOM_ANALYTICS_ENABLED && combinedSettings.customAnalyticsScript && (
        <head>
          <script
            type="text/javascript"
            dangerouslySetInnerHTML={{
              __html: combinedSettings.customAnalyticsScript,
            }}
          />
        </head>
      )}
      <body
        className={`${fontSans.variable} font-sans text-default bg-background ${
          process.env.THEME_IS_DARK?.toLowerCase() === "true" ? "dark" : ""
        }`}
      >
        <SettingsProvider settings={combinedSettings}>
          {children}
          <Toaster />
        </SettingsProvider>
      </body>
    </html>
  );
}
