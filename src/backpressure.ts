import { Reflex, BackpressureOptions, BackpressureCapable, BackpressureStrategy } from "./types";
import { reflex } from "./reflex";

/**
 * Creates a reflex with backpressure handling capabilities.
 * The returned object combines both Reflex<T> functionality and backpressure control methods.
 *
 * @param source The source reflex to add backpressure handling to
 * @param options Configuration options for backpressure handling
 * @returns A Reflex that includes backpressure control methods
 */
export function withBackpressure<T>(source: Reflex<T>, options: BackpressureOptions): Reflex<T> & BackpressureCapable {
  const buffer: T[] = [];
  let isPaused = false;
  const bufferSize = options.bufferSize || 1000;
  let valueCount = 0; // Track total values, including current
  let sourceUnsubscribe: (() => void) | null = null;
  let subscriberCount = 0;

  const result = reflex<T>({
    initialValue: source.value,
  }) as Reflex<T> & BackpressureCapable;

  // Add backpressure control methods
  result.pause = () => {
    isPaused = true;
  };
  result.resume = () => {
    isPaused = false;
    // Process buffered values based on strategy
    if (options.strategy === BackpressureStrategy.Buffer || options.strategy === BackpressureStrategy.Sliding) {
      while (buffer.length > 0 && !isPaused) {
        const value = buffer.shift()!;
        valueCount--;
        result.setValue(value);
      }
    }
  };
  result.isPaused = () => isPaused;
  result.getBufferSize = () => valueCount;

  const cleanup = () => {
    if (sourceUnsubscribe) {
      sourceUnsubscribe();
      sourceUnsubscribe = null;
    }
    buffer.length = 0;
    valueCount = 0;
    isPaused = false;
  };

  const startBackpressure = () => {
    if (!sourceUnsubscribe) {
      sourceUnsubscribe = source.subscribe((value) => {
        result.setValue(value);
      });
    }
  };

  // Override subscribe to manage backpressure
  const originalSubscribe = result.subscribe.bind(result);
  result.subscribe = (subscriber) => {
    subscriberCount++;
    if (subscriberCount === 1) {
      startBackpressure();
    }

    const unsubscribe = originalSubscribe(subscriber);
    return () => {
      unsubscribe();
      subscriberCount--;
      if (subscriberCount === 0) {
        cleanup();
      }
    };
  };

  // Override setValue on the source to handle backpressure
  const originalSetValue = source.setValue;
  source.setValue = (value: T) => {
    const shouldApplyBackpressure =
      options.shouldApplyBackpressure?.() ?? (options.strategy !== BackpressureStrategy.Drop && valueCount >= bufferSize);

    // Handle error strategy first
    if (options.strategy === BackpressureStrategy.Error) {
      if (isPaused || valueCount >= bufferSize || shouldApplyBackpressure) {
        throw new Error("Backpressure limit exceeded");
      }
      valueCount++;
      originalSetValue.call(source, value);
      return;
    }

    // Handle other strategies
    if (!isPaused && !shouldApplyBackpressure) {
      valueCount++;
      originalSetValue.call(source, value);
      return;
    }

    switch (options.strategy) {
      case BackpressureStrategy.Drop:
        // Simply drop the value when backpressure is applied
        break;

      case BackpressureStrategy.Buffer:
        if (valueCount < bufferSize) {
          buffer.push(value);
          valueCount++;
        } else if (options.shouldApplyBackpressure) {
          // If using custom backpressure predicate, still buffer
          buffer.push(value);
          valueCount++;
        }
        break;

      case BackpressureStrategy.Sliding:
        if (valueCount >= bufferSize) {
          buffer.shift(); // Remove oldest value
          valueCount--;
        }
        buffer.push(value);
        valueCount++;
        break;

      default:
        throw new Error(`Unknown backpressure strategy: ${options.strategy}`);
    }
  };

  return result;
}

/**
 * Creates a reflex that buffers values for a specified duration
 * @param source The source reflex to buffer
 * @param duration The duration in milliseconds to buffer values
 */
