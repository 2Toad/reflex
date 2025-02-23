import { expect } from "chai";
import { reflex } from "../src";
import { map, filter, merge, combine, scan, debounce, switchMap, mergeMap, concatMap, catchError } from "../src/operators";

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
      const debounced = debounce(source, 50);
      const values: number[] = [];

      debounced.subscribe((value) => values.push(value));

      source.setValue(1);

      setTimeout(() => {
        source.setValue(2);
        source.setValue(3);
      }, 20);

      setTimeout(() => {
        expect(values).to.deep.equal([0, 3]);
        done();
      }, 100);
    });

    it("should cancel previous timeout on new value", (done) => {
      const source = reflex({ initialValue: 1 });
      const debounced = debounce(source, 50);

      source.setValue(2);

      setTimeout(() => {
        source.setValue(3); // Reset the timeout
      }, 25);

      setTimeout(() => {
        expect(debounced.value).to.equal(1); // Should not have updated to 2
      }, 60);

      setTimeout(() => {
        expect(debounced.value).to.equal(3); // Should have updated to 3
        done();
      }, 100);
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
      const delays: { [key: number]: number } = { 1: 100, 2: 50 };
      const results: number[] = [];

      const mapped = switchMap(
        source,
        (value) =>
          new Promise<number>((resolve) => {
            setTimeout(() => resolve(value * 10), delays[value]);
          }),
      );

      mapped.subscribe((value) => {
        if (value !== undefined) {
          results.push(value);
        }
      });

      // First value will take 100ms
      source.setValue(2); // This value will take 50ms and should arrive first

      setTimeout(() => {
        expect(results).to.deep.equal([20]); // Only the second result should arrive
        done();
      }, 150);
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
      const delays: { [key: number]: number } = { 1: 100, 2: 50 };
      const results: number[] = [];

      const mapped = mergeMap(
        source,
        (value) =>
          new Promise<number>((resolve) => {
            setTimeout(() => resolve(value * 10), delays[value]);
          }),
      );

      mapped.subscribe((value) => {
        if (value !== undefined) {
          results.push(value);
        }
      });

      // First value will take 100ms
      source.setValue(2); // This value will take 50ms

      setTimeout(() => {
        expect(results).to.deep.equal([20, 10]); // Both results should arrive
        done();
      }, 150);
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
      const delays: { [key: number]: number } = { 1: 50, 2: 25 };
      const results: number[] = [];

      const mapped = concatMap(
        source,
        (value) =>
          new Promise<number>((resolve) => {
            setTimeout(() => resolve(value * 10), delays[value]);
          }),
      );

      mapped.subscribe((value) => {
        if (value !== undefined) {
          results.push(value);
        }
      });

      // First value will take 50ms
      source.setValue(2); // This value will take 25ms but should wait for first

      setTimeout(() => {
        expect(results).to.deep.equal([10, 20]); // Results should arrive in order
        done();
      }, 150); // Increased timeout to ensure both operations complete
    });

    it("should handle reflex sources in sequence", (done) => {
      const source = reflex({ initialValue: "a" });
      const innerSourceA = reflex({ initialValue: 1 });
      const innerSourceB = reflex({ initialValue: 10 });
      const results: number[] = [];

      const mapped = concatMap(source, (value) => (value === "a" ? innerSourceA : innerSourceB));
      mapped.subscribe((value) => {
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
        done();
      }, 50);
    });
  });
});
