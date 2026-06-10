import type { SVGProps } from "react";
import IconBase from "./IconBase";

// A row of three cartridge/case spines standing on a shelf — the "boxed"
// counterpart to VideoGamesIcon. Uses round caps to match the soft look of
// the supplied design.
export default function VideoGameBoxIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M3.5 20.25h17" />
      <rect x="5.75" y="5.75" width="3.7" height="14.5" rx="1" />
      <rect x="10.15" y="5.75" width="3.7" height="14.5" rx="1" />
      <rect x="14.55" y="5.75" width="3.7" height="14.5" rx="1" />
      <path d="M5.75 9.6h3.7" />
      <path d="M10.15 9.6h3.7" />
      <path d="M14.55 9.6h3.7" />
    </IconBase>
  );
}
