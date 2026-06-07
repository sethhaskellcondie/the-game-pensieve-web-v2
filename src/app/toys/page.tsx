import type { Metadata } from "next";
import UnderConstruction from "@/components/UnderConstruction";
import { ToysIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Toys · The Game Pensieve",
};

export default function ToysPage() {
  return <UnderConstruction label="Toys" icon={<ToysIcon />} />;
}
