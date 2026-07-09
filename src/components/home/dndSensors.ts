"use client";

import {
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { sortableKeyboardCoordinates } from "@dnd-kit/sortable";

// The dashboard's drag sensors, split per input so each gets the right
// activation constraint (a single PointerSensor can't differ per pointer type):
// - Mouse: a click on a card opens its link; a real drag has to clear an 8px
//   threshold first, so the two never collide.
// - Touch: a long-press (with a little wobble tolerance) starts the drag, so a
//   tap still opens the link and a swipe still scrolls the category row.
// - Keyboard: dragging follows the horizontal sortable order.
// Exported (rather than inlined in the dashboard) so the config is unit-testable.
export const MOUSE_ACTIVATION = {
  activationConstraint: { distance: 8 },
};

export const TOUCH_ACTIVATION = {
  activationConstraint: { delay: 250, tolerance: 8 },
};

export function useDashboardSensors() {
  return useSensors(
    useSensor(MouseSensor, MOUSE_ACTIVATION),
    useSensor(TouchSensor, TOUCH_ACTIVATION),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
}
