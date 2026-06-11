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
// and the systems list (the System dropdown's options) server-side, then hands
// them to the client VideoGameDetail for inline editing.
export default async function VideoGameDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [game, definitions, systems] = await Promise.all([
    getVideoGameById(Number(id)),
    listCustomFieldsByEntity("videoGame"),
    searchSystems([]),
  ]);

  if (!game) notFound();

  const ordered = [...definitions].sort((a, b) => a.order - b.order);
  return <VideoGameDetail game={game} definitions={ordered} systems={systems} />;
}