export function buffer<T>(source: Reflex<T>, duration: number): Reflex<T[]> {
  const result = reflex<T[]>({
    initialValue: [],
  });

  let currentBuffer: T[] = [];
  let timeoutId: NodeJS.Timeout | null = null;
  let isInitialized = false;
  let sourceUnsubscribe: (() => void) | null = null;
  let subscriberCount = 0;

  const flushBuffer = () => {
    if (currentBuffer.length > 0) {
      result.setValue([...currentBuffer]);
      currentBuffer = [];
    }
    timeoutId = null;
  };

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (sourceUnsubscribe) {
      sourceUnsubscribe();
      sourceUnsubscribe = null;
    }
    currentBuffer = [];
    isInitialized = false;
  };

  const startBuffering = () => {
    if (!sourceUnsubscribe) {
      sourceUnsubscribe = source.subscribe((value) => {
        if (!isInitialized) {
          isInitialized = true;
          return;
        }

        currentBuffer.push(value);

        if (!timeoutId) {
          timeoutId = setTimeout(flushBuffer, duration);
        }
      });
    }
  };

  // Override subscribe to manage buffering
  const originalSubscribe = result.subscribe.bind(result);
  result.subscribe = (subscriber) => {
    subscriberCount++;
    if (subscriberCount === 1) {
      startBuffering();
    }

    const unsubscribe = originalSubscribe(subscriber);
    return () => {
      unsubscribe();
      subscriberCount--;
      if (subscriberCount === 0) {
        cleanup();
      }
    };
  };

  return result;
}

/**
 * Creates a reflex that samples the source reflex at the specified interval
 * @param source The source reflex to sample
 * @param interval The interval in milliseconds between samples
 */
export function sample<T>(source: Reflex<T>, interval: number): Reflex<T> {
  const result = reflex<T>({
    initialValue: source.value,
  });

  let intervalId: NodeJS.Timeout | null = null;
  let subscriberCount = 0;

  const startSampling = () => {
    if (!intervalId) {
      intervalId = setInterval(() => {
        result.setValue(source.value);
      }, interval);
    }
  };

  const stopSampling = () => {
    if (intervalId) {
      clearInterval(intervalId);
      intervalId = null;
    }
  };

  // Override subscribe to manage sampling
  const originalSubscribe = result.subscribe.bind(result);
  result.subscribe = (subscriber) => {
    subscriberCount++;
    if (subscriberCount === 1) {
      startSampling();
    }

    const unsubscribe = originalSubscribe(subscriber);
    return () => {
      unsubscribe();
      subscriberCount--;
      if (subscriberCount === 0) {
        stopSampling();
      }
    };
  };

  return result;
}

/**
 * Creates a reflex that throttles the source reflex to emit at most once per specified duration
 * @param source The source reflex to throttle
 * @param duration The minimum time between emissions in milliseconds
 */
export function throttle<T>(source: Reflex<T>, duration: number): Reflex<T> {
  const result = reflex<T>({
    initialValue: source.value,
  });

  let lastEmitTime = 0;
  let timeoutId: NodeJS.Timeout | null = null;
  let isInitialized = false;
  let pendingValue: T | null = null;
  let sourceUnsubscribe: (() => void) | null = null;
  let subscriberCount = 0;

  const cleanup = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    if (sourceUnsubscribe) {
      sourceUnsubscribe();
      sourceUnsubscribe = null;
    }
    pendingValue = null;
    isInitialized = false;
  };

  const startThrottling = () => {
    if (!sourceUnsubscribe) {
      sourceUnsubscribe = source.subscribe((value) => {
        const now = Date.now();

        if (!isInitialized) {
          isInitialized = true;
          result.setValue(value);
          lastEmitTime = now;
          return;
        }

        if (now - lastEmitTime >= duration) {
          result.setValue(value);
          lastEmitTime = now;
          pendingValue = null;
          if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
          }
        } else {
          if (!timeoutId) {
            // Emit the first value immediately if it's the first in this time window
            if (pendingValue === null) {
              result.setValue(value);
              lastEmitTime = now;
            }
            pendingValue = value;
            const remainingTime = duration - (now - lastEmitTime);
            timeoutId = setTimeout(() => {
              if (pendingValue !== null) {
                result.setValue(pendingValue);
                lastEmitTime = Date.now();
                pendingValue = null;
              }
              timeoutId = null;
            }, remainingTime);
          } else {
            pendingValue = value;
          }
        }
      });
    }
  };

  // Override subscribe to manage throttling
  const originalSubscribe = result.subscribe.bind(result);
  result.subscribe = (subscriber) => {
    subscriberCount++;
    if (subscriberCount === 1) {
      startThrottling();
    }

    const unsubscribe = originalSubscribe(subscriber);
    return () => {
      unsubscribe();
      subscriberCount--;
      if (subscriberCount === 0) {
        cleanup();
      }
    };
  };

  return result;
}
