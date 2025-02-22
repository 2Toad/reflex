/**
 * Function to be called when a reactive value changes
 */
export type Subscriber<T> = (value: T) => void;

/**
 * Function returned by subscribe() that removes the subscription when called
 */
export type Unsubscribe = () => void;

/**
 * A Reflex value that can be subscribed to for changes
 */
export interface Reflex<T> {
  /** Get the current value */
  readonly value: T;

  /** Set a new value and notify subscribers */
  setValue(newValue: T): void;

  /** Subscribe to value changes */
  subscribe(callback: Subscriber<T>): Unsubscribe;

  /**
   * Batch multiple updates together and notify subscribers only once at the end.
   * Returns the result of the update function.
   */
  batch<R>(updateFn: (value: T) => R): R;
}

/**
 * Options for creating a Reflex value
 */
export interface ReflexOptions<T> {
  /** Initial value */
  initialValue: T;

  /** Optional equality function to determine if value has changed */
  equals?: (prev: T, next: T) => boolean;
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
