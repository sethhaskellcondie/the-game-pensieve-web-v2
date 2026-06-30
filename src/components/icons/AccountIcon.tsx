import type { SVGProps } from "react";
import IconBase from "./IconBase";

export default function AccountIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <IconBase strokeLinecap="round" strokeLinejoin="round" {...props}>
      {/* A person bust — the account holder. */}
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-3.6 3.6-6 8-6s8 2.4 8 6" />
    </IconBase>
  );
}
