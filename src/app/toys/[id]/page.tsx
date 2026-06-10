import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getToyById, listCustomFieldsByEntity } from "@/lib/api";
import ToyDetail from "@/components/toys/ToyDetail";

export const metadata: Metadata = {
  title: "Toy Details · The Game Pensieve",
};

// The single-toy edit screen. Fetches the toy and its custom-field definitions
// server-side (the definitions supply each field's type, options, and order),
// then hands them to the client ToyDetail for inline editing.
export default async function ToyDetailsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [toy, definitions] = await Promise.all([
    getToyById(Number(id)),
    listCustomFieldsByEntity("toy"),
  ]);

  if (!toy) notFound();

  const ordered = [...definitions].sort((a, b) => a.order - b.order);
  return <ToyDetail toy={toy} definitions={ordered} />;
}
