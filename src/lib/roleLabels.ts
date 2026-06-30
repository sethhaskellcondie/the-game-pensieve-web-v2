// Human-facing display names for the resolved session role (the "plan"). Single
// source of truth shared by the sidebar AccountMenu and the Account page so the
// label stays consistent everywhere it surfaces. See src/lib/sessionConfig.ts
// for the Role vocabulary.
import type { Role } from "./sessionConfig";

export const ROLE_LABEL: Record<Role, string> = {
  guest: "Guest",
  trial: "Trial",
  paid: "Paid",
  lapsed: "Lapsed",
  admin: "Admin",
  // The role probe (GET /v1/auth/me) couldn't resolve a role — shown plainly
  // rather than masked as a real plan. The badge CSS uppercases it to UNKNOWN.
  unknown: "Unknown",
};

export function roleLabel(role: Role): string {
  return ROLE_LABEL[role] ?? ROLE_LABEL.unknown;
}
