import Image from "next/image";
import Header from "@/components/Header";
import Stats from "@/components/Stats";
import SavedFiltersDashboard from "@/components/home/SavedFiltersDashboard";
import type { FilterCategory } from "@/components/home/types";
import {
  searchVideoGames,
  searchVideoGameBoxes,
  searchBoardGames,
  searchBoardGameBoxes,
  searchToys,
} from "@/lib/api";
import { loadSavedFilterCategories } from "@/lib/savedFilterCategories";
import styles from "./page.module.css";

export default async function Home() {
  const [videoGameBoxes, videoGames, boardGameBoxes, boardGames, toys, categories] =
    await Promise.all([
      searchVideoGameBoxes(),
      searchVideoGames(),
      searchBoardGameBoxes(),
      searchBoardGames(),
      searchToys(),
      loadSavedFilterCategories(),
    ]);

  // The stored categories carry only { id, name, order }; saved filters aren't
  // wired yet, so each row starts with an empty card list.
  const initialCategories: FilterCategory[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    filters: [],
  }));

  return (
    <>
      <Header
        icon={<Image src="/blue_pensieve.svg" alt="" width={78} height={78} />}
        title="THE GAME"
        titleAccent="PENSIEVE"
        tagline="Explore ALL your games — not just how they appear on the shelf."
      >
        <Stats
          stats={[
            {
              value: String(videoGameBoxes.length),
              label: "Video Games on Shelf",
            },
            { value: String(videoGames.length), label: "All Video Games" },
            {
              value: String(boardGameBoxes.length),
              label: "Board Games on Shelf",
            },
            { value: String(boardGames.length), label: "All Board Games" },
            { value: String(toys.length), label: "Toys" },
          ]}
        />
      </Header>

      <main className={styles.content}>
        {/* Saved-filter shortcuts, grouped into categories loaded from the
            metadata store (the Uncategorized row is always included). */}
        <SavedFiltersDashboard initialCategories={initialCategories} />
      </main>
    </>
  );
}
