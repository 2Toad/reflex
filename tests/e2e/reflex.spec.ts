import { test, expect } from "@playwright/test";
import { reflex } from "@2toad/reflex";

test.describe("Reflex Quick Start", () => {
  test("should handle basic reactive value operations", async () => {
    // Create a reactive value
    const counter = reflex({ initialValue: 0 });
    expect(counter.value).toBe(0);

    // Test subscription
    let lastValue: number | undefined;
    counter.subscribe((value) => {
      lastValue = value;
    });
    expect(lastValue).toBe(0); // Initial value is sent to subscriber

    // Update the value and verify subscription was triggered
    counter.setValue(1);
    expect(counter.value).toBe(1);
    expect(lastValue).toBe(1);

    // Update again to ensure subscription continues working
    counter.setValue(2);
    expect(counter.value).toBe(2);
    expect(lastValue).toBe(2);
  });

  test("should handle multiple subscriptions", async () => {
    const counter = reflex({ initialValue: 0 });
    const values1: number[] = [];
    const values2: number[] = [];

    // Add multiple subscribers
    counter.subscribe((value) => values1.push(value));
    counter.subscribe((value) => values2.push(value));

    // Make some changes
    counter.setValue(1);
    counter.setValue(2);
    counter.setValue(3);

    // Verify both subscribers received all updates (including initial value)
    expect(values1).toEqual([0, 1, 2, 3]);
    expect(values2).toEqual([0, 1, 2, 3]);
  });
});
