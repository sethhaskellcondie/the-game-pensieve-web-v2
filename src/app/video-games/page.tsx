import type { Metadata } from "next";
import { VideoGameBoxIcon, VideoGamesIcon } from "@/components/icons";
import BeginnerHint from "@/components/BeginnerHint";
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
  const resolvedParams = await searchParams;
  const explicit = parseVideoGamesViewParam(resolvedParams.view);
  const view = explicit ?? (await loadUiSettings()).videoGamesDefaultView;
  // Pre-applied filters from a home saved-filter card, if any.
  const initialFiltersParam = resolvedParams.filters;

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
        <div className={styles.viewControls}>
          <BeginnerHint
            className={styles.viewHint}
            placement="bottom-end"
            text={'Video Games can be viewed in two different ways the the shelf view shows all of the games as they appear on your shelf, but some games are compliations or collections of games there could be multiple games in a single cart, or disc. In the pensieve games appear in a "box" when listed on a shelf. The shelf view shows all of the video game boxes, and the list view shows all of your video games excluding repeats, and including all of the games that are in compliations or collections.'}
          />
          <ViewToggle view={view} pinned={false} />
        </div>
      </Header>

      <main className={styles.content}>
        {view === "shelf" ? (
          <VideoGameBoxesManager initialFiltersParam={initialFiltersParam} />
        ) : (
          <VideoGamesManager initialFiltersParam={initialFiltersParam} />
        )}
      </main>
    </>
  );
}
