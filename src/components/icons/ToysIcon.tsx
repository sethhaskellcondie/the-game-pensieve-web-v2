import type { SVGProps } from "react";
import IconBase from "./IconBase";

export default function ToysIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase
      viewBox="2 1 20 20"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M12 2v2.5" />
      <circle cx="12" cy="5" r="1" />
      <rect x="6" y="6.5" width="12" height="9" rx="2" />
      <circle cx="9.5" cy="11" r="1.1" fill="currentColor" />
      <circle cx="14.5" cy="11" r="1.1" fill="currentColor" />
      <path d="M8 15.5v4M16 15.5v4M4 10v3M20 10v3" />
    </IconBase>
  );
}
