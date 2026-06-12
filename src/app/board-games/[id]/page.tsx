import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getBoardGameById, listCustomFieldsByEntity } from "@/lib/api";
import BoardGameDetail from "@/components/board-games/BoardGameDetail";

export const metadata: Metadata = {
  title: "Board Game Details · The Game Pensieve",
};

// The single-game edit screen. Fetches the game, its custom-field definitions,
// and the boardGameBox definitions (which drive the read-only boxes chart's
// columns and the embedded create-box dialog) server-side, then hands them to
// the client BoardGameDetail for inline editing.
export default async function BoardGameDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [game, definitions, boxDefinitions] = await Promise.all([
    getBoardGameById(Number(id)),
    listCustomFieldsByEntity("boardGame"),
    listCustomFieldsByEntity("boardGameBox"),
  ]);

  if (!game) notFound();

  const byOrder = (a: { order: number }, b: { order: number }) =>
    a.order - b.order;
  return (
    <BoardGameDetail
      game={game}
      definitions={[...definitions].sort(byOrder)}
      boxDefinitions={[...boxDefinitions].sort(byOrder)}
    />
  );
}
