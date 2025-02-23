import { Reflex, Unsubscribe, DependencyValues, ComputeFunction, ComputedState, COMPUTED_ERRORS } from "./types";
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
  compute: ComputeFunction<TDeps, TResult>,
): Reflex<TResult> {
  const state: ComputedState<TResult> = {
    isComputing: false,
    isAsync: false,
    currentComputed: undefined as TResult,
    computePromise: null,
    cleanups: [],
    subscriptionCount: 0,
  };

  const result = reflex<TResult>({ initialValue: state.currentComputed });

  const recompute = async (): Promise<void> => {
    if (state.isComputing) {
      await state.computePromise;
      return;
    }

    state.isComputing = true;

    try {
      const depValues = dependencies.map((dep) => dep.value) as DependencyValues<TDeps>;

      if (depValues.some((v) => v === undefined)) {
        state.currentComputed = undefined as TResult;
        result.setValue(state.currentComputed);
        return;
      }

      const computeResult = compute(depValues);

      if (computeResult instanceof Promise) {
        state.isAsync = true;
        try {
          const value = await computeResult;
          if (state.subscriptionCount > 0) {
            state.currentComputed = value;
            result.setValue(value);
          }
        } catch (error) {
          console.error("[Computed Error] Async compute function failed:", error);
        } finally {
          state.isComputing = false;
          state.computePromise = null;
        }
      } else {
        state.currentComputed = computeResult;
        result.setValue(computeResult);
      }
    } catch (error) {
      console.error("[Computed Error] Compute function failed:", error);
    } finally {
      state.isComputing = false;
    }
  };

  const setupDependencies = (): void => {
    state.cleanups.forEach((cleanup) => cleanup());
    state.cleanups = [];

    state.cleanups = dependencies.map((dep) =>
      dep.subscribe(() => {
        if (state.subscriptionCount > 0) {
          recompute();
        }
      }),
    );

    recompute();
  };

  const cleanup = (): void => {
    state.cleanups.forEach((cleanup) => cleanup());
    state.cleanups = [];
  };

  const originalSubscribe = result.subscribe;

  return {
    get value(): TResult {
      return state.currentComputed;
    },

    setValue(): never {
      throw new Error(COMPUTED_ERRORS.SET_VALUE);
    },

    setValueAsync(): never {
      throw new Error(COMPUTED_ERRORS.SET_VALUE);
    },

    subscribe(callback): Unsubscribe {
      if (state.subscriptionCount === 0) {
        setupDependencies();
      }
      state.subscriptionCount++;

      const unsubscribe = originalSubscribe.call(result, callback);

      return () => {
        unsubscribe();
        state.subscriptionCount--;
        if (state.subscriptionCount === 0) {
          cleanup();
        }
      };
    },

    batch<R>(updateFn: (value: TResult) => R): R {
      if (state.isAsync) {
        throw new Error(COMPUTED_ERRORS.SYNC_BATCH);
      }
      return updateFn(state.currentComputed);
    },

    async batchAsync<R>(updateFn: (value: TResult) => Promise<R> | R): Promise<R> {
      await state.computePromise;
      return Promise.resolve(updateFn(state.currentComputed));
    },

    addMiddleware(): never {
      throw new Error(COMPUTED_ERRORS.ADD_MIDDLEWARE);
    },

    removeMiddleware(): never {
      throw new Error(COMPUTED_ERRORS.REMOVE_MIDDLEWARE);
    },
  };
}
