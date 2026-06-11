import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getVideoGameBoxById,
  listCustomFieldsByEntity,
  searchSystems,
} from "@/lib/api";
import VideoGameBoxDetail from "@/components/video-games/VideoGameBoxDetail";

export const metadata: Metadata = {
  title: "Video Game Box Details · The Game Pensieve",
};

// The single-box edit screen. Fetches the box, its custom-field definitions,
// the videoGame definitions (which drive the read-only game chart's columns),
// and the systems list (the System dropdown's options) server-side, then hands
// them to the client VideoGameBoxDetail for inline editing.
export default async function VideoGameBoxDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [box, definitions, gameDefinitions, systems] = await Promise.all([
    getVideoGameBoxById(Number(id)),
    listCustomFieldsByEntity("videoGameBox"),
    listCustomFieldsByEntity("videoGame"),
    searchSystems([]),
  ]);

  if (!box) notFound();

  const byOrder = (a: { order: number }, b: { order: number }) =>
    a.order - b.order;
  return (
    <VideoGameBoxDetail
      box={box}
      definitions={[...definitions].sort(byOrder)}
      gameDefinitions={[...gameDefinitions].sort(byOrder)}
      systems={systems}
    />
  );
}
