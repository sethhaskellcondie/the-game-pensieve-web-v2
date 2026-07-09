import { renderHook } from "@testing-library/react";
import { KeyboardSensor, MouseSensor, TouchSensor } from "@dnd-kit/core";
import {
  MOUSE_ACTIVATION,
  TOUCH_ACTIVATION,
  useDashboardSensors,
} from "@/components/home/dndSensors";

// The saved-filter cards are both links and drag handles, so the activation
// constraints are load-bearing: without them a tap/click would start a drag
// instead of opening the card (and touch devices couldn't drag at all before
// the TouchSensor existed).
describe("useDashboardSensors", () => {
  it("configures mouse, touch, and keyboard sensors", () => {
    const { result } = renderHook(() => useDashboardSensors());

    const bySensor = new Map(result.current.map((d) => [d.sensor, d.options]));
    expect(bySensor.get(MouseSensor)).toEqual(MOUSE_ACTIVATION);
    expect(bySensor.get(TouchSensor)).toEqual(TOUCH_ACTIVATION);
    expect(bySensor.has(KeyboardSensor)).toBe(true);
    expect(result.current).toHaveLength(3);
  });

  it("requires real movement (mouse) or a long-press (touch) to start a drag", () => {
    expect(MOUSE_ACTIVATION.activationConstraint.distance).toBeGreaterThan(0);
    expect(TOUCH_ACTIVATION.activationConstraint.delay).toBeGreaterThanOrEqual(
      200,
    );
    expect(
      TOUCH_ACTIVATION.activationConstraint.tolerance,
    ).toBeGreaterThan(0);
  });
});
