import { reflex } from "./reflex";
import type { Reflex, ReflexWithError } from "./types";

/**
 * Maps values from a source reflex using a transform function
 * @param source The source reflex to map from
 * @param fn The transform function to apply to each value
 */
export function map<T, R>(source: Reflex<T>, fn: (value: T) => R): Reflex<R> {
  const errorState = reflex<Error | null>({
    initialValue: null,
  });

  const mapped = reflex<R>({
    initialValue: undefined as unknown as R,
  }) as ReflexWithError<R>;

  // Try to set initial value
  try {
    mapped.setValue(fn(source.value));
  } catch (error) {
    errorState.setValue(error as Error);
  }

  source.subscribe((value) => {
    try {
      mapped.setValue(fn(value));
      // Clear error state on success
      errorState.setValue(null);
    } catch (error) {
      errorState.setValue(error as Error);
    }
  });

  // Add error state to mapped reflex
  mapped._errorState = errorState;

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

  source.subscribe((value) => {
    if (predicate(value)) {
      filtered.setValue(value);
    }
  });

  return filtered;
}

/**
 * Merges multiple reflex sources into a single reflex that emits whenever any source emits
 * @param sources Array of reflex sources to merge
 */
export function merge<T>(sources: Array<Reflex<T>>): Reflex<T> {
  if (sources.length === 0) {
    throw new Error("merge requires at least one source");
  }

  // Create merged reflex with initial value from first source
  const merged = reflex<T>({
    initialValue: sources[0].value,
  });

  // Skip the first source's initial value since it's already set
  sources.slice(1).forEach((source) => {
    source.subscribe((value) => {
      merged.setValue(value);
    });
  });

  // Subscribe to the first source last to maintain order
  sources[0].subscribe((value) => {
    merged.setValue(value);
  });

  return merged;
}

/**
 * Combines multiple reflex sources into a single reflex that emits arrays of their latest values
 * @param sources Array of reflex sources to combine
 */
