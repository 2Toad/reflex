import { expect } from "chai";
import { reflex } from "../../src";

describe("Middleware", () => {
  it("should apply middleware to value updates", () => {
    const counter = reflex({
      initialValue: 0,
      middleware: [
        (value) => Math.max(0, value), // Keep value non-negative
      ],
    });

    counter.setValue(-5);
    expect(counter.value).to.equal(0);

    counter.setValue(10);
    expect(counter.value).to.equal(10);
  });

  it("should apply multiple middleware in order", () => {
    const counter = reflex({
      initialValue: 0,
      middleware: [(value) => value * 2, (value) => value + 1],
    });

    counter.setValue(5);
    expect(counter.value).to.equal(11); // (5 * 2) + 1
  });

  it("should handle middleware errors gracefully", () => {
    let errorLogged = false;
    const originalConsoleError = console.error;
    console.error = () => {
      errorLogged = true;
    };

    const counter = reflex({
      initialValue: 0,
      middleware: [
        () => {
          throw new Error("Test error");
        },
      ],
    });

    expect(() => counter.setValue(5)).to.throw("Test error");
    expect(errorLogged).to.be.true;

    console.error = originalConsoleError;
  });

  it("should support adding and removing middleware dynamically", () => {
    const counter = reflex({ initialValue: 0 });
    const double = (value: number) => value * 2;

    counter.addMiddleware(double);
    counter.setValue(5);
    expect(counter.value).to.equal(10);

    counter.removeMiddleware(double);
    counter.setValue(5);
    expect(counter.value).to.equal(5);
  });

  it("should handle async middleware in setValueAsync", async () => {
    let errorLogged = false;
    const originalConsoleError = console.error;
    console.error = () => {
      errorLogged = true;
    };

    const validate = async (value: number) => {
      if (value < 0) throw new Error("Value must be non-negative");
      return value;
    };

    const counter = reflex({
      initialValue: 0,
      middleware: [validate],
    });

    try {
      await counter.setValueAsync(5);
      expect(counter.value).to.equal(5);

      await counter.setValueAsync(-1);
      expect.fail("Should have thrown error");
    } catch (error) {
      expect(error.message).to.equal("Value must be non-negative");
      expect(errorLogged).to.be.true;
    } finally {
      console.error = originalConsoleError;
    }
  });

  it("should skip async middleware in sync setValue", () => {
    let warningLogged = false;
    const originalConsoleWarn = console.warn;
    console.warn = () => {
      warningLogged = true;
    };

    const counter = reflex({
      initialValue: 0,
      middleware: [
        async (value) => value * 2, // This should be skipped in sync operation
      ],
    });

    counter.setValue(5);
    expect(counter.value).to.equal(5); // Async middleware skipped
    expect(warningLogged).to.be.true;

    console.warn = originalConsoleWarn;
  });

  it("should support middleware in batch operations", () => {
    const counter = reflex({
      initialValue: 0,
      middleware: [(value) => Math.max(0, value)],
    });

    counter.batch((value) => {
      counter.setValue(-5);
      counter.setValue(10);
      counter.setValue(-3);
    });

    expect(counter.value).to.equal(0); // Last value (-3) was transformed to 0
  });

  it("should support async middleware in batch async operations", async () => {
    const counter = reflex({
      initialValue: 0,
      middleware: [async (value) => value * 2],
    });

    await counter.batchAsync(async (value) => {
      await counter.setValueAsync(5);
      await counter.setValueAsync(10);
    });

    expect(counter.value).to.equal(20); // Last value (10) was doubled
  });
});
