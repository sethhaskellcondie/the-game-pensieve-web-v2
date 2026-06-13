import type { Metadata } from "next";
import { BoardGameBoxIcon, BoardGamesIcon } from "@/components/icons";
import BeginnerHint from "@/components/BeginnerHint";
import Header from "@/components/Header";
import BoardGamesManager from "@/components/board-games/BoardGamesManager";
import BoardGameBoxesManager from "@/components/board-games/BoardGameBoxesManager";
import ViewToggle from "@/components/video-games/ViewToggle";
import { loadUiSettings } from "@/lib/uiSettings";
import { parseVideoGamesViewParam } from "@/lib/videoGamesView";
import styles from "./board-games.module.css";

export const metadata: Metadata = {
  title: "Board Games · The Game Pensieve",
};

// The page has two views over the same collection: the list (a table of board
// games) and the shelf (the board game boxes those games come in). The view is
// URL-driven (?view=list / ?view=shelf) so it survives reloads and back
// navigation; without a param, the user's Default Board Games View setting
// decides what the bare /board-games URL shows.
export default async function BoardGamesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const explicit = parseVideoGamesViewParam((await searchParams).view);
  const view = explicit ?? (await loadUiSettings()).boardGamesDefaultView;

  return (
    <>
      <Header
        icon={view === "shelf" ? <BoardGameBoxIcon /> : <BoardGamesIcon />}
        title="BOARD "
        titleAccent="GAMES"
        tagline={
          view === "shelf"
            ? "Every box on the shelf with a board game, or part of a board game in it!"
            : "Every board game you have, no matter how many boxes they are in!"
        }
      >
        <div className={styles.viewControls}>
          <BeginnerHint
            className={styles.viewHint}
            placement="bottom-end"
            text="Board Games can be viewed in two different ways the the list view will list all of the games that are in the collection, but some games come in multiple boxes, like expansions, or additional characters. So the shelf view will show all of the boxes that you have on your shelves."
          />
          <ViewToggle view={view} basePath="/board-games" pinned={false} />
        </div>
      </Header>

      <main className={styles.content}>
        {view === "shelf" ? <BoardGameBoxesManager /> : <BoardGamesManager />}
      </main>
    </>
  );
}
