import { expect } from "chai";
import { reflex, computed } from "../src";
import { COMPUTED_ERRORS } from "../src/types";

describe("Async Computed", () => {
  describe("Core Functionality", () => {
    it("should handle basic async computation", async () => {
      const source = reflex({ initialValue: 1 });
      const doubled = computed([source], async ([value]) => {
        return value * 2;
      });

      return new Promise<void>((resolve) => {
        doubled.subscribe((value) => {
          if (value === 2) {
            resolve();
          }
        });
      });
    });

    it("should update async computed value when dependency changes", async () => {
      const source = reflex({ initialValue: 1 });
      const doubled = computed([source], async ([value]) => {
        return value * 2;
      });

      const values: number[] = [];
      return new Promise<void>((resolve) => {
        doubled.subscribe((value) => {
          if (typeof value === "number") {
            values.push(value);
            if (values.length === 2 && values[1] === 4) {
              resolve();
            }
          }
        });

        setTimeout(() => {
          source.setValue(2);
        }, 10);
      });
    });

    it("should handle async errors", async () => {
      const source = reflex({ initialValue: 0 });
      let errorLogged = false;

      const originalConsoleError = console.error;
      console.error = () => {
        errorLogged = true;
      };

      const errorProne = computed([source], async ([value]) => {
        if (value === 0) return value;
        throw new Error("Test error");
      });

      errorProne.subscribe(() => {});

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          source.setValue(1);
          setTimeout(() => {
            expect(errorLogged).to.be.true;
            console.error = originalConsoleError;
            resolve();
          }, 10);
        }, 10);
      });
    });

    it("should handle multiple async dependencies", async () => {
      const a = reflex({ initialValue: 1 });
      const b = reflex({ initialValue: 2 });

      const sum = computed([a, b], async ([x, y]) => x + y);

      const values: number[] = [];
      return new Promise<void>((resolve) => {
        sum.subscribe((value) => {
          if (typeof value === "number") {
            values.push(value);
            if (values.length === 2 && values[1] === 5) {
              resolve();
            }
          }
        });

        setTimeout(() => {
          a.setValue(3);
        }, 10);
      });
    });

    it("should cleanup async computations", async () => {
      const source = reflex({ initialValue: 1 });
      let computeCount = 0;

      const doubled = computed([source], async ([value]) => {
        computeCount++;
        return value * 2;
      });

      const unsub = doubled.subscribe(() => {});

      await new Promise<void>((resolve) => {
        setTimeout(() => {
          source.setValue(2);
          setTimeout(() => {
            unsub();
            source.setValue(3);
            setTimeout(() => {
              expect(computeCount).to.equal(2); // Initial + one update
              resolve();
            }, 10);
          }, 10);
        }, 10);
      });
    });
  });

  describe("Advanced Features", () => {
    it("should handle async compute functions with complex objects", async () => {
      const userId = reflex({ initialValue: 1 });
      const userProfile = computed([userId], async ([id]) => {
        return { id, name: `User${id}` };
      });

      const profiles: any[] = [];
      return new Promise<void>((resolve) => {
        userProfile.subscribe((profile) => {
          if (profile) {
            profiles.push(profile);
            if (profiles.length === 1) {
              expect(profiles[0]).to.deep.equal({ id: 1, name: "User1" });
              resolve();
            }
          }
        });
      });
    });

    it("should handle errors in async compute functions", async () => {
      let errorLogged = false;
      const originalConsoleError = console.error;
      console.error = () => {
        errorLogged = true;
      };

      const value = reflex({ initialValue: 0 });
      const errorProne = computed([value], async ([v]) => {
        if (v === 0) return v;
        throw new Error("Test error");
      });

      errorProne.subscribe(() => {});

      await new Promise<void>((resolve) => {
        setTimeout(async () => {
          await value.setValueAsync(1);
          setTimeout(() => {
            expect(errorLogged).to.be.true;
            console.error = originalConsoleError;
            resolve();
          }, 10);
        }, 10);
      });
    });

    it("should handle nested async computed values", async () => {
      const base = reflex({ initialValue: 1 });
      const doubled = computed([base], async ([v]) => {
        await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay to simulate async work
        return v * 2;
      });
      const quadrupled = computed([doubled], async ([v]) => {
        if (v === undefined) return undefined;
        await new Promise((resolve) => setTimeout(resolve, 10)); // Small delay to simulate async work
        return v * 2;
      });

      const values: number[] = [];
      return new Promise<void>((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("Test timed out")), 2000);

        const unsubscribe = quadrupled.subscribe((v) => {
          if (v !== undefined) {
            values.push(v);
            if (values.length === 1) {
              clearTimeout(timeout);
              try {
                expect(v).to.equal(4); // 1 * 2 * 2
                unsubscribe();
                resolve();
              } catch (error) {
                reject(error);
              }
            }
          }
        });
      });
    });

    it("should not allow sync batch on async computed", async () => {
      const base = reflex({ initialValue: 1 });
      const doubled = computed([base], async ([v]) => v * 2);

      return new Promise<void>((resolve, reject) => {
        doubled.subscribe((v) => {
          if (typeof v === "number" && v === 2) {
            try {
              doubled.batch((v) => v * 2);
              reject(new Error(COMPUTED_ERRORS.SYNC_BATCH));
            } catch (error) {
              expect(error.message).to.equal(COMPUTED_ERRORS.SYNC_BATCH);
              resolve();
            }
          }
        });
      });
    });

    it("should support async batch on async computed", async () => {
      const value = reflex({ initialValue: 1 });
      const asyncComputed = computed([value], async ([v]) => v * 2);

      return new Promise<void>((resolve) => {
        asyncComputed.subscribe(async (v) => {
          if (typeof v === "number" && v === 2) {
            const result = await asyncComputed.batchAsync(async (v) => v * 2);
            expect(result).to.equal(4); // (1 * 2) * 2
            resolve();
          }
        });
      });
    });

    it("should cleanup async computed values properly", async () => {
      const source = reflex({ initialValue: 0 });
      let computeCount = 0;

      const derived = computed([source], async ([value]) => {
        computeCount++;
        return value * 2;
      });

      const unsub = derived.subscribe(() => {});

      await new Promise<void>((resolve) => {
        setTimeout(async () => {
          await source.setValueAsync(1);
          setTimeout(() => {
            unsub();
            source.setValue(2);
            setTimeout(() => {
              expect(computeCount).to.equal(2); // Initial + one update
              resolve();
            }, 10);
          }, 10);
        }, 10);
      });
    });

    it("should handle multiple async dependencies with complex updates", async () => {
      const a = reflex({ initialValue: 1 });
      const b = reflex({ initialValue: 2 });
      const c = reflex({ initialValue: 3 });

      const sum = computed([a, b, c], async ([x, y, z]) => x + y + z);

      const values: number[] = [];
      return new Promise<void>((resolve) => {
        sum.subscribe((v) => {
          if (typeof v === "number") {
            values.push(v);
            if (values.length === 1) {
              expect(values[0]).to.equal(6); // 1 + 2 + 3
              resolve();
            }
          }
        });
      });
    });
  });
});
