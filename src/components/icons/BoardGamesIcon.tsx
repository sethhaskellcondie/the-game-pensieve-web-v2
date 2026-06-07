import type { SVGProps } from "react";
import IconBase from "./IconBase";

export default function BoardGamesIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M12 3l9 5-9 5-9-5 9-5z" />
      <path d="M3 13l9 5 9-5" />
    </IconBase>
  );
}
