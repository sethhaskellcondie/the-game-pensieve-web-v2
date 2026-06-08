import type { ComponentProps, ReactNode } from "react";
import Link from "next/link";
import styles from "./Button.module.css";

// The single source of truth for action buttons across the app. Every button
// shares one fixed height, hover, and click (:active) behavior — width is left
// to flow with the content. Renders a real <button> by default, or a Next
// <Link> when an `href` is supplied (so navigation "buttons" stay uniform too),
// while keeping each element's native props strongly typed.

type CommonProps = {
  children: ReactNode;
  // Extra class names from the call site are appended after the base style so
  // layout tweaks (e.g. flex sizing in a row) can be applied without losing it.
  className?: string;
};

type ButtonAsButton = CommonProps &
  Omit<ComponentProps<"button">, "className"> & { href?: undefined };

type ButtonAsLink = CommonProps &
  Omit<ComponentProps<typeof Link>, "className"> & { href: string };

type ButtonProps = ButtonAsButton | ButtonAsLink;

export default function Button({
  children,
  className,
  ...rest
}: ButtonProps) {
  const classes = className ? `${styles.button} ${className}` : styles.button;

  if ("href" in rest && rest.href !== undefined) {
    const linkProps = rest as ButtonAsLink;
    return (
      <Link className={classes} {...linkProps}>
        {children}
      </Link>
    );
  }

  const buttonProps = rest as ButtonAsButton;
  // Default to type="button" so a button placed inside a form never submits it
  // by accident; callers can still pass type="submit" explicitly.
  return (
    <button className={classes} type={buttonProps.type ?? "button"} {...buttonProps}>
      {children}
    </button>
  );
}
