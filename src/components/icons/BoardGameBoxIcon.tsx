import type { SVGProps } from "react";
import IconBase from "./IconBase";

// A stack of boxes sitting on a shelf — the "boxed" counterpart to
// BoardGamesIcon. Round caps match the soft look of the supplied design.
export default function BoardGameBoxIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M12 2.5 21 6.5 12 10.5 3 6.5 Z" />
      <path d="M3 10.5 12 14.5 21 10.5" />
      <path d="M3 14.5 12 18.5 21 14.5" />
      <path d="M2.5 21h19" />
    </IconBase>
  );
}
