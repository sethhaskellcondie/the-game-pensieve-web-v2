import type { Metadata } from "next";
import UnderConstruction from "@/components/UnderConstruction";
import { SystemsIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Systems · The Game Pensieve",
};

export default function SystemsPage() {
  return <UnderConstruction label="Systems" icon={<SystemsIcon />} />;
}
