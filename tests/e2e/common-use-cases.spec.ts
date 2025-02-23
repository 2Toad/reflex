import { test, expect } from "@playwright/test";
import { reflex, computed, deepReflex } from "@2toad/reflex";

test.describe("Common Use Cases", () => {
  test("basic value management", async () => {
    const username = reflex({ initialValue: "" });
    const uiValues: string[] = [];

    // Simulate UI updates
    username.subscribe((name) => uiValues.push(name));

    // Test initial value
    expect(username.value).toBe("");
    expect(uiValues).toEqual([""]);

    // Test value updates
    username.setValue("Alice");
    expect(username.value).toBe("Alice");
    expect(uiValues).toEqual(["", "Alice"]);

    username.setValue("Bob");
    expect(username.value).toBe("Bob");
    expect(uiValues).toEqual(["", "Alice", "Bob"]);
  });

  test("computed values", async () => {
    const price = reflex({ initialValue: 10 });
    const quantity = reflex({ initialValue: 2 });
    const total = computed([price, quantity], ([p, q]) => p * q);

    // Track computed value changes
    const totals: number[] = [];
    total.subscribe((value) => totals.push(value));

    // Test initial computed value
    expect(total.value).toBe(20);
    expect(totals).toEqual([20]);

    // Test computed updates when price changes
    price.setValue(15);
    expect(total.value).toBe(30);

    // Test computed updates when quantity changes
    quantity.setValue(3);
    expect(total.value).toBe(45);

    // Verify all computed values were tracked
    expect(totals).toEqual([20, 30, 45]);
  });

  test("complex objects with deep reactivity", async () => {
    const user = deepReflex({
      initialValue: {
        name: "John",
        preferences: { theme: "dark" },
      },
    });

    const updates: Array<{ name: string; preferences: { theme: string } }> = [];
    user.subscribe((value) => updates.push(JSON.parse(JSON.stringify(value)))); // Deep clone to capture state at each update

    // Test initial state
    expect(user.value).toEqual({
      name: "John",
      preferences: { theme: "dark" },
    });

    // Test top-level property update
    user.batch((value) => {
      value.name = "Jane";
    });
    expect(user.value.name).toBe("Jane");
    expect(user.value.preferences.theme).toBe("dark");

    // Test nested property update
    user.batch((value) => {
      value.preferences.theme = "light";
    });
    expect(user.value.preferences.theme).toBe("light");
    expect(user.value.name).toBe("Jane");

    // Verify all updates were tracked
    expect(updates).toEqual([
      { name: "John", preferences: { theme: "dark" } },
      { name: "Jane", preferences: { theme: "dark" } },
      { name: "Jane", preferences: { theme: "light" } },
    ]);
  });
});
