import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { loadUiSettings, updateUiSettings } from "@/lib/uiSettings";
import { asCollectionView, type UiSettings } from "@/lib/uiSettings.types";

// Returns the current settings. loadUiSettings never throws (it falls back to
// defaults), so this always answers with a usable settings object.
export async function GET() {
  const settings = await loadUiSettings();
  return NextResponse.json(settings);
}

export async function POST(request: NextRequest) {
  try {
    const settings = (await request.json()) as UiSettings;
    await updateUiSettings({
      massInputMode: Boolean(settings.massInputMode),
      massEditMode: Boolean(settings.massEditMode),
      developerMode: Boolean(settings.developerMode),
      hideAnimations: Boolean(settings.hideAnimations),
      beginnerMode: Boolean(settings.beginnerMode),
      videoGamesDefaultView: asCollectionView(settings.videoGamesDefaultView),
      boardGamesDefaultView: asCollectionView(settings.boardGamesDefaultView),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
