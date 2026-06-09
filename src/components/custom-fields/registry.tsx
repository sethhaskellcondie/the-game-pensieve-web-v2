// Single source of truth for the Custom Fields screen's type and entity
// metadata. Everything is keyed on the BACKEND enum values (see
// CustomFieldType / EntityKey in src/lib/api.ts) so the design prototype's
// own keys (yesno, progress, radio, board_game …) never leak into state.
//
// Colors are copied verbatim from the design handoff (cf-data.jsx FIELD_KINDS /
// ENTITY_KINDS, and the Custom Field Icons spec sheet); the glyph SVGs are
// ported from cf-grid.jsx KindGlyph / EntIcon.

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

export type EntityIcon = "chip" | "toy" | "monitor" | "layers";

export type EntityMeta = {
  label: string;
  icon: EntityIcon;
  bg: string;
  fg: string;
  dot: string;
};

// Box variants reuse their base icon by design. `system` is absent from the
// prototype's ENTITY_KINDS, so it gets a neutral slate palette.
export const ENTITY_META: Record<EntityKey, EntityMeta> = {
  system: { label: "System", icon: "chip", bg: "#E9ECF3", fg: "#4A5161", dot: "#8A93A3" },
  toy: { label: "Toys", icon: "toy", bg: "#ECE6F8", fg: "#6242BE", dot: "#8466D8" },
  videoGame: {
    label: "Video Game",
    icon: "monitor",
    bg: "#E5EEFB",
    fg: "#295FC0",
    dot: "#2F70EC",
  },
  videoGameBox: {
    label: "Video Game Box",
    icon: "monitor",
    bg: "#DCF0F9",
    fg: "#1B7AA6",
    dot: "#2C9FD6",
  },
  boardGame: {
    label: "Board Game",
    icon: "layers",
    bg: "#E5F3E9",
    fg: "#27823F",
    dot: "#2AA745",
  },
  boardGameBox: {
    label: "Board Game Box",
    icon: "layers",
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

// Entity / sidebar glyphs (ported from cf-grid.jsx EntIcon).
export function EntIcon({ icon }: { icon: EntityIcon }) {
  const p = {
    width: 17,
    height: 17,
    viewBox: "0 0 20 20",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (icon) {
    case "monitor":
      return (
        <svg {...p}>
          <rect x="2.5" y="3.5" width="15" height="10" rx="1.5" />
          <path d="M7 17h6M10 13.5V17" />
        </svg>
      );
    case "layers":
      return (
        <svg {...p}>
          <path d="M10 2.5l7 3.5-7 3.5-7-3.5z" />
          <path d="M3 10l7 3.5L17 10M3 13.5L10 17l7-3.5" />
        </svg>
      );
    case "toy":
      return (
        <svg {...p}>
          <rect x="4.5" y="6" width="11" height="9" rx="2" />
          <path d="M7.5 3.5v2.5M12.5 3.5v2.5" />
          <circle cx="8" cy="10" r="1" />
          <circle cx="12" cy="10" r="1" />
          <path d="M8.5 13h3" />
        </svg>
      );
    case "chip":
      return (
        <svg {...p}>
          <rect x="5" y="5" width="10" height="10" rx="1.5" />
          <path d="M8 5V2.5M12 5V2.5M8 17.5V15M12 17.5V15M5 8H2.5M5 12H2.5M17.5 8H15M17.5 12H15" />
        </svg>
      );
    default:
      return null;
  }
}
