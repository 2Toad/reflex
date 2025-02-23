# API Reference

Complete documentation of Reflex's API, including all methods, options, and types.

## Core API

### reflex<T>(options: ReflexOptions<T>): Reflex<T>

Creates a new reactive value.

#### Options

```typescript
interface ReflexOptions<T> {
  initialValue: T;
  equals?: (prev: T, next: T) => boolean;
  middleware?: Array<(value: T, prev: T) => T | Promise<T>>;
  debug?: boolean;
  onError?: (error: Error) => T;
}
```

- `initialValue`: The initial value of the reactive value
- `equals`: Custom equality function for value comparison (optional)
- `middleware`: Array of transform functions (optional)
- `debug`: Enable debug logging (optional)
- `onError`: Error handler function (optional)

#### Returns

```typescript
interface Reflex<T> {
  getValue(): T;
  setValue(value: T | ((prev: T) => T)): void;
  subscribe(subscriber: (value: T) => void): () => void;
  cleanup(): void;
  map<R>(fn: (value: T) => R): Reflex<R>;
  filter(predicate: (value: T) => boolean): Reflex<T>;
  pipe(...operators: Array<(source: Reflex<any>) => Reflex<any>>): Reflex<any>;
}
```

#### Example

```typescript
const counter = reflex({
  initialValue: 0,
  equals: (a, b) => a === b,
  middleware: [
    value => Math.max(0, value),
    value => Math.round(value)
  ],
  debug: true,
  onError: () => 0
});
```

### deepReflex<T extends object>(options: DeepReflexOptions<T>): Reflex<T>

Creates a deeply reactive value for objects and arrays.

#### Options

```typescript
interface DeepReflexOptions<T> extends ReflexOptions<T> {
  onPropertyChange?: (path: string[], value: any) => void;
}
```

- Includes all options from `ReflexOptions`
- `onPropertyChange`: Callback for nested property changes

#### Example

```typescript
const user = deepReflex({
  initialValue: {
    profile: { name: 'John' }
  },
  onPropertyChange: (path, value) => {
    console.log(`${path.join('.')} changed to:`, value);
  }
});
```

### computed<TDeps extends any[], TResult>(
  dependencies: [...Reflex<TDeps>],
  compute: (values: TDeps) => TResult | Promise<TResult>,
  options?: ComputedOptions<TResult>
): Reflex<TResult>

Creates a computed value from other reactive values.

#### Options

```typescript
interface ComputedOptions<T> {
  equals?: (prev: T, next: T) => boolean;
  debug?: boolean;
}
```

#### Example

```typescript
const sum = computed(
  [value1, value2],
  ([a, b]) => a + b,
  { equals: (a, b) => Math.abs(a - b) < 0.001 }
);
```

## Operators

### map<T, R>(fn: (value: T) => R): Operator<T, R>

Transforms values using a mapping function.

```typescript
const doubled = numbers.map(n => n * 2);
```

### filter<T>(predicate: (value: T) => boolean): Operator<T, T>

Filters values based on a predicate.

```typescript
const positiveOnly = numbers.filter(n => n > 0);
```

### combine<T extends any[]>(sources: [...Reflex<T>]): Reflex<T>

Combines multiple reactive values into one.

```typescript
const combined = combine([value1, value2, value3]);
```

### buffer(options: BufferOptions): Operator<T, T[]>

Buffers values before emission.

```typescript
interface BufferOptions {
  size?: number;
  time?: number;
}

const buffered = value.buffer({
  size: 10,
  time: 1000
});
```

### sample(interval: number): Operator<T, T>

Samples values at regular intervals.

```typescript
const sampled = value.sample(1000); // One value per second
```

### throttle(time: number): Operator<T, T>

Limits the rate of emissions.

```typescript
const throttled = value.throttle(500);
```

## Utility Types

### Operator<TInput, TOutput>

```typescript
type Operator<TInput, TOutput> = (source: Reflex<TInput>) => Reflex<TOutput>;
```

### Middleware<T>

```typescript
type Middleware<T> = (value: T, prev: T) => T | Promise<T>;
```

### Subscriber<T>

```typescript
type Subscriber<T> = (value: T) => void;
```

### Unsubscribe

```typescript
type Unsubscribe = () => void;
```

## Static Methods

### Reflex.batch(fn: () => void): void

Batches multiple updates into a single notification.

```typescript
Reflex.batch(() => {
  value1.setValue(1);
  value2.setValue(2);
});
```

### Reflex.isReflex(value: any): boolean

Type guard to check if a value is a Reflex instance.

```typescript
if (Reflex.isReflex(value)) {
  // value is a Reflex instance
}
```

## Error Handling

### ReflexError

Base error class for Reflex-specific errors.

```typescript
class ReflexError extends Error {
  constructor(message: string) {
    super(`[Reflex] ${message}`);
  }
}
```

### Common Error Types

```typescript
class CircularDependencyError extends ReflexError {}
class InvalidValueError extends ReflexError {}
class DisposedError extends ReflexError {}
```

## Next Steps

- See [Advanced Usage Guide](./advanced-usage.md) for complex usage patterns
- Check out [Best Practices](./best-practices.md) for recommended patterns
- Review [Performance Tips](./performance.md) for optimization strategies 