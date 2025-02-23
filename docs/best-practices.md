# Best Practices

A guide to writing clean, efficient, and maintainable code with Reflex.

## State Management

### 1. Keep State Minimal

Only make values reactive when they need to be. Not everything needs to be reactive.

✅ Good:
```typescript
// Only the active filter is reactive
const activeFilter = reflex({ initialValue: 'all' });
const filters = ['all', 'active', 'completed']; // Static value
```

❌ Bad:
```typescript
// Don't make static values reactive
const filters = reflex({ 
  initialValue: ['all', 'active', 'completed']
});
```

### 2. Use Computed Values for Derived State

Don't manually sync dependent values. Use computed values instead.

✅ Good:
```typescript
const firstName = reflex({ initialValue: 'John' });
const lastName = reflex({ initialValue: 'Doe' });
const fullName = computed(
  [firstName, lastName],
  ([first, last]) => `${first} ${last}`
);
```

❌ Bad:
```typescript
const firstName = reflex({ initialValue: 'John' });
const lastName = reflex({ initialValue: 'Doe' });
const fullName = reflex({ initialValue: 'John Doe' });

// Manual syncing is error-prone
firstName.subscribe(first => {
  fullName.setValue(`${first} ${lastName.getValue()}`);
});
lastName.subscribe(last => {
  fullName.setValue(`${firstName.getValue()} ${last}`);
});
```

## Memory Management

### 3. Always Clean Up Subscriptions

Prevent memory leaks by cleaning up subscriptions when they're no longer needed.

✅ Good:
```typescript
class Component {
  private subscriptions: Array<() => void> = [];

  init() {
    this.subscriptions.push(
      value.subscribe(this.handleValue)
    );
  }

  destroy() {
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions = [];
  }
}
```

❌ Bad:
```typescript
class Component {
  init() {
    // Subscription is never cleaned up
    value.subscribe(this.handleValue);
  }
}
```

### 4. Use Cleanup Methods

Take advantage of Reflex's cleanup methods for automatic memory management.

✅ Good:
```typescript
const value = reflex({ initialValue: 0 });
// Later when done
value.cleanup(); // Removes all subscriptions
```

## Performance

### 5. Use Custom Equality Functions

Prevent unnecessary updates with custom equality checks when needed.

✅ Good:
```typescript
const position = reflex({
  initialValue: { x: 0, y: 0 },
  equals: (prev, next) => 
    Math.abs(prev.x - next.x) < 0.001 && 
    Math.abs(prev.y - next.y) < 0.001
});
```

### 6. Batch Updates

Use batching for multiple related updates.

✅ Good:
```typescript
Reflex.batch(() => {
  position.setValue({ x: 10, y: 20 });
  scale.setValue(2);
  rotation.setValue(45);
});
```

❌ Bad:
```typescript
// Each setValue triggers updates separately
position.setValue({ x: 10, y: 20 });
scale.setValue(2);
rotation.setValue(45);
```

## Error Handling

### 7. Use Error Handlers

Handle errors gracefully with error handlers.

✅ Good:
```typescript
const value = reflex({
  initialValue: 0,
  onError: (error) => {
    console.error('Value error:', error);
    return 0; // Fallback value
  }
});
```

### 8. Validate in Middleware

Use middleware for validation.

✅ Good:
```typescript
const age = reflex({
  initialValue: 0,
  middleware: [
    value => {
      if (value < 0) throw new Error('Age cannot be negative');
      if (value > 150) throw new Error('Invalid age');
      return value;
    }
  ]
});
```

## Code Organization

### 9. Group Related State

Keep related state together and organized.

✅ Good:
```typescript
class UserState {
  readonly profile = deepReflex({
    initialValue: {
      name: '',
      email: '',
      preferences: {}
    }
  });

  readonly isLoggedIn = computed(
    [this.profile],
    ([profile]) => Boolean(profile.email)
  );
}
```

### 10. Use TypeScript

Take advantage of TypeScript for better type safety.

✅ Good:
```typescript
interface User {
  id: string;
  name: string;
  email: string;
}

const user = reflex<User>({
  initialValue: {
    id: '',
    name: '',
    email: ''
  }
});
```

## Debugging

### 11. Use Debug Mode

Enable debug mode during development.

✅ Good:
```typescript
const debugValue = reflex({
  initialValue: 0,
  debug: process.env.NODE_ENV === 'development'
});
```

### 12. Add Logging Middleware

Use middleware for debugging when needed.

✅ Good:
```typescript
const value = reflex({
  initialValue: 0,
  middleware: [
    value => {
      console.log('Value changing to:', value);
      return value;
    }
  ]
});
```

## Framework Integration

### 13. Create Framework-Specific Wrappers

Create clean integrations with your framework.

✅ Good:
```typescript
// React Hook
function useReflex<T>(value: Reflex<T>): T {
  const [state, setState] = useState(value.getValue());
  
  useEffect(() => {
    return value.subscribe(setState);
  }, [value]);
  
  return state;
}
```

### 14. Keep Framework Logic Separate

Separate framework-specific code from your state logic.

✅ Good:
```typescript
// State logic
class TodoState {
  items = reflex({ initialValue: [] });
  addItem(item) { /* ... */ }
  removeItem(id) { /* ... */ }
}

// React component
function TodoList() {
  const todos = useReflex(todoState.items);
  return (
    <ul>
      {todos.map(todo => (
        <TodoItem key={todo.id} todo={todo} />
      ))}
    </ul>
  );
}
```

## Testing

### 15. Test State Changes

Write tests for your state logic.

✅ Good:
```typescript
describe('TodoState', () => {
  it('should add items', () => {
    const state = new TodoState();
    state.addItem({ id: 1, text: 'Test' });
    expect(state.items.getValue()).toHaveLength(1);
  });
});
```

## Next Steps

- Review the [API Reference](./api-reference.md) for detailed method documentation
- See [Advanced Usage Guide](./advanced-usage.md) for complex patterns
- Check out [Performance Tips](./performance.md) for more optimization strategies 