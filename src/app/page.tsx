import Image from "next/image";
import Header from "@/components/Header";
import Stats from "@/components/Stats";
import {
  searchVideoGames,
  searchVideoGameBoxes,
  searchBoardGames,
  searchBoardGameBoxes,
  searchToys,
} from "@/lib/api";
import styles from "./page.module.css";

export default async function Home() {
  const [videoGameBoxes, videoGames, boardGameBoxes, boardGames, toys] =
    await Promise.all([
      searchVideoGameBoxes(),
      searchVideoGames(),
      searchBoardGameBoxes(),
      searchBoardGames(),
      searchToys(),
    ]);

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
        {/* Page content */}
      </main>
    </>
  );
}
