import type { Metadata } from "next";
import { JetBrains_Mono, Press_Start_2P } from "next/font/google";
import Sidebar from "@/components/Sidebar";
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${jetBrainsMono.variable} ${pressStart2P.variable}`}
    >
      <body>
        <div className={styles.layout}>
          <Sidebar />
          <div className={styles.main}>{children}</div>
        </div>
      </body>
    </html>
  );
}