export function combine<T extends unknown[]>(sources: Array<Reflex<T[number]>>): Reflex<T> {
  if (sources.length === 0) {
    throw new Error("combine requires at least one source");
  }

  const combined = reflex<T>({
    initialValue: sources.map((source) => source.value) as T,
  });

  sources.forEach((source, index) => {
    source.subscribe((value) => {
      const currentValues = [...combined.value];
      // Index is safe as it comes from Array.forEach
      // eslint-disable-next-line security/detect-object-injection
      currentValues[index] = value;
      combined.setValue(currentValues as T);
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
  const scanned = reflex({
    initialValue: reducer(seed, source.value),
  });

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
  const debounced = reflex({
    initialValue: source.value,
  });

  let timeoutId: NodeJS.Timeout | null = null;

  source.subscribe((value) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      debounced.setValue(value);
    }, delayMs);
  });

  return debounced;
}

/**
 * Projects each value from the source to an inner reflex, cancelling previous projections
 * when a new value arrives. Like map, but for async/reflex operations where only the latest matters.
 * @param source The source reflex
 * @param project Function that returns a reflex or promise for each source value
 */
export function switchMap<T, R>(source: Reflex<T>, project: (value: T) => Reflex<R> | Promise<R>): Reflex<R> {
  const result = reflex<R>({
    initialValue: undefined as unknown as R,
  });

  let currentProjection: symbol | null = null;

  // Start with initial value
  const initialProjection = Symbol();
  currentProjection = initialProjection;
  const initialProjected = project(source.value);

  if (initialProjected instanceof Promise) {
    initialProjected.then((value) => {
      if (currentProjection === initialProjection) {
        result.setValue(value);
      }
    });
  } else {
    result.setValue(initialProjected.value);
    initialProjected.subscribe((value) => {
      if (currentProjection === initialProjection) {
        result.setValue(value);
      }
    });
  }

  source.subscribe(async (value) => {
    const thisProjection = Symbol();
    currentProjection = thisProjection;

    try {
      const projected = project(value);

      if (projected instanceof Promise) {
        const resolvedValue = await projected;
        if (currentProjection === thisProjection) {
          result.setValue(resolvedValue);
        }
      } else {
        if (currentProjection === thisProjection) {
          result.setValue(projected.value);
          projected.subscribe((newValue) => {
            if (currentProjection === thisProjection) {
              result.setValue(newValue);
            }
          });
        }
      }
    } catch (error) {
      console.error("[Reflex SwitchMap Error]", error);
      throw error;
    }
  });

  return result;
}

/**
 * Projects each value from the source to an inner reflex, maintaining all active projections
 * concurrently. Like map, but for async/reflex operations that should run in parallel.
 * @param source The source reflex
 * @param project Function that returns a reflex or promise for each source value
 */
export function mergeMap<T, R>(source: Reflex<T>, project: (value: T) => Reflex<R> | Promise<R>): Reflex<R> {
  const result = reflex<R>({
    initialValue: undefined as unknown as R,
  });

  // Start with initial value
  const initialProjected = project(source.value);
  if (initialProjected instanceof Promise) {
    initialProjected.then((value) => result.setValue(value));
  } else {
    result.setValue(initialProjected.value);
    initialProjected.subscribe((newValue) => {
      result.setValue(newValue);
    });
  }

  source.subscribe(async (value) => {
    try {
      const projected = project(value);

      if (projected instanceof Promise) {
        const resolvedValue = await projected;
        result.setValue(resolvedValue);
      } else {
        result.setValue(projected.value);
        projected.subscribe((newValue) => {
          result.setValue(newValue);
        });
      }
    } catch (error) {
      console.error("[Reflex MergeMap Error]", error);
      throw error;
    }
  });

  return result;
}

/**
 * Projects each value from the source to an inner reflex, processing projections in sequence.
 * Like map, but for async/reflex operations that must complete in order.
 * @param source The source reflex
 * @param project Function that returns a reflex or promise for each source value
 */
export function concatMap<T, R>(source: Reflex<T>, project: (value: T) => Reflex<R> | Promise<R>): Reflex<R> {
  const result = reflex<R>({
    initialValue: undefined as unknown as R,
  });

  const queue: T[] = [];
  let isProcessing = false;

  const processQueue = async () => {
    if (isProcessing || queue.length === 0) return;

    isProcessing = true;
    const value = queue[0]; // Don't shift yet

    try {
      const projected = project(value);

      if (projected instanceof Promise) {
        const resolvedValue = await projected;
        result.setValue(resolvedValue);
        queue.shift(); // Remove after successful processing
        isProcessing = false;
        processQueue();
      } else {
        result.setValue(projected.value);
        const unsubscribe = projected.subscribe((newValue) => {
          result.setValue(newValue);
        });
        // Wait a tick to allow synchronous emissions
        await new Promise((resolve) => setTimeout(resolve, 0));
        unsubscribe();
        queue.shift(); // Remove after successful processing
        isProcessing = false;
        processQueue();
      }
    } catch (error) {
      console.error("[Reflex ConcatMap Error]", error);
      queue.shift(); // Remove on error
      isProcessing = false;
      processQueue();
    }
  };

  // Start with initial value
  queue.push(source.value);
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
  let currentFallback: Reflex<R> | null = null;
  let fallbackUnsubscribe: (() => void) | null = null;

  const result = reflex<T | R>({
    initialValue: undefined as unknown as T | R,
  });

  const handleError = (error: Error) => {
    // Clean up any existing fallback subscription
    if (fallbackUnsubscribe) {
      fallbackUnsubscribe();
      fallbackUnsubscribe = null;
      currentFallback = null;
    }

    const handled = errorHandler(error);
    if (handled instanceof Object && "subscribe" in handled) {
      currentFallback = handled as Reflex<R>;
      result.setValue(currentFallback.value);
      fallbackUnsubscribe = currentFallback.subscribe((value: R) => {
        result.setValue(value);
      });
    } else {
      result.setValue(handled as R);
    }
  };

  // Handle initial value
  try {
    result.setValue(source.value);
  } catch (error) {
    handleError(error as Error);
  }

  // Subscribe to source
  source.subscribe((value: T) => {
    // If we're in fallback mode and this is a successful value, cleanup fallback
    if (currentFallback) {
      if (fallbackUnsubscribe) {
        fallbackUnsubscribe();
        fallbackUnsubscribe = null;
      }
      currentFallback = null;
    }

    try {
      result.setValue(value);
    } catch (error) {
      handleError(error as Error);
    }
  });

  // Subscribe to error state if available
  const errorState = (source as ReflexWithError<T>)._errorState;
  if (errorState) {
    errorState.subscribe((error: Error | null) => {
      if (error) {
        handleError(error);
      }
    });
  }

  return result;
}
