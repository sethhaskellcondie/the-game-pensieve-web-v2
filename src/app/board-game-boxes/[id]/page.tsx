import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getBoardGameBoxById,
  listCustomFieldsByEntity,
  searchBoardGameBoxes,
} from "@/lib/api";
import BoardGameBoxDetail from "@/components/board-games/BoardGameBoxDetail";

export const metadata: Metadata = {
  title: "Board Game Box Details · The Game Pensieve",
};

// The single-box edit screen. Fetches the box, its custom-field definitions,
// the boardGame definitions (which render the linked game's value grid), and
// the full box list (the base-set picker's options + the current base set's
// title) server-side, then hands them to the client BoardGameBoxDetail for
// inline editing.
export default async function BoardGameBoxDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [box, definitions, gameDefinitions, allBoxes] = await Promise.all([
    getBoardGameBoxById(Number(id)),
    listCustomFieldsByEntity("boardGameBox"),
    listCustomFieldsByEntity("boardGame"),
    searchBoardGameBoxes([]),
  ]);

  if (!box) notFound();

  const byOrder = (a: { order: number }, b: { order: number }) =>
    a.order - b.order;
  return (
    <BoardGameBoxDetail
      box={box}
      definitions={[...definitions].sort(byOrder)}
      gameDefinitions={[...gameDefinitions].sort(byOrder)}
      allBoxes={allBoxes}
    />
  );
}
