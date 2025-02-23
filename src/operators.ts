import { reflex } from "./reflex";
import type { Reflex, ReflexWithError, ProjectFunction } from "./types";

/**
 * Maps values from a source reflex using a transform function
 * @param source The source reflex to map from
 * @param fn The transform function to apply to each value
 */
export function map<T, R>(source: Reflex<T>, fn: (value: T) => R): ReflexWithError<R> {
  const errorState = reflex<Error | null>({ initialValue: null });
  const mapped = reflex<R>({ initialValue: fn(source.value) }) as ReflexWithError<R>;
  mapped._errorState = errorState;

  source.subscribe((value) => {
    try {
      mapped.setValue(fn(value));
      // Clear error state on success
      errorState.setValue(null);
    } catch (error) {
      errorState.setValue(error as Error);
    }
  });

  return mapped;
}

/**
 * Filters values from a source reflex using a predicate function
 * @param source The source reflex to filter
 * @param predicate The function to test each value
 */
export function filter<T>(source: Reflex<T>, predicate: (value: T) => boolean): Reflex<T> {
  const filtered = reflex({
    initialValue: predicate(source.value) ? source.value : (undefined as T),
  });

  source.subscribe((value) => predicate(value) && filtered.setValue(value));

  return filtered;
}

/**
 * Merges multiple reflex sources into a single reflex that emits whenever any source emits
 * @param sources Array of reflex sources to merge
 */
export function merge<T>(sources: ReadonlyArray<Reflex<T>>): Reflex<T> {
  if (!sources.length) {
    throw new Error("merge requires at least one source");
  }

  const [firstSource, ...restSources] = sources;
  const merged = reflex<T>({ initialValue: firstSource.value });

  const subscriber = (value: T) => merged.setValue(value);
  restSources.forEach((source) => source.subscribe(subscriber));
  firstSource.subscribe(subscriber);

  return merged;
}

/**
 * Combines multiple reflex sources into a single reflex that emits arrays of their latest values
 * @param sources Array of reflex sources to combine
 */
export function combine<T extends unknown[]>(sources: ReadonlyArray<Reflex<T[number]>>): Reflex<T> {
  if (!sources.length) {
    throw new Error("combine requires at least one source");
  }

  const combined = reflex<T>({
    initialValue: sources.map((source) => source.value) as T,
  });

  sources.forEach((source, index) => {
    source.subscribe((value) => {
      combined.setValue([...combined.value.slice(0, index), value, ...combined.value.slice(index + 1)] as T);
    });
  });

  return combined;
}

/**
 * Creates a reflex that accumulates values over time using a reducer function
 * @param source The source reflex
 * @param reducer The reducer function to accumulate values
 * @param seed The initial accumulator value
 */
export function scan<T, R>(source: Reflex<T>, reducer: (acc: R, value: T) => R, seed: R): Reflex<R> {
  const scanned = reflex({ initialValue: seed });
  let accumulator = seed;

  source.subscribe((value) => {
    accumulator = reducer(accumulator, value);
    scanned.setValue(accumulator);
  });

  return scanned;
}

/**
 * Debounces a reflex source, only emitting after a specified delay has passed without any new emissions
 * @param source The source reflex to debounce
 * @param delayMs The delay in milliseconds
 */
export function debounce<T>(source: Reflex<T>, delayMs: number): Reflex<T> {
  const debounced = reflex({ initialValue: source.value });
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  source.subscribe((value) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => debounced.setValue(value), delayMs);
  });

  return debounced;
}

/**
 * Projects each value from the source to an inner reflex, cancelling previous projections
 * when a new value arrives. Like map, but for async/reflex operations where only the latest matters.
 * @param source The source reflex
 * @param project Function that returns a reflex or promise for each source value
 */
