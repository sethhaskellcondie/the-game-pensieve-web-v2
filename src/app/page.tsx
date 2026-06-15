import Image from "next/image";
import Header from "@/components/Header";
import Stats from "@/components/Stats";
import SavedFiltersDashboard from "@/components/home/SavedFiltersDashboard";
import type { FilterCategory, SavedFilter } from "@/components/home/types";
import {
  searchVideoGames,
  searchVideoGameBoxes,
  searchBoardGames,
  searchBoardGameBoxes,
  searchToys,
} from "@/lib/api";
import { loadSavedFilterCategories } from "@/lib/savedFilterCategories";
import { UNCATEGORIZED_ID } from "@/lib/savedFilterCategories.types";
import { loadSavedFilters } from "@/lib/savedFilters";
import styles from "./page.module.css";

export default async function Home() {
  const [
    videoGameBoxes,
    videoGames,
    boardGameBoxes,
    boardGames,
    toys,
    categories,
    savedFilters,
  ] = await Promise.all([
    searchVideoGameBoxes(),
    searchVideoGames(),
    searchBoardGameBoxes(),
    searchBoardGames(),
    searchToys(),
    loadSavedFilterCategories(),
    loadSavedFilters(),
  ]);

  // Group the saved filters under their category, ordered within it. A filter
  // whose category no longer exists falls back to Uncategorized (which the
  // categories store always includes), so an orphan never disappears.
  const knownCategoryIds = new Set(categories.map((c) => c.id));
  const grouped = new Map<string, { order: number; filter: SavedFilter }[]>();
  for (const f of savedFilters) {
    const cid = knownCategoryIds.has(f.categoryId)
      ? f.categoryId
      : UNCATEGORIZED_ID;
    const entry = grouped.get(cid) ?? [];
    entry.push({
      order: f.order,
      filter: {
        id: f.id,
        name: f.name,
        entity: f.entity,
        conditions: f.conditions.map((c) => ({
          id: c.id,
          field: c.field,
          label: c.label,
          kind: c.kind,
          source: c.source,
          operator: c.operator,
          operand: c.operand,
          operandLabel: c.operandLabel,
        })),
      },
    });
    grouped.set(cid, entry);
  }

  const initialCategories: FilterCategory[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    filters: (grouped.get(c.id) ?? [])
      .sort((a, b) => a.order - b.order)
      .map((e) => e.filter),
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
