import { Reflex, Unsubscribe, DependencyValues } from "./types";
import { reflex } from "./reflex";

/**
 * Creates a computed reactive value that depends on other reactive values.
 * The computed value automatically updates when any of its dependencies change.
 *
 * @param dependencies - Array of reflex values this computation depends on
 * @param compute - Function that computes the result from the current dependency values
 * @returns A read-only reflex value that updates automatically when dependencies change
 */
export function computed<TDeps extends Reflex<unknown>[], TResult>(
  dependencies: [...TDeps],
  compute: (values: DependencyValues<TDeps>) => TResult | Promise<TResult>,
): Reflex<TResult> {
  let isComputing = false;
  let isAsync = false;
  let currentComputed: TResult = undefined as TResult;
  let computePromise: Promise<void> | null = null;

  // Create reactive for computed value
  const result = reflex<TResult>({
    initialValue: currentComputed,
  });

  let cleanups: Unsubscribe[] = [];
  let subscriptionCount = 0;

  const recompute = async () => {
    if (isComputing) {
      if (computePromise) {
        await computePromise;
      }
      return;
    }
    isComputing = true;

    try {
      const depValues = dependencies.map((dep) => dep.value) as DependencyValues<TDeps>;

      // Check if any dependency is undefined
      if (depValues.some((v) => v === undefined)) {
        currentComputed = undefined as TResult;
        result.setValue(currentComputed);
        isComputing = false;
        return;
      }

      const computeResult = compute(depValues);

      if (computeResult instanceof Promise) {
        isAsync = true;
        computePromise = computeResult
          .then((value) => {
            if (subscriptionCount > 0) {
              // Only update if we still have subscribers
              currentComputed = value;
              result.setValue(value);
            }
          })
          .catch((error) => {
            console.error("Error in async compute function:", error);
          })
          .finally(() => {
            isComputing = false;
            computePromise = null;
          });
        await computePromise;
      } else {
        currentComputed = computeResult;
        result.setValue(computeResult);
        isComputing = false;
      }
    } catch (error) {
      console.error("Error in compute function:", error);
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

    // Initial computation
    recompute();
  };

  // Override subscribe to manage dependency subscriptions
  const originalSubscribe = result.subscribe;
  return {
    get value() {
      return currentComputed;
    },

    setValue() {
      throw new Error("Cannot set the value of a computed reactive");
    },

    setValueAsync() {
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
      if (isAsync) {
        throw new Error("Cannot use sync batch on async computed value");
      }
      return updateFn(currentComputed);
    },

    async batchAsync<R>(updateFn: (value: TResult) => Promise<R> | R): Promise<R> {
      if (computePromise) {
        await computePromise;
      }
      return Promise.resolve(updateFn(currentComputed));
    },

    addMiddleware() {
      throw new Error("Cannot add middleware to a computed reactive");
    },

    removeMiddleware() {
      throw new Error("Cannot remove middleware from a computed reactive");
    },
  };
}
