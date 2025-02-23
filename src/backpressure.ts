import { Reflex, BackpressureOptions, BackpressureCapable, BackpressureStrategy, BackpressureState } from "./types";
import { reflex } from "./reflex";

/**
 * Creates a reflex with backpressure handling capabilities.
 * The returned object combines both Reflex<T> functionality and backpressure control methods.
 *
 * Backpressure is a mechanism to handle situations where values are being produced faster
 * than they can be consumed. This function provides several strategies to handle such situations:
 *
 * - Drop: Simply drops values when backpressure is applied
 * - Buffer: Stores values in a buffer up to a specified size
 * - Sliding: Maintains a buffer of the most recent values, dropping older ones
 * - Error: Throws an error when backpressure limit is exceeded
 *
 * Example usage:
 * ```typescript
 * const source = reflex({ initialValue: 0 });
 * const controlled = withBackpressure(source, {
 *   strategy: BackpressureStrategy.Buffer,
 *   bufferSize: 100,
 *   shouldApplyBackpressure: () => customCondition
 * });
 *
 * // Control flow with pause/resume
 * controlled.pause();  // Stop processing values
 * controlled.resume(); // Resume and process buffered values
 * ```
 *
 * @param source The source reflex to add backpressure handling to
 * @param options Configuration options for backpressure handling:
 *   - strategy: The backpressure strategy to use (Drop, Buffer, Sliding, Error)
 *   - bufferSize: Maximum number of values to buffer (default: 1000)
 *   - shouldApplyBackpressure: Optional function to determine when to apply backpressure
 * @returns A Reflex that includes backpressure control methods
 */
export function withBackpressure<T>(source: Reflex<T>, options: BackpressureOptions): Reflex<T> & BackpressureCapable {
  const state: BackpressureState<T> = {
    buffer: [],
    isPaused: false,
    valueCount: 0,
    sourceUnsubscribe: null,
    subscriberCount: 0,
    lastEmitTime: 0,
  };

  const bufferSize = options.bufferSize || 1000;

  const result = reflex<T>({
    initialValue: source.value,
  }) as Reflex<T> & BackpressureCapable;

  const processBuffer = (): void => {
    while (state.buffer.length > 0 && !state.isPaused) {
      const value = state.buffer.shift()!;
      state.valueCount--;
      result.setValue(value);
    }
  };

  // Add backpressure control methods
  result.pause = () => {
    state.isPaused = true;
  };

  result.resume = () => {
    state.isPaused = false;
    if (options.strategy === BackpressureStrategy.Buffer || options.strategy === BackpressureStrategy.Sliding) {
      processBuffer();
    }
  };

  result.isPaused = () => state.isPaused;
  result.getBufferSize = () => state.valueCount;

  const cleanup = () => {
    if (state.sourceUnsubscribe) {
      state.sourceUnsubscribe();
      state.sourceUnsubscribe = null;
    }
    state.buffer.length = 0;
    state.valueCount = 0;
    state.isPaused = false;
  };

  const startBackpressure = () => {
    if (!state.sourceUnsubscribe) {
      state.sourceUnsubscribe = source.subscribe((value) => {
        result.setValue(value);
      });
    }
  };

  // Override subscribe to manage backpressure
  const originalSubscribe = result.subscribe.bind(result);
  result.subscribe = (subscriber) => {
    state.subscriberCount++;
    if (state.subscriberCount === 1) {
      startBackpressure();
    }

    const unsubscribe = originalSubscribe(subscriber);
    return () => {
      unsubscribe();
      state.subscriberCount--;
      if (state.subscriberCount === 0) {
        cleanup();
      }
    };
  };

  // Override setValue on the source to handle backpressure
  const originalSetValue = source.setValue;
  source.setValue = (value: T) => {
    const shouldApplyBackpressure =
      options.shouldApplyBackpressure?.() ?? (options.strategy !== BackpressureStrategy.Drop && state.valueCount >= bufferSize);

    // Handle error strategy first
    if (options.strategy === BackpressureStrategy.Error) {
      if (state.isPaused || state.valueCount >= bufferSize || shouldApplyBackpressure) {
        throw new Error("Backpressure limit exceeded");
      }
      state.valueCount++;
      originalSetValue.call(source, value);
      return;
    }

    // Handle other strategies
    if (!state.isPaused && !shouldApplyBackpressure) {
      state.valueCount++;
      originalSetValue.call(source, value);
      return;
    }

    switch (options.strategy) {
      case BackpressureStrategy.Drop:
        // Simply drop the value when backpressure is applied
        break;

      case BackpressureStrategy.Buffer:
        if (state.valueCount < bufferSize || options.shouldApplyBackpressure) {
          state.buffer.push(value);
          state.valueCount++;
        }
        break;

      case BackpressureStrategy.Sliding:
        if (state.valueCount >= bufferSize) {
          state.buffer.shift(); // Remove oldest value
          state.valueCount--;
        }
        state.buffer.push(value);
        state.valueCount++;
        break;

      default:
        throw new Error(`Unknown backpressure strategy: ${options.strategy}`);
    }
  };

  return result;
}

