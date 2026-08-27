import type { SVGProps } from "react";

export function SearchIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" />
    </svg>
  );
}

export function SortIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M5 13V3M2.5 5.5 5 3l2.5 2.5" />
      <path d="M11 3v10M8.5 10.5 11 13l2.5-2.5" />
    </svg>
  );
}

export function FilterIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M2.5 3.5h11l-4.2 5v4l-2.6 1.3v-5.3z" />
    </svg>
  );
}

// The "Show field names" toggle's glyph: a label/tag, for the field-name
// prefix the toggle adds to each card pill and bar.
export function TagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="15"
      height="15"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M8.4 2.5H13a.5.5 0 0 1 .5.5v4.6a1 1 0 0 1-.3.7l-5.4 5.4a1 1 0 0 1-1.4 0L2.8 9.6a1 1 0 0 1 0-1.4l5.4-5.4a1 1 0 0 1 .2-.3z" />
      <path d="M10.75 5.25h.01" />
    </svg>
  );
}
