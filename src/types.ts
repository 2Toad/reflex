/**
 * Function to be called when a reactive value changes
 */
export type Subscriber<T> = (value: T) => unknown;

/**
 * Function returned by subscribe() that removes the subscription when called
 */
export type Unsubscribe = () => void;

/**
 * Middleware function that can transform values before they are set
 */
export type Middleware<T> = (value: T) => T | Promise<T>;

/**
 * Function that computes a result from dependency values in a computed reflex
 */
export type ComputeFunction<TDeps extends Reflex<unknown>[], TResult> = (values: DependencyValues<TDeps>) => TResult | Promise<TResult>;

/**
 * Internal state for computed reflex values
 */
export interface ComputedState<TResult> {
  isComputing: boolean;
  isAsync: boolean;
  currentComputed: TResult;
  computePromise: Promise<void> | null;
  cleanups: Unsubscribe[];
  subscriptionCount: number;
}

/**
 * Error messages for computed reflex operations
 */
export const COMPUTED_ERRORS = {
  SET_VALUE: "Cannot set the value of a computed reactive",
  ADD_MIDDLEWARE: "Cannot add middleware to a computed reactive",
  REMOVE_MIDDLEWARE: "Cannot remove middleware from a computed reactive",
  SYNC_BATCH: "Cannot use sync batch on async computed value",
} as const;

/**
 * Options for creating a Reflex value
 */
export interface ReflexOptions<T> {
  /** Initial value */
  initialValue: T;

  /** Optional equality function to determine if value has changed */
  equals?: (prev: T, next: T) => boolean;

  /** Enable debug logging */
  debug?: boolean;

  /** Array of middleware functions to transform values */
  middleware?: Middleware<T>[];

  /** Whether to notify subscribers during batch operations */
  notifyDuringBatch?: boolean;
}

/**
 * A Reflex value that can be subscribed to for changes
 */
export interface Reflex<T> {
  /** Get the current value */
  readonly value: T;

  /** Set a new value and notify subscribers */
  setValue(newValue: T): void;

  /** Set a new value asynchronously and notify subscribers */
  setValueAsync(newValue: T): Promise<void>;

  /** Subscribe to value changes */
  subscribe(callback: Subscriber<T>): Unsubscribe;

  /**
   * Batch multiple updates together and notify subscribers only once at the end.
   * Returns the result of the update function.
   */
  batch<R>(updateFn: (value: T) => R): R;

  /**
   * Batch multiple async updates together and notify subscribers only once at the end.
   * Returns a promise that resolves to the result of the update function.
   */
  batchAsync<R>(updateFn: (value: T) => Promise<R> | R): Promise<R>;

  /** Add a middleware function */
  addMiddleware(fn: Middleware<T>): void;

  /** Remove a middleware function */
  removeMiddleware(fn: Middleware<T>): void;
}

/**
 * Type for property path segments
 */
export type PropertyPath = (string | number)[];

/**
 * Type for property change value
 */
export type PropertyValue = unknown;

/**
 * Options for creating a deep Reflex value
 */
export interface DeepReflexOptions<T extends object> extends ReflexOptions<T> {
  /** Whether to make nested objects deeply reactive (default: true) */
  deep?: boolean;

  /** Custom handler for specific property changes */
  onPropertyChange?: (path: PropertyPath, value: PropertyValue) => void;
}

/**
 * Type for batched changes
 */
export interface BatchedChange {
  path: PropertyPath;
  value: PropertyValue;
}

/**
 * Internal state for deep Reflex values
 */
export interface ProxyState {
  isUpdating: boolean;
  isBatching: boolean;
  batchedChanges: BatchedChange[];
  batchDepth: number;
}

/**
 * Extracts the underlying value types from an array of reflex values.
 * Used in computed values to transform an array of Reflex<T> into a tuple of their contained types.
 */
export type DependencyValues<T extends Reflex<unknown>[]> = {
  [K in keyof T]: T[K] extends Reflex<infer V> ? V : never;
};

/**
 * A Reflex with an optional error state
 */
export interface ReflexWithError<T> extends Reflex<T> {
  _errorState?: Reflex<Error | null>;
}

/**
 * Represents strategies for handling backpressure situations
 */
export enum BackpressureStrategy {
  /** Discards new values when the system is overwhelmed */
  Drop = "drop",
  /** Stores values up to a limit for later processing */
  Buffer = "buffer",
  /** Maintains a fixed-size window of most recent values */
  Sliding = "sliding",
  /** Throws an error when capacity is exceeded */
  Error = "error",
}

/**
 * Options for configuring backpressure behavior
 */
export interface BackpressureOptions {
  /** The strategy to use for handling backpressure */
  strategy: BackpressureStrategy;
  /** The buffer size when using buffer or sliding strategies */
  bufferSize?: number;
  /** Custom predicate to determine when to apply backpressure */
  shouldApplyBackpressure?: () => boolean;
}

/**
 * Interface for objects that implement backpressure control methods.
 * This interface provides methods to control the flow of data by pausing/resuming emission
 * and monitoring buffer state.
 */
export interface BackpressureCapable {
  /** Request the producer to pause emission */
  pause: () => void;
  /** Request the producer to resume emission */
  resume: () => void;
  /** Check if the producer is currently paused */
  isPaused: () => boolean;
  /** Get the current buffer size (if applicable) */
  getBufferSize: () => number;
}

/**
 * Internal state for backpressure handling
 */
export interface BackpressureState<T> {
  buffer: T[];
  isPaused: boolean;
  valueCount: number;
  sourceUnsubscribe: (() => void) | null;
  subscriberCount: number;
  timeoutId?: NodeJS.Timeout | null;
  isInitialized?: boolean;
  pendingValue?: T | null;
  lastEmitTime: number;
}

/**
 * Type for functions that project values from a source to a new Reflex or Promise
 */
export type ProjectFunction<T, R> = (value: T) => Reflex<R> | Promise<R>;