/**
 * Creates a reflex that buffers values for a specified duration.
 * Values received during the duration window are collected into an array
 * and emitted together when the window closes.
 *
 * Example usage:
 * ```typescript
 * const source = reflex({ initialValue: 0 });
 * const buffered = buffer(source, 1000); // Buffer for 1 second
 *
 * // If source emits: 1, 2, 3 within 1 second
 * // buffered will emit: [1, 2, 3] after 1 second
 * ```
 *
 * @param source The source reflex to buffer
 * @param duration The duration in milliseconds to buffer values
 * @returns A Reflex that emits arrays of buffered values
 */
export function buffer<T>(source: Reflex<T>, duration: number): Reflex<T[]> {
  const result = reflex<T[]>({
    initialValue: [],
  });

  const state: BackpressureState<T> = {
    buffer: [],
    isPaused: false,
    valueCount: 0,
    sourceUnsubscribe: null,
    subscriberCount: 0,
    timeoutId: null,
    isInitialized: false,
    lastEmitTime: 0,
  };

  const flushBuffer = () => {
    if (state.buffer.length > 0) {
      result.setValue([...state.buffer]);
      state.buffer = [];
    }
    state.timeoutId = null;
  };

  const cleanup = () => {
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
      state.timeoutId = null;
    }
    if (state.sourceUnsubscribe) {
      state.sourceUnsubscribe();
      state.sourceUnsubscribe = null;
    }
    state.buffer = [];
    state.isInitialized = false;
  };

  const startBuffering = () => {
    if (!state.sourceUnsubscribe) {
      state.sourceUnsubscribe = source.subscribe((value) => {
        if (!state.isInitialized) {
          state.isInitialized = true;
          return;
        }

        state.buffer.push(value);

        if (!state.timeoutId) {
          state.timeoutId = setTimeout(flushBuffer, duration);
        }
      });
    }
  };

  // Override subscribe to manage buffering
  const originalSubscribe = result.subscribe.bind(result);
  result.subscribe = (subscriber) => {
    state.subscriberCount++;
    if (state.subscriberCount === 1) {
      startBuffering();
    }

    const unsubscribe = originalSubscribe(subscriber);
    return () => {
      unsubscribe();
      state.subscriberCount--;
      if (state.subscriberCount === 0) {
        cleanup();
      }
    };
  };

  return result;
}

/**
 * Creates a reflex that samples the source reflex at the specified interval.
 * The resulting reflex will emit the most recent value from the source
 * at each interval, regardless of how many values the source has emitted.
 *
 * Example usage:
 * ```typescript
 * const source = reflex({ initialValue: 0 });
 * const sampled = sample(source, 1000); // Sample every second
 *
 * // If source emits rapidly: 1, 2, 3, 4, 5
 * // sampled might emit: 1, 3, 5 (at 1-second intervals)
 * ```
 *
 * @param source The source reflex to sample
 * @param interval The interval in milliseconds between samples
 * @returns A Reflex that emits sampled values at the specified interval
 */
