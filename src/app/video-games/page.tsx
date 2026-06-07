import type { Metadata } from "next";
import UnderConstruction from "@/components/UnderConstruction";
import { VideoGamesIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Video Games · The Game Pensieve",
};

export default function VideoGamesPage() {
  return <UnderConstruction label="Video Games" icon={<VideoGamesIcon />} />;
}
