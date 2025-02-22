import { Reflex, Unsubscribe } from "./types";
import { reflex } from "./reflex";

/**
 * Helper type to extract values from reactive dependencies
 */
type DependencyValues<T extends Reflex<unknown>[]> = {
  [K in keyof T]: T[K] extends Reflex<infer V> ? V : never;
};

/**
 * Creates a computed reactive value that depends on other reactive values.
 * The computed value automatically updates when any of its dependencies change.
 *
 * @example
 * ```typescript
 * const width = reflex({ initialValue: 5 });
 * const height = reflex({ initialValue: 10 });
 *
 * const area = computed(
 *   [width, height],
 *   ([w, h]) => w * h
 * );
 *
 * area.subscribe(value => console.log('Area changed:', value));
 * width.setValue(6); // Logs: Area changed: 60
 * ```
 */
export function computed<TDeps extends Reflex<unknown>[], TResult>(
  dependencies: [...TDeps],
  compute: (values: DependencyValues<TDeps>) => TResult,
): Reflex<TResult> {
  let currentComputed: TResult;
  try {
    const depValues = dependencies.map((dep) => dep.value) as DependencyValues<TDeps>;
    currentComputed = compute(depValues);
  } catch (error) {
    console.error("Error in compute function:", error);
    currentComputed = undefined as TResult;
  }

  // Create reactive for computed value
  const result = reflex<TResult>({
    initialValue: currentComputed,
  });

  let cleanups: Unsubscribe[] = [];
  let subscriptionCount = 0;
  let isComputing = false;

  const recompute = () => {
    if (isComputing) return; // Prevent recursive computations
    isComputing = true;

    try {
      const depValues = dependencies.map((dep) => dep.value) as DependencyValues<TDeps>;
      const newValue = compute(depValues);
      result.setValue(newValue);
    } catch (error) {
      console.error("Error in compute function:", error);
    } finally {
      isComputing = false;
    }
  };

  const setupDependencies = () => {
    // Clear any existing subscriptions
    cleanups.forEach((cleanup) => cleanup());
    cleanups = [];

    // Subscribe to all dependencies
    cleanups = dependencies.map((dep) =>
      dep.subscribe(() => {
        if (subscriptionCount > 0) {
          recompute();
        }
      }),
    );
  };

  // Override subscribe to manage dependency subscriptions
  const originalSubscribe = result.subscribe;
  return {
    get value() {
      return result.value;
    },

    setValue() {
      throw new Error("Cannot set the value of a computed reactive");
    },

    subscribe(callback) {
      if (subscriptionCount === 0) {
        setupDependencies();
      }
      subscriptionCount++;

      const unsubscribe = originalSubscribe.call(result, callback);
      return () => {
        unsubscribe();
        subscriptionCount--;
        if (subscriptionCount === 0) {
          cleanups.forEach((cleanup) => cleanup());
          cleanups = [];
        }
      };
    },

    batch<R>(updateFn: (value: TResult) => R): R {
      // Since computed values can't be modified directly,
      // we just execute the function with the current value
      return updateFn(result.value);
    },
  };
}
