import type { SVGProps } from "react";
import IconBase from "./IconBase";

export default function BeginnerModeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      {/* A young seedling: stem with two leaves. */}
      <path d="M12 21v-8" />
      <path d="M12 13C12 9 9.5 6.5 4 6c.5 5.5 3 8 8 7Z" />
      <path d="M12 11c0-3.5 2-5.5 8-6-.5 5-2.5 7-8 6Z" />
    </IconBase>
  );
}
