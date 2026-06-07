import type { Metadata } from "next";
import UnderConstruction from "@/components/UnderConstruction";
import { BoardGamesIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Board Games · The Game Pensieve",
};

export default function BoardGamesPage() {
  return <UnderConstruction label="Board Games" icon={<BoardGamesIcon />} />;
}
