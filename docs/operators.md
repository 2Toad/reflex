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