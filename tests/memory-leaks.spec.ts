import { expect } from "chai";
import { reflex, computed, deepReflex } from "../src";

describe("Memory Leaks", () => {
  it("should cleanup subscriptions when unsubscribed", () => {
    const source = reflex({ initialValue: 0 });
    let callCount = 0;

    // Create multiple subscriptions
    const unsub1 = source.subscribe(() => callCount++);
    const unsub2 = source.subscribe(() => callCount++);

    // Initial subscription calls
    expect(callCount).to.equal(2); // One call per initial subscription

    source.setValue(1); // Should trigger both subscriptions
    expect(callCount).to.equal(4); // Two more calls

    unsub1();
    source.setValue(2); // Should trigger only one subscription
    expect(callCount).to.equal(5); // One more call

    unsub2();
    source.setValue(3); // Should trigger no subscriptions
    expect(callCount).to.equal(5); // No change
  });

  it("should cleanup computed values and their dependencies when all subscribers are removed", () => {
    const source = reflex({ initialValue: 0 });
    let computeCount = 0;

    const derived = computed([source], ([value]) => {
      computeCount++;
      return value * 2;
    });

    // Create and immediately remove subscriptions
    const unsub1 = derived.subscribe(() => {});
    const unsub2 = derived.subscribe(() => {});

    expect(computeCount).to.equal(1); // Initial computation

    source.setValue(1);
    expect(computeCount).to.equal(2); // One update

    unsub1();
    source.setValue(2);
    expect(computeCount).to.equal(3); // Still one subscriber

    unsub2();
    source.setValue(3);
    expect(computeCount).to.equal(3); // No more computations
  });

  it("should cleanup nested computed values", () => {
    const source = reflex({ initialValue: 0 });
    let compute1Count = 0;
    let compute2Count = 0;

    const derived1 = computed([source], ([value]) => {
      compute1Count++;
      return value * 2;
    });

    const derived2 = computed([derived1], ([value]) => {
      compute2Count++;
      return value * 2;
    });

    const unsub = derived2.subscribe(() => {});
    expect(compute1Count).to.equal(1); // Initial computation
    expect(compute2Count).to.equal(1); // Initial computation

    source.setValue(1);
    expect(compute1Count).to.equal(2); // One update
    expect(compute2Count).to.equal(2); // One update

    unsub();
    source.setValue(2);
    expect(compute1Count).to.equal(2); // No more computations
    expect(compute2Count).to.equal(2); // No more computations
  });

  it("should cleanup deep reactive objects", () => {
    interface DeepObject {
      a: { b: { c: number } };
      x: { y: number };
    }

    const source = deepReflex<DeepObject>({
      initialValue: {
        a: { b: { c: 1 } },
        x: { y: 2 },
      },
    });

    let callCount = 0;
    const unsub = source.subscribe(() => callCount++);

    expect(callCount).to.equal(1); // Initial subscription

    source.value.a.b.c = 2;
    source.value.x.y = 3;
    expect(callCount).to.equal(3); // Two updates

    unsub();
    source.value.a.b.c = 4;
    source.value.x.y = 5;
    expect(callCount).to.equal(3); // No more updates
  });

  it("should handle circular dependencies without memory leaks", () => {
    const a = reflex({ initialValue: 1 });
    const b = reflex({ initialValue: 2 });

    let computeACount = 0;
    let computeBCount = 0;

    // Create circular dependency
    const derivedA = computed([b], ([value]) => {
      computeACount++;
      return value * 2;
    });

    const derivedB = computed([a], ([value]) => {
      computeBCount++;
      return value * 2;
    });

    const unsubA = derivedA.subscribe(() => {});
    const unsubB = derivedB.subscribe(() => {});

    expect(computeACount).to.equal(1); // Initial computation
    expect(computeBCount).to.equal(1); // Initial computation

    a.setValue(3);
    b.setValue(4);
    expect(computeACount).to.equal(2); // One update
    expect(computeBCount).to.equal(2); // One update

    unsubA();
    unsubB();

    a.setValue(5);
    b.setValue(6);
    expect(computeACount).to.equal(2); // No more computations
    expect(computeBCount).to.equal(2); // No more computations
  });

  it("should cleanup multiple interdependent computed values", () => {
    const source = reflex({ initialValue: 0 });
    const computeCounts = { a: 0, b: 0, c: 0 };

    const derivedA = computed([source], ([v]) => {
      computeCounts.a++;
      return v * 2;
    });

    const derivedB = computed([derivedA], ([v]) => {
      computeCounts.b++;
      return v + 1;
    });

    const derivedC = computed([derivedA, derivedB], ([a, b]) => {
      computeCounts.c++;
      return a + b;
    });

    // Initial computations when subscribing
    const unsub = derivedC.subscribe(() => {});
    expect(computeCounts).to.deep.equal({ a: 1, b: 1, c: 1 });

    // Update source - should trigger all computations once
    source.setValue(1);
    expect(computeCounts).to.deep.equal({ a: 2, b: 2, c: 3 }); // c gets computed one extra time due to both dependencies updating

    // After unsubscribe, no more computations should occur
    unsub();
    source.setValue(2);
    expect(computeCounts).to.deep.equal({ a: 2, b: 2, c: 3 });
  });
});
