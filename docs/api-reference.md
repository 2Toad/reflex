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
  middleware?: Array<(value: T) => T | Promise<T>>;
  debug?: boolean;
  onError?: (error: Error) => T;
  notifyDuringBatch?: boolean;
}
```

- `initialValue`: The initial value of the reactive value
- `equals`: Custom equality function for value comparison (optional)
- `middleware`: Array of transform functions that process values before updates (optional)
- `debug`: Enable debug logging (optional)
- `onError`: Error handler function (optional)
- `notifyDuringBatch`: Whether to notify subscribers during batch operations (optional, defaults to false)

#### Returns

```typescript
interface Reflex<T> {
  readonly value: T;
  setValue(value: T): void;
  setValueAsync(value: T): Promise<void>;
  subscribe(subscriber: (value: T) => void): () => void;
  batch<R>(updateFn: (value: T) => R): R;
  batchAsync<R>(updateFn: (value: T) => Promise<R> | R): Promise<R>;
  addMiddleware(fn: Middleware<T>): void;
  removeMiddleware(fn: Middleware<T>): void;
}
```

#### Example

```typescript
const counter = reflex({
  initialValue: 0,
  equals: (a, b) => a === b,
  middleware: [
    value => Math.max(0, value),  // Ensures non-negative
    value => Math.round(value)    // Rounds to integer
  ],
  debug: true,
  onError: () => 0,
  notifyDuringBatch: false  // Default behavior
});

// Basic usage
counter.setValue(5);
console.log(counter.value); // 5

// Middleware transforms values
counter.setValue(-3);
console.log(counter.value); // 0 (due to Math.max middleware)
counter.setValue(3.7);
console.log(counter.value); // 4 (due to Math.round middleware)

// Batch operations
counter.batch(() => {
  counter.setValue(10);  // No notification yet
  counter.setValue(20);  // No notification yet
}); // Subscribers notified once with final value 20
```

### deepReflex<T extends object>(options: DeepReflexOptions<T>): Reflex<T>

Creates a deeply reactive value for objects and arrays.

#### Options

```typescript
interface DeepReflexOptions<T> extends ReflexOptions<T> {
  onPropertyChange?: (path: PropertyPath, value: unknown) => void;
}

type PropertyPath = Array<string | number>;
```

- Includes all options from `ReflexOptions`
- `onPropertyChange`: Callback for nested property changes, receives the path to the changed property and its new value

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

// Direct property modification
user.value.profile.name = 'Jane';
// Logs: "profile.name changed to: Jane"

// Batch property updates
user.batch(value => {
  value.profile.name = 'Alice';
  value.profile.age = 30;
}); 
// Logs after batch completes:
// "profile.name changed to: Alice"
// "profile.age changed to: 30"
```

### computed<TDeps extends any[], TResult>(
  dependencies: [...Reflex<TDeps>],
  compute: (values: TDeps) => TResult | Promise<TResult>,
  options?: ComputedOptions<TResult>
): Reflex<TResult>

Creates a computed value from other reactive values. The computed value updates automatically when any of its dependencies change.

#### Options

```typescript
interface ComputedOptions<T> {
  equals?: (prev: T, next: T) => boolean;
  debug?: boolean;
}
```

#### Example

```typescript
const value1 = reflex({ initialValue: 10 });
const value2 = reflex({ initialValue: 20 });

const sum = computed(
  [value1, value2],
  ([a, b]) => a + b
);

// Subscribe to receive updates
sum.subscribe(value => console.log('Sum changed:', value));
console.log(sum.value); // 30

value1.setValue(15);
console.log(sum.value); // 35
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

Combines multiple reactive values into an array. The combined value updates whenever any source value changes.

```typescript
const value1 = reflex({ initialValue: 'A' });
const value2 = reflex({ initialValue: 'B' });
const value3 = reflex({ initialValue: 'C' });

const combined = combine([value1, value2, value3]);
console.log(combined.value); // ['A', 'B', 'C']

value2.setValue('X');
console.log(combined.value); // ['A', 'X', 'C']
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

### PropertyPath

```typescript
type PropertyPath = Array<string | number>;
```

Used in deep reactive values to track the path to changed properties.

### Middleware<T>

```typescript
type Middleware<T> = (value: T) => T | Promise<T>;
```

Transform functions that process values before they are stored or emitted.

### Subscriber<T>

```typescript
type Subscriber<T> = (value: T) => void;
```

Callback function type for subscribing to value changes.

### Unsubscribe

```typescript
type Unsubscribe = () => void;
```

Function returned by `subscribe` that removes the subscription when called.

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

- See [Batch Operations](./batch-operations.md) for detailed batching patterns and best practices
- See [Advanced Usage Guide](./advanced-usage.md) for complex usage patterns
- Check out [Best Practices](./best-practices.md) for recommended patterns
- Review [Performance Tips](./performance.md) for optimization strategies 