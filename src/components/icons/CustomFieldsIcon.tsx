import type { SVGProps } from "react";
import IconBase from "./IconBase";

export default function CustomFieldsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase {...props}>
      <path d="M14 4l6 6M3 21l3-1 11-11-2-2L4 18l-1 3z" />
    </IconBase>
  );
}
