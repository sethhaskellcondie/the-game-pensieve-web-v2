"use client";

import Button from "@/components/Button";
import { useToast } from "@/components/ToastProvider";

// Stubbed subscription actions. Payment processing (Paddle) is wired up in
// Phase 7 — for now these just acknowledge the click so the flow is visible.
export default function PricingActions() {
  const { showToast } = useToast();

  const notWired = () =>
    showToast({
      message: "Payments arrive in a later phase — nothing was charged.",
      variant: "info",
    });

  return (
    <div>
      <Button type="button" onClick={notWired}>
        Upgrade
      </Button>{" "}
      <Button type="button" onClick={notWired}>
        Manage subscription
      </Button>
    </div>
  );
}
