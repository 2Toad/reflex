# Operators

Reflex provides a set of essential operators for transforming and combining reactive values. These operators help you build complex reactive data flows with ease.

## Basic Operators

### map
Transforms values from a source reflex using a provided function.

```typescript
import { reflex, map } from '@2toad/reflex';

const numbers = reflex({ initialValue: 1 });
const doubled = map(numbers, x => x * 2);

console.log(doubled.value); // 2
numbers.setValue(5);
console.log(doubled.value); // 10
```

### filter
Filters values based on a predicate function.

```typescript
const numbers = reflex({ initialValue: 1 });
const evens = filter(numbers, x => x % 2 === 0);

console.log(evens.value); // undefined (1 is not even)
numbers.setValue(2);
console.log(evens.value); // 2
numbers.setValue(3);
console.log(evens.value); // 2 (keeps last valid value)
```

## Combination Operators

### merge
Combines multiple sources into a single reflex that emits whenever any source emits.

```typescript
const source1 = reflex({ initialValue: 'a' });
const source2 = reflex({ initialValue: 'b' });
const merged = merge([source1, source2]);

console.log(merged.value); // 'a' (initial value from first source)
source2.setValue('c');
console.log(merged.value); // 'c'
source1.setValue('d');
console.log(merged.value); // 'd'
```

### combine
Combines multiple sources into an array of their latest values.

```typescript
const count = reflex({ initialValue: 1 });
const text = reflex({ initialValue: 'hello' });
const combined = combine<[number, string]>([count, text]);

console.log(combined.value); // [1, 'hello']
count.setValue(2);
console.log(combined.value); // [2, 'hello']
text.setValue('world');
console.log(combined.value); // [2, 'world']
```

## Higher-order Stream Operators

### switchMap
Projects each value to an inner stream, cancelling previous projections when a new value arrives. Perfect for scenarios where only the latest value matters, like search autocomplete.

```typescript
const searchTerm = reflex({ initialValue: '' });
const searchResults = switchMap(searchTerm, async term => {
  const results = await fetchSearchResults(term);
  return results;
}); // Automatically cancels pending requests when new term arrives

// Also works with reflex values
const userId = reflex({ initialValue: 1 });
const userProfile = switchMap(userId, id => {
  const profile = reflex({ initialValue: null });
  fetchUserProfile(id).then(data => profile.setValue(data));
  return profile;
}); // Switches to new profile stream when userId changes
```

### mergeMap
Projects each value to an inner stream, maintaining all active projections concurrently. Useful for parallel operations that should all complete.

```typescript
const fileIds = reflex({ initialValue: ['1', '2', '3'] });
const downloads = mergeMap(fileIds, async ids => {
  const results = await Promise.all(
    ids.map(id => downloadFile(id))
  );
  return results;
}); // All downloads proceed in parallel

// Also works with reflex values
const userIds = reflex({ initialValue: [1, 2] });
const userActivities = mergeMap(userIds, ids => {
  const activities = reflex({ initialValue: [] });
  ids.forEach(id => {
    subscribeToUserActivity(id, data => {
      activities.setValue([...activities.value, data]);
    });
  });
  return activities;
}); // Tracks activities from all users simultaneously
```

### concatMap
Projects each value to an inner stream, processing projections in sequence. Important for operations that must happen in order. Uses an internal queue to ensure operations complete in sequence.

```typescript
const uploadQueue = reflex({ initialValue: [] });
const uploads = concatMap(uploadQueue, async files => {
  for (const file of files) {
    await uploadFile(file);
  }
  return 'Upload complete';
}); // Files upload one after another

// Also works with reflex values
const animations = reflex({ initialValue: ['fade', 'slide'] });
const sequence = concatMap(animations, type => {
  const progress = reflex({ initialValue: 0 });
  animate(type, value => progress.setValue(value));
  return progress;
}); // Animations play in sequence
```

#### Important Notes for Higher-order Operators

1. **Initial Values**: All higher-order operators process the initial value of the source reflex immediately. The projected value (whether Promise or Reflex) becomes the initial value of the resulting reflex.

2. **Timing Considerations**: 
   - `switchMap` cancels previous operations immediately when a new value arrives
   - `mergeMap` allows all operations to complete in parallel
   - `concatMap` queues operations and processes them in sequence, ensuring order is maintained

3. **Testing**: When testing these operators with async operations or reflex values:
   - Use appropriate timeouts to account for async processing
   - Consider using small delays (e.g., 50ms) for testing sequential operations
   - Remember that `concatMap` may need additional time to process its queue

4. **Memory Management**: 
   - `switchMap` automatically cleans up previous subscriptions
   - `mergeMap` maintains all active subscriptions until they complete
   - `concatMap` manages an internal queue and cleans up each subscription after completion

## Accumulation Operators

### scan
Accumulates values over time using a reducer function.

```typescript
const numbers = reflex({ initialValue: 1 });
const sum = scan(numbers, (acc, value) => acc + value, 0);

console.log(sum.value); // 1 (initial value is reduced)
numbers.setValue(2);
console.log(sum.value); // 3
numbers.setValue(3);
console.log(sum.value); // 6
```

## Time-based Operators

### debounce
Delays emissions until a specified time has passed without new values.

```typescript
const input = reflex({ initialValue: '' });
const debouncedInput = debounce(input, 300);

// Fast typing won't trigger immediate updates
input.setValue('h');
input.setValue('he');
input.setValue('hel');
input.setValue('hell');
input.setValue('hello');

// After 300ms of no changes, debouncedInput will update to 'hello'
```

## Error Handling Operators

