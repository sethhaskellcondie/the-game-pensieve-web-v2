import type { Metadata } from "next";
import { VideoGamesIcon } from "@/components/icons";
import Header from "@/components/Header";
import VideoGamesManager from "@/components/video-games/VideoGamesManager";
import styles from "./video-games.module.css";

export const metadata: Metadata = {
  title: "Video Games · The Game Pensieve",
};

export default function VideoGamesPage() {
  return (
    <>
      <Header
        icon={<VideoGamesIcon />}
        title="VIDEO GAMES"
        tagline="All of your video games and their data in one place!"
      />

      <main className={styles.content}>
        <VideoGamesManager />
      </main>
    </>
  );
}
