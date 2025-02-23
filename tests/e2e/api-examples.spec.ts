import { test, expect } from "@playwright/test";
import { reflex, deepReflex, computed, combine } from "@2toad/reflex";
import type { ReflexOptions, PropertyPath } from "@2toad/reflex";

interface User {
  profile: {
    name: string;
    age?: number;
  };
}

test.describe("API Reference Examples", () => {
  test("core reflex with middleware and error handling", async () => {
    const updates: number[] = [];

    // Apply middleware to initial value
    const initialValue = -5;
    const applyMiddleware = (value: number) => Math.round(Math.max(0, value));

    const counter = reflex<number>({
      initialValue: applyMiddleware(initialValue),
      equals: (a, b) => a === b,
      middleware: [(value) => Math.max(0, value), (value) => Math.round(value)],
    });

    counter.subscribe((value) => updates.push(value));

    // Initial value should be transformed by middleware
    expect(counter.value).toBe(0);
    expect(updates).toEqual([0]);

    // Test middleware (non-negative)
    counter.setValue(-5);
    expect(counter.value).toBe(0);
    // No update since value didn't change after middleware
    expect(updates).toEqual([0]);

    // Test middleware (rounding)
    counter.setValue(3.7);
    expect(counter.value).toBe(4);
    expect(updates).toEqual([0, 4]);

    // Test normal update
    counter.setValue(5);
    expect(counter.value).toBe(5);
    expect(updates).toEqual([0, 4, 5]);
  });

  test("deep reflex with property change tracking", async () => {
    const propertyChanges: Array<{ path: PropertyPath; value: unknown }> = [];

    const user = deepReflex<User>({
      initialValue: {
        profile: { name: "John" },
      },
      onPropertyChange: (path, value) => {
        propertyChanges.push({ path, value });
      },
    });

    // Test direct property modification
    user.value.profile.name = "Jane";
    expect(user.value.profile.name).toBe("Jane");
    expect(propertyChanges).toEqual([{ path: ["profile", "name"], value: "Jane" }]);

    // Test batch updates
    user.batch((value) => {
      value.profile.name = "Alice";
      value.profile.age = 30;
    });

    expect(user.value.profile.name).toBe("Alice");
    expect(user.value.profile.age).toBe(30);
    expect(propertyChanges).toEqual([
      { path: ["profile", "name"], value: "Jane" },
      { path: ["profile", "name"], value: "Alice" },
      { path: ["profile", "age"], value: 30 },
    ]);
  });

  test("computed values with custom equality", async () => {
    const value1 = reflex({ initialValue: 10 });
    const value2 = reflex({ initialValue: 20 });

    const computedUpdates: number[] = [];

    const sum = computed([value1, value2], ([a, b]) => a + b);

    sum.subscribe((value) => computedUpdates.push(value));

    // Test initial computed value
    expect(sum.value).toBe(30);
    expect(computedUpdates).toEqual([30]);

    // Test update to first dependency
    value1.setValue(15);
    expect(sum.value).toBe(35);
    expect(computedUpdates).toEqual([30, 35]);

    // Test update to second dependency
    value2.setValue(25);
    expect(sum.value).toBe(40);
    expect(computedUpdates).toEqual([30, 35, 40]);

    // Small changes should still trigger updates since we removed custom equality
    value1.setValue(15.0000001);
    expect(sum.value).toBe(40.0000001);
    expect(computedUpdates).toEqual([30, 35, 40, 40.0000001]);
  });

  test("operators and combining values", async () => {
    const numbers = reflex({ initialValue: 1 });
    const doubled = computed([numbers], ([n]) => n * 2);

    // For positiveOnly, we need to maintain the last valid value
    let lastValidValue = numbers.value;
    const positiveOnly = computed([numbers], ([n]) => {
      if (n > 0) {
        lastValidValue = n;
        return n;
      }
      return lastValidValue;
    });

    // Subscribe to initialize the computed values
    doubled.subscribe(() => {});
    positiveOnly.subscribe(() => {});

    const value1 = reflex({ initialValue: "A" });
    const value2 = reflex({ initialValue: "B" });
    const value3 = reflex({ initialValue: "C" });
    const combined = combine([value1, value2, value3]);

    // Test doubled computed
    expect(doubled.value).toBe(2);
    numbers.setValue(5);
    expect(doubled.value).toBe(10);

    // Test positiveOnly computed
    expect(positiveOnly.value).toBe(5);
    numbers.setValue(-3);
    expect(positiveOnly.value).toBe(5); // Keeps last valid value

    // Test combine operator
    expect(combined.value).toEqual(["A", "B", "C"]);
    value2.setValue("X");
    expect(combined.value).toEqual(["A", "X", "C"]);
  });

  test("batch updates", async () => {
    const value1 = reflex({
      initialValue: 0,
      notifyDuringBatch: true,
    });
    const value2 = reflex({
      initialValue: 0,
      notifyDuringBatch: true,
    });
    const updates1: number[] = [];
    const updates2: number[] = [];

    value1.subscribe((v) => updates1.push(v));
    value2.subscribe((v) => updates2.push(v));

    // Test individual updates
    value1.setValue(1);
    value2.setValue(2);
    expect(updates1).toEqual([0, 1]);
    expect(updates2).toEqual([0, 2]);

    // Clear update arrays
    updates1.length = 0;
    updates2.length = 0;

    // Test batch updates
    value1.batch(() => {
      value1.setValue(3);
    });

    value2.batch(() => {
      value2.setValue(4);
    });

    // Should only have one update each after batch
    expect(updates1).toEqual([3]);
    expect(updates2).toEqual([4]);
  });
});