### catchError
Catches errors in a reflex stream and provides graceful error recovery through fallback values or alternative reflex streams. This operator is essential for building robust reactive applications that can handle failures gracefully.

#### Key Features
- Handles both synchronous and asynchronous errors
- Supports both static fallback values and dynamic reflex fallbacks
- Automatically cleans up fallback subscriptions when the source recovers
- Integrates with the error state from map and other operators
- Resumes normal operation when the source starts emitting valid values again

#### Basic Usage

```typescript
import { reflex, map, catchError } from '@2toad/reflex';

// Basic error recovery with a static value
const source = reflex({ initialValue: 1 });
const errorProne = map(source, (x) => {
  if (x < 0) throw new Error('Value cannot be negative');
  return x * 2;
});

const recovered = catchError(errorProne, () => 0);
console.log(recovered.value); // 2
source.setValue(-1); // Triggers error
console.log(recovered.value); // 0 (fallback value)
source.setValue(2); // Recovers
console.log(recovered.value); // 4 (back to normal operation)
```

#### Real-World Examples

1. **API Error Handling with Cached Data**
```typescript
// Maintain a cache of the last valid data
const cache = reflex({ initialValue: [] });
const apiData = map(source, async (query) => {
  const response = await fetch(`/api/search?q=${query}`);
  if (!response.ok) throw new Error('API Error');
  const data = await response.json();
  cache.setValue(data); // Update cache on success
  return data;
});

// Fall back to cached data on API errors
const resilientData = catchError(apiData, () => cache);
```

2. **Form Validation with User Feedback**
```typescript
const userInput = reflex({ initialValue: '' });
const validatedInput = map(userInput, (value) => {
  if (value.length < 3) throw new Error('Input too short');
  if (!/^[a-zA-Z]+$/.test(value)) throw new Error('Only letters allowed');
  return value;
});

// Show validation message on error
const errorMessages = reflex({ initialValue: 'Please enter a value' });
const safeInput = catchError(validatedInput, (error) => {
  errorMessages.setValue(error.message);
  return ''; // Clear invalid input
});
```

3. **Real-time Data with Offline Support**
```typescript
const websocketData = reflex({ initialValue: null });
const localData = reflex({ initialValue: null });

// Try websocket first, fall back to local data
const offlineCapableData = catchError(websocketData, () => {
  console.log('Websocket failed, using local data');
  return localData;
});

// When back online, automatically switches back to websocket data
websocketData.subscribe((data) => {
  localData.setValue(data); // Keep local copy updated
});
```

4. **Progressive Enhancement**
```typescript
const modernFeature = reflex({ initialValue: null });
const legacyFeature = reflex({ initialValue: null });

const enhancedFeature = map(modernFeature, (value) => {
  if (!window.modernAPISupported) {
    throw new Error('Modern API not supported');
  }
  return value;
});

// Automatically falls back to legacy implementation
const feature = catchError(enhancedFeature, () => legacyFeature);
```

#### Best Practices

1. **Error Specificity**: Provide specific error handlers for different types of errors:
```typescript
const resilient = catchError(source, (error) => {
  if (error instanceof NetworkError) return offlineData;
  if (error instanceof ValidationError) return defaultValue;
  return errorLogger.logAndReturnFallback(error);
});
```

2. **Stateful Recovery**: Use reflex fallbacks when you need to maintain state during error conditions:
```typescript
const fallbackState = reflex({ initialValue: { status: 'error', retryCount: 0 } });
const recovered = catchError(source, () => {
  fallbackState.setValue({
    ...fallbackState.value,
    retryCount: fallbackState.value.retryCount + 1
  });
  return fallbackState;
});
```

3. **Cleanup and Recovery**: The operator automatically handles cleanup when switching between normal and error states:
```typescript
// No manual cleanup needed
const source = reflex({ initialValue: 'initial' });
const fallback = reflex({ initialValue: 'fallback' });
const recovered = catchError(source, () => fallback);

// Automatically switches and cleans up subscriptions
source.setValue('normal'); // Uses source value
source.setValue(null); // Switches to fallback
source.setValue('recovered'); // Switches back to source
```

#### Type Safety
The catchError operator properly handles type unions between the source and fallback values:
```typescript
const source: Reflex<number> = reflex({ initialValue: 1 });
const fallback: Reflex<string> = reflex({ initialValue: 'error' });

// Type is Reflex<number | string>
const recovered = catchError(source, () => fallback);
```

## Best Practices

1. **Chain Operators**: You can chain multiple operators together to create complex transformations:
```typescript
const numbers = reflex({ initialValue: 1 });
const evenDoubles = map(
  filter(numbers, x => x % 2 === 0),
  x => x * 2
);
```

2. **Memory Management**: Remember that operators create new reflex instances. Unsubscribe when they're no longer needed:
```typescript
const numbers = reflex({ initialValue: 1 });
const doubled = map(numbers, x => x * 2);
const unsubscribe = doubled.subscribe(console.log);

// Later when done
unsubscribe();
```

3. **Type Safety**: Use TypeScript generics to ensure type safety across operator chains:
```typescript
const source = reflex({ initialValue: 1 });
const result = map<number, string>(source, x => x.toString());
```

4. **Performance**: Consider using `debounce` for high-frequency updates:
```typescript
const mousePosition = reflex({ initialValue: { x: 0, y: 0 } });
const smoothPosition = debounce(mousePosition, 16); // ~60fps
```

5. **Choosing the Right Higher-order Operator**:
   - Use `switchMap` when you only care about the latest value (e.g., search, latest user data)
   - Use `mergeMap` when all operations should complete (e.g., parallel uploads)
   - Use `concatMap` when order matters (e.g., sequential animations) 