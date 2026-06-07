import type { SVGProps } from "react";
import IconBase from "./IconBase";

export default function ToysIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 21v-2a5 5 0 0110 0v2" />
    </IconBase>
  );
}
