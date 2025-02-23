import { Reflex, DeepReflexOptions, Subscriber, PropertyPath, PropertyValue, ProxyState } from "./types";
import { reflex } from "./reflex";

/**
 * Type guard to check if a value is a plain object or array
 */
const isObjectOrArray = (value: unknown): value is Record<string | number, unknown> => {
  return typeof value === "object" && value !== null && !(value instanceof Date) && !(value instanceof RegExp);
};

/**
 * Creates a deeply reactive value that can track changes to nested properties.
 * Uses Proxy to intercept property access and modifications.
 *
 * @param options - Configuration options for the deep reflex value
 * @param options.initialValue - The initial object value to store
 * @param options.equals - Optional custom equality function to determine if value has changed
 * @param options.deep - Whether to make nested objects deeply reactive (default: true)
 * @param options.onPropertyChange - Optional callback for individual property changes
 * @returns A reflex object with methods to get/set values and subscribe to changes
 */
export function deepReflex<T extends object>(options: DeepReflexOptions<T>): Reflex<T> {
  const { deep = true, onPropertyChange } = options;
  const baseReflex = reflex(options);

  const state: ProxyState = {
    isUpdating: false,
    isBatching: false,
    batchedChanges: [],
    batchDepth: 0,
  };

  const notifyPropertyChange = (path: PropertyPath, value: PropertyValue): void => {
    if (onPropertyChange) {
      if (state.isBatching) {
        state.batchedChanges.push({ path, value });
      } else {
        onPropertyChange(path, value);
      }
    }
  };

  const updateValue = async (isAsync = false): Promise<void> => {
    if (!state.isBatching || state.batchDepth === 0) {
      if (isAsync) {
        await baseReflex.setValueAsync({ ...baseReflex.value });
      } else {
        baseReflex.setValue({ ...baseReflex.value });
      }
    }
  };

  const createArrayProxy = <V extends unknown[]>(target: V, path: PropertyPath = []): V => {
    return new Proxy(target, {
      get(obj: V, prop: string | symbol): unknown {
        const value = Reflect.get(obj, prop);

        if (typeof prop === "symbol" || !deep) {
          return value;
        }

        // Handle array methods that modify the array
        if (
          prop === "push" ||
          prop === "pop" ||
          prop === "shift" ||
          prop === "unshift" ||
          prop === "splice" ||
          prop === "sort" ||
          prop === "reverse"
        ) {
          return (...args: unknown[]) => {
            const result = Array.prototype[prop as keyof typeof Array.prototype].apply(obj, args);
            if (!state.isUpdating) {
              state.isUpdating = true;
              try {
                notifyPropertyChange(path, obj);
                updateValue();
              } finally {
                state.isUpdating = false;
              }
            }
            return result;
          };
        }

        return isObjectOrArray(value) ? createProxy(value, [...path, prop]) : value;
      },

      set(obj: V, prop: string | symbol, value: unknown): boolean {
        if (typeof prop === "symbol") {
          return Reflect.set(obj, prop, value);
        }

        const oldValue = Reflect.get(obj, prop);
        if (Object.is(oldValue, value)) {
          return true;
        }

        const newValue = deep && isObjectOrArray(value) ? createProxy(value, [...path, prop]) : value;

        if (!Reflect.set(obj, prop, newValue)) {
          return false;
        }

        if (!state.isUpdating) {
          state.isUpdating = true;
          try {
            notifyPropertyChange([...path, prop], newValue);
            updateValue();
          } finally {
            state.isUpdating = false;
          }
        }

        return true;
      },

      deleteProperty(obj: V, prop: string | symbol): boolean {
        if (typeof prop === "symbol" || !Reflect.has(obj, prop)) {
          return Reflect.deleteProperty(obj, prop);
        }

        if (!Reflect.deleteProperty(obj, prop)) {
          return false;
        }

        if (!state.isUpdating) {
          state.isUpdating = true;
          try {
            notifyPropertyChange([...path, prop], undefined);
            updateValue();
          } finally {
            state.isUpdating = false;
          }
        }

        return true;
      },
    });
  };

  const createProxy = <V extends object>(target: V, path: PropertyPath = []): V => {
    if (!isObjectOrArray(target)) {
      return target;
    }

    if (Array.isArray(target)) {
      return createArrayProxy(target, path) as unknown as V;
    }

    return new Proxy(target, {
      get(obj: V, prop: string | symbol): unknown {
        const value = Reflect.get(obj, prop);
        return typeof prop === "symbol" || !deep || !isObjectOrArray(value) ? value : createProxy(value, [...path, prop]);
      },

      set(obj: V, prop: string | symbol, value: unknown): boolean {
        if (typeof prop === "symbol") {
          return Reflect.set(obj, prop, value);
        }

        const oldValue = Reflect.get(obj, prop);
        if (Object.is(oldValue, value)) {
          return true;
        }

        const newValue = deep && isObjectOrArray(value) ? createProxy(value, [...path, prop]) : value;

        if (!Reflect.set(obj, prop, newValue)) {
          return false;
        }

        if (!state.isUpdating) {
          state.isUpdating = true;
          try {
            notifyPropertyChange([...path, prop], newValue);
            updateValue();
          } finally {
            state.isUpdating = false;
          }
        }

        return true;
      },

      deleteProperty(obj: V, prop: string | symbol): boolean {
        if (typeof prop === "symbol" || !Reflect.has(obj, prop)) {
          return Reflect.deleteProperty(obj, prop);
        }

        if (!Reflect.deleteProperty(obj, prop)) {
          return false;
        }

        if (!state.isUpdating) {
          state.isUpdating = true;
          try {
            notifyPropertyChange([...path, prop], undefined);
            updateValue();
          } finally {
            state.isUpdating = false;
          }
        }

        return true;
      },
    });
  };

  const proxy = createProxy(options.initialValue);

  const processBatchedChanges = async (isAsync = false): Promise<void> => {
    if (state.batchDepth === 0) {
      if (onPropertyChange) {
        state.batchedChanges.forEach(({ path, value }) => {
          onPropertyChange(path, value);
        });
      }
      await updateValue(isAsync);
    }
  };

  return {
    get value(): T {
      return proxy;
    },

    setValue(newValue: T): void {
      if (!state.isUpdating) {
        state.isUpdating = true;
        try {
          const newProxy = createProxy(newValue);
          baseReflex.setValue(newProxy);
        } finally {
          state.isUpdating = false;
        }
      }
    },

    async setValueAsync(newValue: T): Promise<void> {
      if (!state.isUpdating) {
        state.isUpdating = true;
        try {
          const newProxy = createProxy(newValue);
          await baseReflex.setValueAsync(newProxy);
        } finally {
          state.isUpdating = false;
        }
      }
    },

    subscribe(callback: Subscriber<T>): () => void {
      return baseReflex.subscribe(callback);
    },

    batch<R>(updateFn: (value: T) => R): R {
      state.batchDepth++;
      const wasBatching = state.isBatching;
      const previousChanges = state.batchedChanges;

      if (!wasBatching) {
        state.isBatching = true;
        state.batchedChanges = [];
      }

      try {
        const result = updateFn(proxy);
        state.batchDepth--;

        if (state.batchDepth === 0) {
          processBatchedChanges();
        }

        return result;
      } finally {
        if (!wasBatching) {
          state.isBatching = false;
          state.batchedChanges = previousChanges;
        }
        if (state.batchDepth === 0) {
          state.batchedChanges = [];
        }
      }
    },

    async batchAsync<R>(updateFn: (value: T) => Promise<R> | R): Promise<R> {
      state.batchDepth++;
      const wasBatching = state.isBatching;
      const previousChanges = state.batchedChanges;

      if (!wasBatching) {
        state.isBatching = true;
        state.batchedChanges = [];
      }

      try {
        const result = await Promise.resolve(updateFn(proxy));
        state.batchDepth--;

        if (state.batchDepth === 0) {
          await processBatchedChanges(true);
        }

        return result;
      } finally {
        if (!wasBatching) {
          state.isBatching = false;
          state.batchedChanges = previousChanges;
        }
        if (state.batchDepth === 0) {
          state.batchedChanges = [];
        }
      }
    },

    addMiddleware: baseReflex.addMiddleware,
    removeMiddleware: baseReflex.removeMiddleware,
  };
}
