import { Reflex, ReflexOptions, Subscriber, Unsubscribe, Middleware } from "./types";

/**
 * Creates a reactive value that can be subscribed to for changes.
 *
 * @param options - Configuration options for the reflex value
 * @param options.initialValue - The initial value to store
 * @param options.equals - Optional custom equality function to determine if value has changed
 * @param options.debug - Optional debug mode to log state changes
 * @param options.middleware - Optional array of middleware functions to intercept state changes
 * @returns A reflex object with methods to get/set values and subscribe to changes
 */
export function reflex<T>(options: ReflexOptions<T>): Reflex<T> {
  const subscribers = new Set<Subscriber<T>>();
  let currentValue = options.initialValue;
  let isNotifying = false;
  let isBatching = false;
  let skipInitialNotify = false;
  let batchQueue: T[] = [];
  let middleware = options.middleware || [];

  const defaultEquals = (a: T, b: T) => a === b;
  const equals = options.equals || defaultEquals;

  const debugLog = (message: string, value?: T) => {
    if (options.debug) {
      console.log(`[Reflex Debug] ${message}`, value !== undefined ? value : "");
    }
  };

  const applyMiddleware = (value: T): T => {
    let result = value;
    for (const fn of middleware) {
      try {
        const fnResult = fn(result);
        // If middleware returns a promise, warn and skip
        if (fnResult instanceof Promise) {
          console.warn("[Reflex Warning] Async middleware detected in sync operation");
          continue;
        }
        result = fnResult;
      } catch (error) {
        console.error("[Reflex Middleware Error]", error);
        throw error;
      }
    }
    return result;
  };

  const notifySubscribers = (value: T) => {
    if (isNotifying || (isBatching && !options.notifyDuringBatch)) {
      if (isBatching) {
        batchQueue.push(value);
      }
      return;
    }

    isNotifying = true;
    debugLog("Notifying subscribers with value:", value);

    try {
      subscribers.forEach((subscriber) => {
        try {
          const result = subscriber(value);
          if (result instanceof Promise) {
            result.catch((error) => {
              console.error("[Reflex Subscriber Error]", error);
            });
          }
        } catch (error) {
          console.error("[Reflex Subscriber Error]", error);
          debugLog("Error in subscriber:", value);
        }
      });
    } finally {
      isNotifying = false;
    }
  };

  const processQueuedUpdates = () => {
    if (batchQueue.length === 0) return;

    const lastValue = batchQueue[batchQueue.length - 1];
    batchQueue = [];
    notifySubscribers(lastValue);
  };

  return {
    get value() {
      return currentValue;
    },

    setValue(newValue: T) {
      try {
        const processedValue = applyMiddleware(newValue);

        if (!equals(currentValue, processedValue)) {
          debugLog("Setting new value:", processedValue);
          currentValue = processedValue;

          if (!isBatching || options.notifyDuringBatch) {
            notifySubscribers(processedValue);
          }
        } else {
          debugLog("Value unchanged, skipping update");
        }
      } catch (error) {
        console.error("[Reflex SetValue Error]", error);
        throw error;
      }
    },

    subscribe(callback: Subscriber<T>): Unsubscribe {
      debugLog("New subscription added");
      subscribers.add(callback);

      if (!skipInitialNotify) {
        try {
          const result = callback(currentValue);
          if (result instanceof Promise) {
            result.catch((error) => {
              console.error("[Reflex Initial Subscribe Error]", error);
            });
          }
        } catch (error) {
          console.error("[Reflex Initial Subscribe Error]", error);
        }
      }

      return () => {
        debugLog("Subscription removed");
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
          // Only process queue if this is the outermost batch
          processQueuedUpdates();
        }

        return result;
      } finally {
        isBatching = wasBatching;
        skipInitialNotify = false;
      }
    },

    async setValueAsync(newValue: T) {
      try {
        let processedValue = newValue;
        for (const fn of middleware) {
          processedValue = await Promise.resolve(fn(processedValue));
        }

        if (!equals(currentValue, processedValue)) {
          debugLog("Setting new value:", processedValue);
          currentValue = processedValue;

          if (!isBatching || options.notifyDuringBatch) {
            notifySubscribers(processedValue);
          }
        } else {
          debugLog("Value unchanged, skipping update");
        }
      } catch (error) {
        console.error("[Reflex SetValue Error]", error);
        throw error;
      }
    },

    async batchAsync<R>(updateFn: (value: T) => Promise<R> | R): Promise<R> {
      const wasBatching = isBatching;
      isBatching = true;
      skipInitialNotify = true;

      try {
        const result = await Promise.resolve(updateFn(currentValue));

        if (!wasBatching) {
          // Only process queue if this is the outermost batch
          processQueuedUpdates();
        }

        return result;
      } finally {
        isBatching = wasBatching;
        skipInitialNotify = false;
      }
    },

    addMiddleware(fn: Middleware<T>) {
      middleware.push(fn);
      debugLog("Middleware added");
    },

    removeMiddleware(fn: Middleware<T>) {
      middleware = middleware.filter((m) => m !== fn);
      debugLog("Middleware removed");
    },
  };
}