export function switchMap<T, R>(source: Reflex<T>, project: ProjectFunction<T, R>): Reflex<R> {
  const result = reflex<R>({ initialValue: undefined as unknown as R });
  let currentProjection = Symbol();

  const handleProjection = async (value: T, projectionId: symbol): Promise<void> => {
    try {
      const projected = project(value);

      if (projected instanceof Promise) {
        const resolvedValue = await projected;
        if (currentProjection === projectionId) {
          result.setValue(resolvedValue);
        }
      } else {
        if (currentProjection === projectionId) {
          result.setValue(projected.value);
          projected.subscribe((newValue) => {
            if (currentProjection === projectionId) {
              result.setValue(newValue);
            }
          });
        }
      }
    } catch (error) {
      console.error("[Reflex SwitchMap Error]", error);
      throw error;
    }
  };

  handleProjection(source.value, currentProjection);
  source.subscribe((value) => {
    currentProjection = Symbol();
    handleProjection(value, currentProjection);
  });

  return result;
}

/**
 * Projects each value from the source to an inner reflex, maintaining all active projections
 * concurrently. Like map, but for async/reflex operations that should run in parallel.
 * @param source The source reflex
 * @param project Function that returns a reflex or promise for each source value
 */
export function mergeMap<T, R>(source: Reflex<T>, project: ProjectFunction<T, R>): Reflex<R> {
  const result = reflex<R>({ initialValue: undefined as unknown as R });

  const handleProjection = async (value: T): Promise<void> => {
    try {
      const projected = project(value);

      if (projected instanceof Promise) {
        result.setValue(await projected);
      } else {
        result.setValue(projected.value);
        projected.subscribe((newValue) => result.setValue(newValue));
      }
    } catch (error) {
      console.error("[Reflex MergeMap Error]", error);
      throw error;
    }
  };

  handleProjection(source.value);
  source.subscribe(handleProjection);

  return result;
}

/**
 * Projects each value from the source to an inner reflex, processing projections in sequence.
 * Like map, but for async/reflex operations that must complete in order.
 * @param source The source reflex
 * @param project Function that returns a reflex or promise for each source value
 */
export function concatMap<T, R>(source: Reflex<T>, project: ProjectFunction<T, R>): Reflex<R> {
  const result = reflex<R>({ initialValue: undefined as unknown as R });
  const queue: T[] = [source.value];
  let isProcessing = false;

  const processQueue = async (): Promise<void> => {
    if (isProcessing || !queue.length) return;

    isProcessing = true;
    const value = queue[0];

    try {
      const projected = project(value);

      if (projected instanceof Promise) {
        result.setValue(await projected);
      } else {
        result.setValue(projected.value);
        const unsubscribe = projected.subscribe((newValue) => result.setValue(newValue));
        await new Promise((resolve) => setTimeout(resolve, 0));
        unsubscribe();
      }

      queue.shift();
    } catch (error) {
      console.error("[Reflex ConcatMap Error]", error);
      queue.shift();
    } finally {
      isProcessing = false;
      processQueue();
    }
  };

  processQueue();
  source.subscribe((value) => {
    queue.push(value);
    processQueue();
  });

  return result;
}

/**
 * Catches errors in a reflex stream and allows for recovery or fallback values
 * @param source The source reflex
 * @param errorHandler Function that returns a reflex or value to recover from the error
 */
export function catchError<T, R>(source: Reflex<T>, errorHandler: (error: Error) => Reflex<R> | R): Reflex<T | R> {
  const result = reflex<T | R>({ initialValue: undefined as unknown as T | R });
  let currentFallback: { reflex: Reflex<R>; unsubscribe: () => void } | null = null;

  const handleError = (error: Error): void => {
    currentFallback?.unsubscribe();
    currentFallback = null;

    const handled = errorHandler(error);
    if (handled instanceof Object && "subscribe" in handled) {
      const fallbackReflex = handled as Reflex<R>;
      const unsubscribe = fallbackReflex.subscribe((value) => result.setValue(value));
      currentFallback = { reflex: fallbackReflex, unsubscribe };
      result.setValue(fallbackReflex.value);
    } else {
      result.setValue(handled as R);
    }
  };

  try {
    result.setValue(source.value);
  } catch (error) {
    handleError(error as Error);
  }

  source.subscribe((value: T) => {
    if (currentFallback) {
      currentFallback.unsubscribe();
      currentFallback = null;
    }

    try {
      result.setValue(value);
    } catch (error) {
      handleError(error as Error);
    }
  });

  const errorState = (source as ReflexWithError<T>)._errorState;
  errorState?.subscribe((error) => error && handleError(error));

  return result;
}
