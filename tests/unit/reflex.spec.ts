import { expect } from "chai";
import { reflex } from "../../src";

describe("Reflex", () => {
  it("should create a reactive value with initial value", () => {
    const value = reflex({ initialValue: 42 });
    expect(value.value).to.equal(42);
  });

  it("should notify subscribers when value changes", () => {
    const value = reflex({ initialValue: 0 });
    const values: number[] = [];

    value.subscribe((v) => values.push(v));
    value.setValue(1);
    value.setValue(2);

    expect(values).to.deep.equal([0, 1, 2]); // Including initial value
  });

  it("should not notify subscribers when value doesn't change", () => {
    const value = reflex({ initialValue: 0 });
    let callCount = 0;

    value.subscribe(() => callCount++);
    value.setValue(0); // Same value

    expect(callCount).to.equal(1); // Only initial call
  });

  it("should support custom equality function", () => {
    const value = reflex({
      initialValue: { id: 1, data: "test" },
      equals: (a, b) => a.id === b.id, // Compare only by id
    });

    const updates: any[] = [];
    value.subscribe((v) => updates.push(v));

    // Should not trigger (same id)
    value.setValue({ id: 1, data: "different" });

    // Should trigger (different id)
    value.setValue({ id: 2, data: "test" });

    expect(updates.length).to.equal(2); // Initial + one change
    expect(updates[1].id).to.equal(2);
  });

  it("should allow unsubscribing", () => {
    const value = reflex({ initialValue: 0 });
    let callCount = 0;

    const unsubscribe = value.subscribe(() => callCount++);
    value.setValue(1);
    unsubscribe();
    value.setValue(2);

    expect(callCount).to.equal(2); // Initial + one change before unsubscribe
  });

  it("should handle multiple subscribers", () => {
    const value = reflex({ initialValue: 0 });
    const results1: number[] = [];
    const results2: number[] = [];

    value.subscribe((v) => results1.push(v));
    value.subscribe((v) => results2.push(v));
    value.setValue(1);

    expect(results1).to.deep.equal([0, 1]);
    expect(results2).to.deep.equal([0, 1]);
  });

  it("should handle errors in subscribers gracefully", () => {
    const value = reflex({ initialValue: 0 });
    let secondSubscriberCalled = false;
    let errorLogged = false;

    // Override console.error temporarily
    const originalConsoleError = console.error;
    console.error = () => {
      errorLogged = true;
    };

    value.subscribe(() => {
      throw new Error("Test error");
    });
    value.subscribe(() => {
      secondSubscriberCalled = true;
    });

    // Should not throw and should call second subscriber
    value.setValue(1);

    // Restore console.error
    console.error = originalConsoleError;
    expect(errorLogged).to.be.true;
    expect(secondSubscriberCalled).to.be.true;
  });

  it("should maintain correct subscription list after unsubscribe", () => {
    const value = reflex({ initialValue: 0 });
    const results: number[] = [];

    const unsub1 = value.subscribe(() => results.push(1));
    const unsub2 = value.subscribe(() => results.push(2));

    // Initial values
    expect(results).to.deep.equal([1, 2]);

    value.setValue(1); // Both called
    expect(results).to.deep.equal([1, 2, 1, 2]);

    unsub1();
    value.setValue(2); // Only second subscriber called
    expect(results).to.deep.equal([1, 2, 1, 2, 2]);
  });
});
