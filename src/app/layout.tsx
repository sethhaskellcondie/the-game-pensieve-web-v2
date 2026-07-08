import type { Metadata, Viewport } from "next";
import { JetBrains_Mono, Press_Start_2P } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import MobileNav from "@/components/MobileNav";
import { ToastProvider } from "@/components/ToastProvider";
import { UiSettingsProvider } from "@/components/UiSettingsProvider";
import { SessionProvider } from "@/components/auth/SessionProvider";
import ShowcaseBanner from "@/components/auth/ShowcaseBanner";
import ImpersonationBanner from "@/components/auth/ImpersonationBanner";
import { loadUiSettings } from "@/lib/uiSettings";
import { loadSessionView } from "@/lib/session";
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

// Next emits this viewport meta tag by default, but the mobile layout depends
// on it (localFiles/adaptive_rollout.md), so pin it explicitly. Zoom stays
// enabled — capping maximumScale/userScalable hurts accessibility.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
  // (and present on first paint) via the provider below. The session view (auth
  // tier + email, never the tokens) is resolved from the cookie the same way.
  const [uiSettings, sessionView] = await Promise.all([
    loadUiSettings(),
    loadSessionView(),
  ]);

  return (
    <html
      lang="en"
      className={`${jetBrainsMono.variable} ${pressStart2P.variable}`}
    >
      <body>
        <ToastProvider>
          <SessionProvider initial={sessionView}>
            <UiSettingsProvider initial={uiSettings}>
              <div className={styles.layout}>
                {/* Exactly one of these is shown, switched purely in CSS at the
                    mobile breakpoint — see layout.module.css. */}
                <MobileNav />
                <Sidebar />
                <div className={styles.main}>
                  <ImpersonationBanner />
                  <ShowcaseBanner />
                  {children}
                </div>
              </div>
            </UiSettingsProvider>
          </SessionProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
