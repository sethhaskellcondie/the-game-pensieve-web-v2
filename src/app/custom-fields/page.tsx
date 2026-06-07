import type { Metadata } from "next";
import UnderConstruction from "@/components/UnderConstruction";
import { CustomFieldsIcon } from "@/components/icons";

export const metadata: Metadata = {
  title: "Custom Fields · The Game Pensieve",
};

export default function CustomFieldsPage() {
  return <UnderConstruction label="Custom Fields" icon={<CustomFieldsIcon />} />;
}
