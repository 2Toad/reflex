import { expect } from "chai";
import { reflex, computed } from "../../src";
import { COMPUTED_ERRORS } from "../../src/types";

describe("Computed", () => {
  it("should compute initial value from dependencies", (done) => {
    const a = reflex({ initialValue: 2 });
    const b = reflex({ initialValue: 3 });

    const sum = computed([a, b], ([x, y]) => x + y);
    sum.subscribe((value) => {
      if (value === 5) {
        done();
      }
    });
  });

  it("should update when dependencies change", (done) => {
    const width = reflex({ initialValue: 5 });
    const height = reflex({ initialValue: 10 });

    const area = computed([width, height], ([w, h]) => w * h);
    const values: number[] = [];

    area.subscribe((v) => {
      values.push(v);
      if (values.length === 3) {
        expect(values).to.deep.equal([50, 60, 72]); // Initial + two updates
        done();
      }
    });

    setTimeout(() => {
      width.setValue(6);
      height.setValue(12);
    }, 10);
  });

  it("should not allow setting computed values directly", () => {
    const value = reflex({ initialValue: 1 });
    const doubled = computed([value], ([v]) => v * 2);

    expect(() => {
      doubled.setValue(42);
    }).to.throw(COMPUTED_ERRORS.SET_VALUE);
  });

  it("should cleanup dependencies when last subscriber unsubscribes", (done) => {
    const source = reflex({ initialValue: 0 });
    let computeCount = 0;

    const derived = computed([source], ([value]) => {
      computeCount++;
      return value * 2;
    });

    const unsub1 = derived.subscribe(() => {});
    const unsub2 = derived.subscribe(() => {});

    setTimeout(() => {
      source.setValue(1); // Should trigger compute
      unsub1();
      source.setValue(2); // Should still trigger compute
      unsub2();
      source.setValue(3); // Should not trigger compute (no subscribers)

      expect(computeCount).to.equal(3); // Initial + two updates before unsubscribe
      done();
    }, 10);
  });

  it("should handle multiple dependencies", (done) => {
    const a = reflex({ initialValue: 1 });
    const b = reflex({ initialValue: 2 });
    const c = reflex({ initialValue: 3 });

    const sum = computed([a, b, c], ([x, y, z]) => x + y + z);
    const values: number[] = [];

    sum.subscribe((v) => {
      values.push(v);
      if (values.length === 4) {
        expect(values).to.deep.equal([6, 7, 9, 12]);
        done();
      }
    });

    setTimeout(() => {
      a.setValue(2);
      b.setValue(4);
      c.setValue(6);
    }, 10);
  });

  it("should handle nested computed values", (done) => {
    const base = reflex({ initialValue: 1 });
    const doubled = computed([base], ([v]) => v * 2);
    const quadrupled = computed([doubled], ([v]) => v * 2);

    const values: number[] = [];
    quadrupled.subscribe((v) => {
      values.push(v);
      if (values.length === 3) {
        expect(values).to.deep.equal([4, 8, 12]); // Initial + two updates
        done();
      }
    });

    setTimeout(() => {
      base.setValue(2);
      base.setValue(3);
    }, 10);
  });

  it("should handle errors in compute function gracefully", (done) => {
    const value = reflex({ initialValue: 0 });
    let errorLogged = false;

    // Override console.error temporarily
    const originalConsoleError = console.error;
    console.error = () => {
      errorLogged = true;
    };

    const errorProne = computed([value], ([v]) => {
      if (v === 0) return v;
      throw new Error("Test error");
    });

    errorProne.subscribe(() => {});

    setTimeout(() => {
      value.setValue(1);
      expect(errorLogged).to.be.true;
      console.error = originalConsoleError;
      done();
    }, 10);
  });

  it("should not recompute if dependencies change but unsubscribed", (done) => {
    const source = reflex({ initialValue: 0 });
    let computeCount = 0;

    const derived = computed([source], ([v]) => {
      computeCount++;
      return v * 2;
    });

    const unsubscribe = derived.subscribe(() => {});

    setTimeout(() => {
      unsubscribe();
      source.setValue(1);
      source.setValue(2);
      expect(computeCount).to.equal(1); // Only initial computation
      done();
    }, 10);
  });
});
