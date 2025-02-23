import { expect } from "chai";
import { reflex } from "../src";
import { map, filter, merge, combine, scan, debounce } from "../src/operators";

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
      const source = reflex({ initialValue: 1 });
      const debounced = debounce(source, 50);
      expect(debounced.value).to.equal(1);

      source.setValue(2);
      expect(debounced.value).to.equal(1); // Not updated yet

      source.setValue(3);
      expect(debounced.value).to.equal(1); // Still not updated

      setTimeout(() => {
        expect(debounced.value).to.equal(3); // Now updated to last value
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
});
