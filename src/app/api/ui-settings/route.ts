import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { updateUiSettings } from "@/lib/uiSettings";
import type { UiSettings } from "@/lib/uiSettings.types";

export async function POST(request: NextRequest) {
  try {
    const settings = (await request.json()) as UiSettings;
    await updateUiSettings({
      massInputMode: Boolean(settings.massInputMode),
      massEditMode: Boolean(settings.massEditMode),
      developerMode: Boolean(settings.developerMode),
      hideAnimations: Boolean(settings.hideAnimations),
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
