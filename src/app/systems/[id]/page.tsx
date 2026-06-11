import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSystemById, listCustomFieldsByEntity } from "@/lib/api";
import SystemDetail from "@/components/systems/SystemDetail";

export const metadata: Metadata = {
  title: "System Details · The Game Pensieve",
};

// The single-system edit screen. Fetches the system and its custom-field
// definitions server-side (the definitions supply each field's type, options,
// and order), then hands them to the client SystemDetail for inline editing.
export default async function SystemDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [system, definitions] = await Promise.all([
    getSystemById(Number(id)),
    listCustomFieldsByEntity("system"),
  ]);

  if (!system) notFound();

  const ordered = [...definitions].sort((a, b) => a.order - b.order);
  return <SystemDetail system={system} definitions={ordered} />;
}
