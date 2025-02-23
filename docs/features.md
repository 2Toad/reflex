# Features Guide

This guide explores all the powerful features that make Reflex a robust state management solution.

## Core Features

### Reactive Values
The foundation of Reflex is the reactive value - a container that notifies subscribers when its contents change.

```typescript
const name = reflex({ initialValue: 'John' });
name.subscribe(value => console.log(`Name changed to: ${value}`));
name.setValue('Jane'); // Logs: Name changed to: Jane
```

### Deep Reactivity
Track changes in nested objects and arrays automatically:

```typescript
const user = deepReflex({
  initialValue: {
    profile: {
      name: 'John',
      settings: { theme: 'dark' }
    }
  }
});

// Direct property modification - automatically tracks nested changes
user.value.profile.settings.theme = 'light'; // Triggers update

// For multiple changes, use batch to trigger only one update
user.batch(value => {
  value.profile.name = 'Jane';
  value.profile.settings.theme = 'dark';
});
```

### Computed Values
Create values that automatically update based on other reactive values:

```typescript
const firstName = reflex({ initialValue: 'John' });
const lastName = reflex({ initialValue: 'Doe' });

const fullName = computed(
  [firstName, lastName],
  ([first, last]) => `${first} ${last}`
);

fullName.subscribe(name => console.log(name)); // Logs: John Doe
firstName.setValue('Jane'); // Logs: Jane Doe
```

### Operators
Transform and combine reactive values:

#### Map
```typescript
const numbers = reflex({ initialValue: 1 });
const doubled = numbers.map(n => n * 2);
```

#### Filter
```typescript
const numbers = reflex({ initialValue: 0 });
const positiveOnly = numbers.filter(n => n > 0);
```

#### Combine
```typescript
const combined = combine([value1, value2, value3]);
```

### Middleware
Transform values as they flow through your reactive system:

```typescript
const counter = reflex({
  initialValue: 0,
  middleware: [
    // Ensure value is non-negative
    value => Math.max(0, value),
    // Log all changes
    value => {
      console.log(`Counter changed to: ${value}`);
      return value;
    }
  ]
});
```

### Error Handling
Built-in protection against common issues:

```typescript
const safeValue = reflex({
  initialValue: 0,
  onError: (error) => {
    console.error('Error in reactive value:', error);
    return 0; // Fallback value
  }
});
```

### Debug Mode
Enable detailed logging for debugging:

```typescript
const debugValue = reflex({
  initialValue: 0,
  debug: true // Enables detailed logging
});
```

## Memory Management

Reflex automatically manages subscriptions to prevent memory leaks:

```typescript
const value = reflex({ initialValue: 0 });
const unsubscribe = value.subscribe(console.log);

// Later, when you're done:
unsubscribe();
// or
value.cleanup(); // Removes all subscriptions
```

## Framework Integration

### React
```typescript
function useReflex<T>(reflexValue: Reflex<T>): T {
  const [value, setValue] = useState(reflexValue.getValue());
  
  useEffect(() => {
    return reflexValue.subscribe(setValue);
  }, [reflexValue]);
  
  return value;
}
```

### Vue
```typescript
// In setup()
const value = ref(reflexValue.getValue());
onMounted(() => {
  const unsubscribe = reflexValue.subscribe(newValue => {
    value.value = newValue;
  });
  onUnmounted(unsubscribe);
});
```

### Angular
```typescript
@Component({
  template: '{{ value$ | async }}'
})
export class MyComponent {
  value$ = from(reflexValue);
}
```

## Best Practices

1. **Cleanup Subscriptions**: Always store and call unsubscribe functions when done.
2. **Use Computed Values**: Instead of manual synchronization, use computed values.
3. **Enable Debug Mode** during development to catch issues early.
4. **Use Middleware** for cross-cutting concerns like validation or logging.

## Next Steps

- Check out the [Advanced Usage Guide](./advanced-usage.md) for more complex scenarios
- See [Best Practices](./best-practices.md) for optimization tips
- Review the [API Reference](./api-reference.md) for detailed method documentation
- Explore our deep dive guides for specific features:
  - [Backpressure Handling](./backpressure.md)
  - [Batch Operations](./batch-operations.md)
  - [Computed Values](./computed-values.md)
  - [Deep Reactivity](./deep-reactivity.md)
  - [Operators](./operators.md) 