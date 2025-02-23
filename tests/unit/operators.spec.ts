import { expect } from "chai";
import { reflex } from "../../src";
import { map, filter, merge, combine, scan, debounce, switchMap, mergeMap, concatMap, catchError } from "../../src/operators";

describe("Operators", () => {
  describe("map", () => {
    it("should transform values using the provided function", () => {
      const source = reflex({ initialValue: 1 });
      const doubled = map(source, (x) => x * 2);
      expect(doubled.value).to.equal(2);

      source.setValue(2);
      expect(doubled.value).to.equal(4);
    });

    it("should handle type transformations", () => {
      const source = reflex({ initialValue: 1 });
      const toString = map(source, (x) => x.toString());
      expect(toString.value).to.equal("1");

      source.setValue(2);
      expect(toString.value).to.equal("2");
    });
  });

  describe("filter", () => {
    it("should only emit values that pass the predicate", () => {
      const source = reflex({ initialValue: 1 });
      const evens = filter(source, (x) => x % 2 === 0);
      expect(evens.value).to.equal(undefined);

      source.setValue(2);
      expect(evens.value).to.equal(2);

      source.setValue(3);
      expect(evens.value).to.equal(2); // Still the last passing value
    });
  });

  describe("merge", () => {
    it("should emit values from all sources", () => {
      const source1 = reflex({ initialValue: 1 });
      const source2 = reflex({ initialValue: 2 });
      const merged = merge([source1, source2]);
      expect(merged.value).to.equal(1);

      source2.setValue(3);
      expect(merged.value).to.equal(3);

      source1.setValue(4);
      expect(merged.value).to.equal(4);
    });

    it("should throw error when no sources provided", () => {
      expect(() => merge([])).to.throw("merge requires at least one source");
    });
  });

  describe("combine", () => {
    it("should combine latest values from all sources", () => {
      const source1 = reflex({ initialValue: 1 });
      const source2 = reflex({ initialValue: "a" });
      const combined = combine<[number, string]>([source1, source2]);
      expect(combined.value).to.deep.equal([1, "a"]);

      source1.setValue(2);
      expect(combined.value).to.deep.equal([2, "a"]);

      source2.setValue("b");
      expect(combined.value).to.deep.equal([2, "b"]);
    });

    it("should throw error when no sources provided", () => {
      expect(() => combine<never[]>([])).to.throw("combine requires at least one source");
    });
  });

  describe("scan", () => {
    it("should accumulate values using the reducer", () => {
      const source = reflex({ initialValue: 1 });
      const sum = scan(source, (acc, value) => acc + value, 0);
      expect(sum.value).to.equal(1); // Initial value gets reduced

      source.setValue(2);
      expect(sum.value).to.equal(3);

      source.setValue(3);
      expect(sum.value).to.equal(6);
    });

    it("should work with different accumulator types", () => {
      const source = reflex({ initialValue: "a" });
      const concat = scan(source, (acc, value) => acc + value, "");
      expect(concat.value).to.equal("a");

      source.setValue("b");
      expect(concat.value).to.equal("ab");
    });
  });

  describe("debounce", () => {
    it("should debounce emissions by the specified delay", (done) => {
      const source = reflex({ initialValue: 0 });
      const debounced = debounce(source, 15);
      const values: number[] = [];

      const unsubscribe = debounced.subscribe((value) => values.push(value));

      source.setValue(1);
      source.setValue(2);
      source.setValue(3);

      setTimeout(() => {
        expect(values).to.deep.equal([0, 3]);
        unsubscribe();
        done();
      }, 25);
    });

    it("should cancel previous timeout on new value", (done) => {
      const source = reflex({ initialValue: 0 });
      const debounced = debounce(source, 15);

      const values: number[] = [];
      const unsubscribe = debounced.subscribe((value) => values.push(value));

      source.setValue(1);

      setTimeout(() => {
        source.setValue(2);
      }, 8);

      setTimeout(() => {
        expect(values).to.deep.equal([0, 2]);
        unsubscribe();
        done();
      }, 25);
    });
  });

  describe("catchError", () => {
    it("should recover from errors with a fallback value", () => {
      const source = reflex({ initialValue: 1 });
      const errorProne = map(source, (x) => {
        if (x === 2) throw new Error("Test error");
        return x * 2;
      });
      const recovered = catchError(errorProne, () => 0);

      expect(recovered.value).to.equal(2);

      source.setValue(2);
      expect(recovered.value).to.equal(0); // Fallback value after error

      source.setValue(3);
      expect(recovered.value).to.equal(6); // Resumes normal operation
    });

    it("should handle errors with a reflex fallback", () => {
      const source = reflex({ initialValue: 1 });
      const errorProne = map(source, (x) => {
        if (x === 2) throw new Error("Test error");
        return x * 2;
      });
      const fallbackReflex = reflex({ initialValue: 100 });
      const recovered = catchError(errorProne, () => fallbackReflex);

      expect(recovered.value).to.equal(2);

      source.setValue(2);
      expect(recovered.value).to.equal(100); // Fallback reflex value after error

      fallbackReflex.setValue(200);
      expect(recovered.value).to.equal(200); // Updates with fallback reflex
    });
  });
});

