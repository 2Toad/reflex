import { reflex } from "./reflex";
import type { Reflex } from "./types";

/**
 * Maps values from a source reflex using a transform function
 * @param source The source reflex to map from
 * @param fn The transform function to apply to each value
 */
export function map<T, R>(source: Reflex<T>, fn: (value: T) => R): Reflex<R> {
  const mapped = reflex<R>({
    initialValue: fn(source.value),
  });

  source.subscribe((value) => {
    mapped.setValue(fn(value));
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
