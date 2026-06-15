import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getVideoGameById,
  listCustomFieldsByEntity,
  searchSystems,
} from "@/lib/api";
import VideoGameDetail from "@/components/video-games/VideoGameDetail";

export const metadata: Metadata = {
  title: "Video Game Details · The Game Pensieve",
};

// The single-game edit screen. Fetches the game, its custom-field definitions,
// the videoGameBox definitions (which drive the read-only boxes chart's
// columns), and the systems list (the System dropdown's options) server-side,
// then hands them to the client VideoGameDetail for inline editing.
export default async function VideoGameDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [game, definitions, boxDefinitions, systems] = await Promise.all([
    getVideoGameById(Number(id)),
    listCustomFieldsByEntity("videoGame"),
    listCustomFieldsByEntity("videoGameBox"),
    searchSystems([]),
  ]);

  if (!game) notFound();

  const byOrder = (a: { order: number }, b: { order: number }) =>
    a.order - b.order;
  return (
    <VideoGameDetail
      game={game}
      definitions={[...definitions].sort(byOrder)}
      boxDefinitions={[...boxDefinitions].sort(byOrder)}
      systems={systems}
    />
  );
}