export function sample<T>(source: Reflex<T>, interval: number): Reflex<T> {
  const result = reflex<T>({
    initialValue: source.value,
  });

  const state: BackpressureState<T> = {
    buffer: [],
    isPaused: false,
    valueCount: 0,
    sourceUnsubscribe: null,
    subscriberCount: 0,
    timeoutId: null,
    lastEmitTime: 0,
  };

  const startSampling = () => {
    if (!state.timeoutId) {
      state.timeoutId = setInterval(() => {
        result.setValue(source.value);
      }, interval);
    }
  };

  const cleanup = () => {
    if (state.timeoutId) {
      clearInterval(state.timeoutId);
      state.timeoutId = null;
    }
  };

  // Override subscribe to manage sampling
  const originalSubscribe = result.subscribe.bind(result);
  result.subscribe = (subscriber) => {
    state.subscriberCount++;
    if (state.subscriberCount === 1) {
      startSampling();
    }

    const unsubscribe = originalSubscribe(subscriber);
    return () => {
      unsubscribe();
      state.subscriberCount--;
      if (state.subscriberCount === 0) {
        cleanup();
      }
    };
  };

  return result;
}

/**
 * Creates a reflex that throttles the source reflex to emit at most once per specified duration.
 * The throttled reflex will emit:
 * 1. The initial value immediately
 * 2. The first value in a new throttle window if it arrives early in the window
 * 3. The last value received during the throttle window when the window ends
 *
 * Example usage:
 * ```typescript
 * const source = reflex({ initialValue: 0 });
 * const throttled = throttle(source, 1000); // Throttle to at most one value per second
 *
 * // If source emits rapidly: 0, 1, 2, 3, 4, 5
 * // throttled might emit: 0 (initial), 1 (first in window), 3 (last in window)
 * ```
 *
 * @param source The source reflex to throttle
 * @param duration The minimum time between emissions in milliseconds
 * @returns A Reflex that emits throttled values
 */
export function throttle<T>(source: Reflex<T>, duration: number): Reflex<T> {
  const result = reflex({
    initialValue: source.value,
  });

  const state: BackpressureState<T> = {
    buffer: [],
    isPaused: false,
    valueCount: 0,
    sourceUnsubscribe: null,
    subscriberCount: 0,
    timeoutId: null,
    isInitialized: false,
    pendingValue: null,
    lastEmitTime: 0,
  };

  const emitValue = (value: T) => {
    result.setValue(value);
    state.lastEmitTime = Date.now();
    state.pendingValue = null;
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
      state.timeoutId = null;
    }
  };

  const scheduleNextEmission = (value: T) => {
    state.pendingValue = value;
    if (!state.timeoutId) {
      const remainingTime = Math.max(0, duration - (Date.now() - state.lastEmitTime));
      state.timeoutId = setTimeout(() => {
        if (state.pendingValue !== null) {
          emitValue(state.pendingValue as T);
        }
      }, remainingTime);
    }
  };

  const cleanup = () => {
    if (state.timeoutId) {
      clearTimeout(state.timeoutId);
      state.timeoutId = null;
    }
    if (state.sourceUnsubscribe) {
      state.sourceUnsubscribe();
      state.sourceUnsubscribe = null;
    }
    state.pendingValue = null;
    state.isInitialized = false;
    state.lastEmitTime = 0;
  };

  const startThrottling = () => {
    if (!state.sourceUnsubscribe) {
      state.sourceUnsubscribe = source.subscribe((value) => {
        const now = Date.now();
        const timeSinceLastEmit = now - state.lastEmitTime;

        // Always emit the initial value
        if (!state.isInitialized) {
          state.isInitialized = true;
          emitValue(value);
          return;
        }

        // If outside throttle window, emit immediately
        if (timeSinceLastEmit >= duration) {
          emitValue(value);
          return;
        }

        // If this is the first value in a new throttle window and we're in the early phase,
        // emit immediately
        if (!state.timeoutId && !state.pendingValue && timeSinceLastEmit < duration / 3) {
          emitValue(value);
          return;
        }

        // Otherwise, schedule for later emission
        scheduleNextEmission(value);
      });
    }
  };

  // Override subscribe to manage throttling
  const originalSubscribe = result.subscribe.bind(result);
  result.subscribe = (subscriber) => {
    state.subscriberCount++;
    if (state.subscriberCount === 1) {
      startThrottling();
    }

    const unsubscribe = originalSubscribe(subscriber);
    return () => {
      unsubscribe();
      state.subscriberCount--;
      if (state.subscriberCount === 0) {
        cleanup();
      }
    };
  };

  return result;
}
