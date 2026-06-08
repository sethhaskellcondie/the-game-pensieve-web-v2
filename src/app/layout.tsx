import type { Metadata } from "next";
import { JetBrains_Mono, Press_Start_2P } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { loadUiSettings } from "@/lib/uiSettings";
import "./globals.css";
import styles from "./layout.module.css";

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const pressStart2P = Press_Start_2P({
  variable: "--font-press-start",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Game Pensieve",
  description: "Welcome to the Game Pensieve!",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get-or-create the UI settings in the backend so they're available app-wide
  // (and present on first paint) via the provider below.
  const uiSettings = await loadUiSettings();

  return (
    <html
      lang="en"
      className={`${jetBrainsMono.variable} ${pressStart2P.variable}`}
    >
      <body>
        <UiSettingsProvider initial={uiSettings}>
          <div className={styles.layout}>
            <Sidebar />
            <div className={styles.main}>{children}</div>
          </div>
        </UiSettingsProvider>
      </body>
    </html>
  );
}
