import { Reflex, ReflexOptions, Subscriber, Unsubscribe } from "./types";

/**
 * Creates a reactive value that can be subscribed to for changes.
 *
 * @example
 * ```typescript
 * const count = reflex({ initialValue: 0 });
 *
 * // Subscribe to changes
 * const unsubscribe = count.subscribe(value => console.log('Count changed:', value));
 *
 * // Update value
 * count.setValue(1); // Logs: Count changed: 1
 *
 * // Cleanup
 * unsubscribe();
 * ```
 */
export function reflex<T>(options: ReflexOptions<T>): Reflex<T> {
  const subscribers = new Set<Subscriber<T>>();
  let currentValue = options.initialValue;
  let isNotifying = false;
  let isBatching = false;
  let skipInitialNotify = false;

  const defaultEquals = (a: T, b: T) => a === b;
  const equals = options.equals || defaultEquals;

  const notifySubscribers = (value: T) => {
    if (isNotifying || isBatching) return; // Don't notify during batch updates
    isNotifying = true;

    try {
      subscribers.forEach((subscriber) => {
        try {
          subscriber(value);
        } catch (error) {
          console.error("Error in subscriber:", error);
        }
      });
    } finally {
      isNotifying = false;
    }
  };

  return {
    get value() {
      return currentValue;
    },

    setValue(newValue: T) {
      if (!equals(currentValue, newValue)) {
        currentValue = newValue;
        if (!isBatching) {
          notifySubscribers(newValue);
        }
      }
    },

    subscribe(callback: Subscriber<T>): Unsubscribe {
      subscribers.add(callback);

      // Immediately call with current value unless skipped
      if (!skipInitialNotify) {
        try {
          callback(currentValue);
        } catch (error) {
          console.error("Error in subscriber:", error);
        }
      }

      return () => {
        subscribers.delete(callback);
      };
    },

    batch<R>(updateFn: (value: T) => R): R {
      const wasBatching = isBatching;
      isBatching = true;
      skipInitialNotify = true;

      try {
        const result = updateFn(currentValue);
        if (!wasBatching) {
          // Only notify if this is the outermost batch
          notifySubscribers(currentValue);
        }
        return result;
      } finally {
        isBatching = wasBatching; // Restore previous batching state
        skipInitialNotify = false;
      }
    },
  };
}
