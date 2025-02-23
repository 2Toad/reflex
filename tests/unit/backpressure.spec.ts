import { expect } from "chai";
import { reflex } from "../../src";
import { withBackpressure, buffer, sample, throttle } from "../../src/backpressure";
import { BackpressureStrategy } from "../../src/types";

describe("Backpressure Operators", () => {
  let cleanup: Array<() => void>;

  beforeEach(() => {
    cleanup = [];
  });

  afterEach(() => {
    cleanup.forEach((fn) => fn());
  });

  describe("withBackpressure", () => {
    it("should handle drop strategy", () => {
      const source = reflex({ initialValue: 0 });
      const controlled = withBackpressure(source, {
        strategy: BackpressureStrategy.Drop,
        bufferSize: 2,
      });

      const values: number[] = [];
      cleanup.push(controlled.subscribe((value) => values.push(value)));

      // Pause and emit values
      controlled.pause();
      source.setValue(1);
      source.setValue(2);
      source.setValue(3);

      expect(values).to.deep.equal([0]); // Only initial value

      // Resume and emit more values
      controlled.resume();
      source.setValue(4);
      expect(values).to.deep.equal([0, 4]); // Dropped values while paused
    });

    it("should handle buffer strategy", () => {
      const source = reflex({ initialValue: 0 });
      const controlled = withBackpressure(source, {
        strategy: BackpressureStrategy.Buffer,
        bufferSize: 2,
      });

      const values: number[] = [];
      cleanup.push(controlled.subscribe((value) => values.push(value)));

      // Pause and emit values
      controlled.pause();
      source.setValue(1);
      source.setValue(2);
      source.setValue(3); // Should be dropped as buffer is full

      expect(values).to.deep.equal([0]); // Only initial value
      expect(controlled.getBufferSize()).to.equal(2); // Buffer is full

      // Resume and process buffer
      controlled.resume();
      expect(values).to.deep.equal([0, 1, 2]); // Processed buffered values
      expect(controlled.getBufferSize()).to.equal(0); // Buffer is empty
    });

    it("should handle sliding strategy", () => {
      const source = reflex({ initialValue: 0 });
      const controlled = withBackpressure(source, {
        strategy: BackpressureStrategy.Sliding,
        bufferSize: 2,
      });

      const values: number[] = [];
      cleanup.push(controlled.subscribe((value) => values.push(value)));

      // Pause and emit values
      controlled.pause();
      source.setValue(1);
      source.setValue(2);
      source.setValue(3); // Should slide out 1

      expect(values).to.deep.equal([0]); // Only initial value
      expect(controlled.getBufferSize()).to.equal(2); // Buffer maintains size

      // Resume and process buffer
      controlled.resume();
      expect(values).to.deep.equal([0, 2, 3]); // Processed latest buffered values
    });

    it("should handle error strategy", () => {
      const source = reflex({ initialValue: 0 });
      const controlled = withBackpressure(source, {
        strategy: BackpressureStrategy.Error,
        bufferSize: 2,
      });

      cleanup.push(controlled.subscribe(() => {}));

      // Fill the buffer
      source.setValue(1);
      source.setValue(2);

      try {
        source.setValue(3);
        throw new Error("Expected error was not thrown");
      } catch (e) {
        if (e.message !== "Backpressure limit exceeded") {
          throw e;
        }
      }
    });
  });

  describe("buffer", () => {
    it("should buffer values for specified duration", (done) => {
      const source = reflex({ initialValue: 0 });
      const buffered = buffer(source, 20);

      const values: number[][] = [];
      cleanup.push(
        buffered.subscribe((value) => {
          if (value.length > 0) {
            // Only track non-empty buffers
            values.push(value);
          }
        }),
      );

      source.setValue(1);
      source.setValue(2);
      source.setValue(3);

      const timeoutId = setTimeout(() => {
        expect(values).to.deep.equal([[1, 2, 3]]);
        done();
      }, 30);

      cleanup.push(() => clearTimeout(timeoutId));
    });
  });

  describe("sample", () => {
    it("should sample values at specified interval", (done) => {
      const source = reflex({ initialValue: 0 });
      const sampled = sample(source, 20);

      const values: number[] = [];
      cleanup.push(sampled.subscribe((value) => values.push(value)));

      source.setValue(1);
      source.setValue(2);
      source.setValue(3);

      const timeoutId = setTimeout(() => {
        expect(values.length).to.be.greaterThan(0);
        expect(values[values.length - 1]).to.equal(3);
        done();
      }, 30);

      cleanup.push(() => clearTimeout(timeoutId));
    });
  });

  describe("throttle", () => {
    it("should throttle values to specified duration", (done) => {
      const source = reflex({ initialValue: 0 });
      const throttled = throttle(source, 8);

      const values: number[] = [];
      cleanup.push(throttled.subscribe((value) => values.push(value)));

      // First value should go through immediately
      source.setValue(1);

      // These should be throttled
      const timeoutId1 = setTimeout(() => {
        source.setValue(2);
        source.setValue(3);
      }, 4);

      // Check final values after throttle period
      const timeoutId2 = setTimeout(() => {
        expect(values).to.deep.equal([0, 1, 3]);
        done();
      }, 30);

      cleanup.push(() => {
        clearTimeout(timeoutId1);
        clearTimeout(timeoutId2);
      });
    });
  });
});
