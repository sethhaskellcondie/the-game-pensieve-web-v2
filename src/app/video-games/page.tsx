import type { Metadata } from "next";
import { VideoGameBoxIcon, VideoGamesIcon } from "@/components/icons";
import Header from "@/components/Header";
import VideoGamesManager from "@/components/video-games/VideoGamesManager";
import VideoGameBoxesManager from "@/components/video-games/VideoGameBoxesManager";
import ViewToggle from "@/components/video-games/ViewToggle";
import { loadUiSettings } from "@/lib/uiSettings";
import { parseVideoGamesViewParam } from "@/lib/videoGamesView";
import styles from "./video-games.module.css";

export const metadata: Metadata = {
  title: "Video Games · The Game Pensieve",
};

// The page has two views over the same collection: the list (a table of video
// games) and the shelf (the video game boxes those games live in). The view is
// URL-driven (?view=list / ?view=shelf) so it survives reloads and back
// navigation; without a param, the user's Default Video Games View setting
// decides what the bare /video-games URL shows.
export default async function VideoGamesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const explicit = parseVideoGamesViewParam((await searchParams).view);
  const view = explicit ?? (await loadUiSettings()).videoGamesDefaultView;

  return (
    <>
      <Header
        icon={view === "shelf" ? <VideoGameBoxIcon /> : <VideoGamesIcon />}
        title="VIDEO "
        titleAccent="GAMES"
        tagline={
          view === "shelf"
            ? "All of your games as they appear on your shelves!"
            : "Every single game in your collection in one single list!"
        }
      >
        <ViewToggle view={view} />
      </Header>

      <main className={styles.content}>
        {view === "shelf" ? <VideoGameBoxesManager /> : <VideoGamesManager />}
      </main>
    </>
  );
}