describe("Higher-order Stream Operators", () => {
  describe("switchMap", () => {
    it("should switch to new inner stream, cancelling previous", (done) => {
      const source = reflex({ initialValue: 1 });
      const result = switchMap(source, (value) => {
        const inner = reflex({ initialValue: value * 10 });
        setTimeout(() => {
          inner.setValue(value * 20);
        }, 10);
        return inner;
      });

      const values: number[] = [];
      const unsubscribe = result.subscribe((value) => values.push(value));

      setTimeout(() => {
        source.setValue(2);
      }, 5);

      setTimeout(() => {
        expect(values).to.deep.equal([10, 20, 40]);
        unsubscribe();
        done();
      }, 30);
    });

    it("should handle reflex sources", () => {
      const source = reflex({ initialValue: "a" });
      const innerSource = reflex({ initialValue: 1 });
      const results: number[] = [];

      const mapped = switchMap(source, () => innerSource);
      mapped.subscribe((value) => {
        if (value !== undefined) {
          results.push(value);
        }
      });

      expect(results).to.deep.equal([1]); // Initial value

      innerSource.setValue(2);
      expect(results).to.deep.equal([1, 2]);

      source.setValue("b"); // Should restart subscription but value hasn't changed
      expect(results).to.deep.equal([1, 2]);

      innerSource.setValue(3);
      expect(results).to.deep.equal([1, 2, 3]);
    });
  });

  describe("mergeMap", () => {
    it("should merge all inner streams", (done) => {
      const source = reflex({ initialValue: 1 });
      const result = mergeMap(source, (value) => {
        const inner = reflex({ initialValue: value * 10 });
        setTimeout(() => {
          inner.setValue(value * 20);
        }, 10);
        return inner;
      });

      const values: number[] = [];
      const unsubscribe = result.subscribe((value) => values.push(value));

      setTimeout(() => {
        source.setValue(2);
      }, 5);

      setTimeout(() => {
        expect(values).to.include(10).and.include(20).and.include(20).and.include(40);
        unsubscribe();
        done();
      }, 30);
    });

    it("should handle reflex sources", () => {
      const source = reflex({ initialValue: "a" });
      const innerSourceA = reflex({ initialValue: 1 });
      const innerSourceB = reflex({ initialValue: 10 });
      const results: number[] = [];

      const mapped = mergeMap(source, (value) => (value === "a" ? innerSourceA : innerSourceB));
      mapped.subscribe((value) => {
        if (value !== undefined) {
          results.push(value);
        }
      });

      expect(results).to.deep.equal([1]); // Initial value

      innerSourceA.setValue(2);
      expect(results).to.deep.equal([1, 2]);

      source.setValue("b");
      expect(results).to.deep.equal([1, 2, 10]);

      innerSourceB.setValue(20);
      expect(results).to.deep.equal([1, 2, 10, 20]);
    });
  });

  describe("concatMap", () => {
    it("should process inner streams in sequence", (done) => {
      const source = reflex({ initialValue: 1 });
      const values: number[] = [];

      const result = concatMap(source, async (value) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return value * 10;
      });

      const unsubscribe = result.subscribe((value) => {
        if (value !== undefined) {
          values.push(value);
        }
      });

      // First value should be processed
      setTimeout(() => {
        source.setValue(2);

        // Check final values after both sequences complete
        setTimeout(() => {
          expect(values).to.deep.equal([10, 20]);
          unsubscribe();
          done();
        }, 15);
      }, 10);
    });

    it("should handle reflex sources in sequence", (done) => {
      const source = reflex({ initialValue: "a" });
      const innerSourceA = reflex({ initialValue: 1 });
      const innerSourceB = reflex({ initialValue: 10 });
      const results: number[] = [];

      const mapped = concatMap(source, (value) => (value === "a" ? innerSourceA : innerSourceB));
      const unsubscribe = mapped.subscribe((value) => {
        if (value !== undefined) {
          results.push(value);
        }
      });

      expect(results).to.deep.equal([1]); // Initial value

      innerSourceA.setValue(2);
      source.setValue("b");

      // Give time for the sequence to process
      setTimeout(() => {
        expect(results).to.deep.equal([1, 2, 10]);
        unsubscribe();
        done();
      }, 25);
    });
  });
});
