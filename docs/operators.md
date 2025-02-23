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