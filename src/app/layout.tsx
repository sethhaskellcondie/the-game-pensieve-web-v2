import type { Metadata } from "next";
import { JetBrains_Mono, Press_Start_2P } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import { ToastProvider } from "@/components/ToastProvider";
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

// Every route fetches live data from the backend (this layout loads UI settings,
// pages load games/toys/saved filters), and API_BASE_URL is supplied only at
// runtime — never at build time. Forcing dynamic rendering app-wide keeps Next
// from trying to prerender these pages during `next build`, where the backend is
// unreachable. Applied in the root layout so it cascades to all nested routes.
export const dynamic = "force-dynamic";

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
        <ToastProvider>
          <UiSettingsProvider initial={uiSettings}>
            <div className={styles.layout}>
              <Sidebar />
              <div className={styles.main}>{children}</div>
            </div>
          </UiSettingsProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
