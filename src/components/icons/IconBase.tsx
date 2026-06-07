import type { SVGProps } from "react";

// Shared wrapper for the app's line icons: a 24x24 canvas stroked in the
// current text color. Color is deliberately left to CSS via `currentColor`,
// so one icon adapts to its context — muted/white in the Sidebar, blue in a
// Header mark — without baking a color into the file. Callers pass the shapes
// as children and may override any attribute (e.g. className, width).
export default function IconBase(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      {...props}
    />
  );
}
