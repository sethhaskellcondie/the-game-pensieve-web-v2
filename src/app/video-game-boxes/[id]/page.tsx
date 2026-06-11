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
// and the systems list (the System dropdown's options) server-side, then hands
// them to the client VideoGameBoxDetail for inline editing.
export default async function VideoGameBoxDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [box, definitions, systems] = await Promise.all([
    getVideoGameBoxById(Number(id)),
    listCustomFieldsByEntity("videoGameBox"),
    searchSystems([]),
  ]);

  if (!box) notFound();

  const ordered = [...definitions].sort((a, b) => a.order - b.order);
  return (
    <VideoGameBoxDetail box={box} definitions={ordered} systems={systems} />
  );
}
