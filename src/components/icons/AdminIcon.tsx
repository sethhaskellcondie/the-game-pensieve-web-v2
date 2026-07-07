import type { SVGProps } from "react";
import IconBase from "./IconBase";

export default function AdminIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* A shield — role/access management. */}
      <path d="M12 3l7 3v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z" />
      <path d="M9.5 12l1.8 1.8L15 10" />
    </IconBase>
  );
}
