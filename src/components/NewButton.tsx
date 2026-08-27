import type { ComponentProps } from "react";
import Button from "@/components/Button";
import { PlusIcon } from "@/components/custom-fields/icons";
import styles from "./NewButton.module.css";

// The green "+ New" action that ends the header row on every list screen
// (toys, systems, both box shelves, custom fields). Below the breakpoint the
// label is clipped so the header can't wrap onto a second line; the button
// keeps its "New" accessible name at every width, so assistive tech — and the
// tests — find it the same way on a phone as on a desktop.

type NewButtonProps = Omit<ComponentProps<"button">, "children" | "className"> & {
  // Extra class names are appended after the base style, so a page can add
  // layout tweaks without losing the palette.
  className?: string;
};

export default function NewButton({ className, ...rest }: NewButtonProps) {
  const classes = className ? `${styles.newBtn} ${className}` : styles.newBtn;
  return (
    <Button className={classes} {...rest}>
      <PlusIcon />
      <span className={styles.label}>New</span>
    </Button>
  );
}
