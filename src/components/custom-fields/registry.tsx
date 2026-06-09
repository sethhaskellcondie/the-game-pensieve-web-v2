// Single source of truth for the Custom Fields screen's type and entity
// metadata. Everything is keyed on the BACKEND enum values (see
// CustomFieldType / EntityKey in src/lib/api.ts) so the design prototype's
// own keys (yesno, progress, radio, board_game …) never leak into state.
//
// Colors are copied verbatim from the design handoff (cf-data.jsx FIELD_KINDS /
// ENTITY_KINDS, and the Custom Field Icons spec sheet); the field-type glyph
// SVGs are ported from cf-grid.jsx KindGlyph.

import type { CustomFieldType, EntityKey } from "@/lib/api";

export type FieldTypeMeta = {
  label: string;
  bg: string;
  fg: string;
  hasOptions: boolean;
};

// Colors mirror the icon spec sheet. `hasOptions` flags the kinds that carry a
// list of options (Dropdown, Radio Button, Progress Bar).
export const FIELD_TYPE_META: Record<CustomFieldType, FieldTypeMeta> = {
  text: { label: "Text", bg: "#E7F0FC", fg: "#2657B8", hasOptions: false },
  boolean: { label: "Yes / No", bg: "#DCEFE0", fg: "#1E8038", hasOptions: false },
  number: { label: "Number", bg: "#ECE6FA", fg: "#6242BE", hasOptions: false },
  progress_bar: {
    label: "Progress Bar",
    bg: "#D6EFEC",
    fg: "#157E74",
    hasOptions: true,
  },
  dropdown: { label: "Dropdown", bg: "#FAEDCF", fg: "#9A6F12", hasOptions: true },
  radio_button: {
    label: "Radio Button",
    bg: "#FBE4E2",
    fg: "#C0392B",
    hasOptions: true,
  },
};

// Order shown in the "New field" type picker (matches the prototype).
export const FIELD_TYPE_ORDER: CustomFieldType[] = [
  "text",
  "boolean",
  "number",
  "progress_bar",
  "dropdown",
  "radio_button",
];

export function hasOptions(type: CustomFieldType): boolean {
  return FIELD_TYPE_META[type].hasOptions;
}

export type EntityMeta = {
  label: string;
  bg: string;
  fg: string;
  dot: string;
};

// `system` is absent from the prototype's ENTITY_KINDS, so it gets a neutral
// slate palette. (Entity icons come from the shared src/components/icons set,
// mapped per entity in EntitySelect.)
export const ENTITY_META: Record<EntityKey, EntityMeta> = {
  system: { label: "System", bg: "#E9ECF3", fg: "#4A5161", dot: "#8A93A3" },
  toy: { label: "Toys", bg: "#ECE6F8", fg: "#6242BE", dot: "#8466D8" },
  videoGame: {
    label: "Video Game",
    bg: "#E5EEFB",
    fg: "#295FC0",
    dot: "#2F70EC",
  },
  videoGameBox: {
    label: "Video Game Box",
    bg: "#DCF0F9",
    fg: "#1B7AA6",
    dot: "#2C9FD6",
  },
  boardGame: {
    label: "Board Game",
    bg: "#E5F3E9",
    fg: "#27823F",
    dot: "#2AA745",
  },
  boardGameBox: {
    label: "Board Game Box",
    bg: "#F3ECD9",
    fg: "#8A6A14",
    dot: "#C9961A",
  },
};

// Display order in the entity selector dropdown (matches the prototype).
export const ENTITY_ORDER: EntityKey[] = [
  "system",
  "toy",
  "videoGame",
  "videoGameBox",
  "boardGame",
  "boardGameBox",
];

export const DEFAULT_ENTITY: EntityKey = "boardGame";

// The six canonical custom-field-type glyphs (ported from cf-grid.jsx
// KindGlyph). Stroke inherits currentColor so each follows its badge fg.
export function KindGlyph({
  type,
  size = 15,
}: {
  type: CustomFieldType;
  size?: number;
}) {
  const p = {
    viewBox: "0 0 24 24",
    width: size,
    height: size,
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (type) {
    case "text":
      return (
        <svg {...p}>
          <path d="M6 7.5V6h12v1.5" />
          <path d="M12 6v12" />
          <path d="M9 18h6" />
        </svg>
      );
    case "boolean":
      return (
        <svg {...p}>
          <path d="M4 12.5l5 5L20 6.5" />
        </svg>
      );
    case "number":
      return (
        <svg {...p}>
          <path d="M9.5 5 7.5 19" />
          <path d="M16.5 5 14.5 19" />
          <path d="M5 9.5h14" />
          <path d="M4.5 14.5h14" />
        </svg>
      );
    case "progress_bar":
      return (
        <svg {...p}>
          <rect x="3" y="9" width="18" height="6" rx="3" />
          <path d="M6 12h7" strokeWidth="3.2" />
        </svg>
      );
    case "dropdown":
      return (
        <svg {...p}>
          <rect x="3" y="6" width="18" height="12" rx="2.6" />
          <path d="M9 10.5l3 3 3-3" />
        </svg>
      );
    case "radio_button":
      return (
        <svg {...p}>
          <circle cx="7" cy="8" r="3" />
          <circle cx="7" cy="8" r="1.25" fill="currentColor" stroke="none" />
          <path d="M13 8h5" />
          <circle cx="7" cy="16" r="3" />
          <path d="M13 16h5" />
        </svg>
      );
    default:
      return null;
  }
}
