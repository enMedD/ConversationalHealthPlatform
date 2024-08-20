import "./globals.css";

import { SettingsProvider } from "@/components/settings/SettingsProvider";
import { getCombinedSettings } from "@/components/settings/lib";
import { CUSTOM_ANALYTICS_ENABLED } from "@/lib/constants";
import { buildClientUrl } from "@/lib/utilsSS";
import { Metadata } from "next";
import { Inter } from "next/font/google";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

// TODO: Make Enterprise settings normal settings / make it not enterprise
// since our only license is Copyright license
export async function generateMetadata(): Promise<Metadata> {
  const dynamicSettings = await getCombinedSettings({ forceRetrieval: true });
  const logoLocation =
    dynamicSettings.enterpriseSettings &&
    dynamicSettings.enterpriseSettings?.use_custom_logo
      ? "/api/enterprise-settings/logo"
      : buildClientUrl("/favicon.ico");

  return {
    title:
      dynamicSettings.enterpriseSettings?.application_name ?? "Arnold AI",
    description: "Arnold AI: Empowering Digital Health Solution of the Future",
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
        className={`${inter.variable} font-sans text-default bg-background ${
          // TODO: remove this once proper dark mode exists
          process.env.THEME_IS_DARK?.toLowerCase() === "true" ? "dark" : ""
        }`}
      >
        <SettingsProvider settings={combinedSettings}>
          {children}
        </SettingsProvider>
      </body>
    </html>
  );
}
