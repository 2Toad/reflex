import { Reflex, DeepReflexOptions, Subscriber, PropertyPath, PropertyValue } from "./types";
import { reflex } from "./reflex";

/**
 * Type guard to check if a value is an object
 */
function isObject(value: unknown): value is Record<string | number, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Creates a deeply reactive value that can track changes to nested properties.
 * Uses Proxy to intercept property access and modifications.
 *
 * @example
 * ```typescript
 * const user = deepReflex({
 *   initialValue: {
 *     name: 'John',
 *     profile: { age: 30 }
 *   }
 * });
 *
 * // Subscribe to changes
 * user.subscribe(value => console.log('User changed:', value));
 *
 * // Nested changes trigger updates
 * user.value.profile.age = 31; // Triggers update
 * ```
 */
export function deepReflex<T extends object>(options: DeepReflexOptions<T>): Reflex<T> {
  const { deep = true, onPropertyChange } = options;
  const baseReflex = reflex(options);
  let isUpdating = false;
  let isBatching = false;
  let batchedChanges: { path: PropertyPath; value: PropertyValue }[] = [];

  function createProxy<V extends object>(target: V, path: PropertyPath = []): V {
    if (!isObject(target)) {
      return target;
    }

    return new Proxy(target, {
      get(obj: V, prop: string | symbol): unknown {
        if (typeof prop === "symbol") {
          return Reflect.get(obj, prop);
        }

        const value = Reflect.get(obj, prop);
        if (deep && isObject(value)) {
          return createProxy(value, [...path, prop]);
        }
        return value;
      },

      set(obj: V, prop: string | symbol, value: unknown): boolean {
        if (typeof prop === "symbol") {
          return Reflect.set(obj, prop, value);
        }

        const oldValue = Reflect.get(obj, prop);
        if (oldValue === value) {
          return true;
        }

        // Create proxy for new object values
        const newValue = deep && isObject(value) ? createProxy(value, [...path, prop]) : value;

        const success = Reflect.set(obj, prop, newValue);
        if (!success) return false;

        if (!isUpdating) {
          isUpdating = true;
          try {
            // Track property changes during batch
            if (onPropertyChange) {
              const changePath = [...path, prop];
              if (isBatching) {
                batchedChanges.push({ path: changePath, value: newValue });
              } else {
                onPropertyChange(changePath, newValue);
              }
            }

            // Notify all subscribers about the root object change
            if (!isBatching) {
              baseReflex.setValue({ ...baseReflex.value });
            }
          } finally {
            isUpdating = false;
          }
        }

        return true;
      },

      deleteProperty(obj: V, prop: string | symbol): boolean {
        if (typeof prop === "symbol") {
          return Reflect.deleteProperty(obj, prop);
        }

        if (!Reflect.has(obj, prop)) {
          return true;
        }

        const success = Reflect.deleteProperty(obj, prop);
        if (!success) return false;

        if (!isUpdating) {
          isUpdating = true;
          try {
            // Track property deletion during batch
            if (onPropertyChange) {
              const changePath = [...path, prop];
              if (isBatching) {
                batchedChanges.push({ path: changePath, value: undefined });
              } else {
                onPropertyChange(changePath, undefined);
              }
            }

            // Notify all subscribers about the root object change
            if (!isBatching) {
              baseReflex.setValue({ ...baseReflex.value });
            }
          } finally {
            isUpdating = false;
          }
        }

        return true;
      },
    });
  }

  // Create initial proxy
  const proxy = createProxy(options.initialValue);

  return {
    get value() {
      return proxy;
    },

    setValue(newValue: T) {
      if (!isUpdating) {
        isUpdating = true;
        try {
          // Create a new proxy for the new value
          const newProxy = createProxy(newValue);
          // Update the base reactive, which will trigger subscribers
          baseReflex.setValue(newProxy);
        } finally {
          isUpdating = false;
        }
      }
    },

    subscribe(callback: Subscriber<T>) {
      return baseReflex.subscribe(callback);
    },

    batch<R>(updateFn: (value: T) => R): R {
      const wasBatching = isBatching;
      const previousChanges = batchedChanges;

      isBatching = true;
      batchedChanges = wasBatching ? previousChanges : [];

      try {
        const result = updateFn(proxy);

        if (!wasBatching) {
          // Only process changes if this is the outermost batch
          // Process all batched changes
          if (onPropertyChange) {
            batchedChanges.forEach((change) => {
              onPropertyChange(change.path, change.value);
            });
          }

          // Notify subscribers once
          baseReflex.setValue({ ...baseReflex.value });
        }

        return result;
      } finally {
        isBatching = wasBatching;
        batchedChanges = previousChanges;
      }
    },
  };
}
