# Advanced Usage Guide

This guide covers advanced patterns and techniques for getting the most out of Reflex.

## Advanced State Management

### State Machines
Implement state machines using Reflex:

```typescript
type State = 'idle' | 'loading' | 'success' | 'error';

const machine = reflex<State>({
  initialValue: 'idle',
  middleware: [
    (newState, currentState) => {
      // Validate state transitions
      const validTransitions = {
        idle: ['loading'],
        loading: ['success', 'error'],
        success: ['idle'],
        error: ['idle']
      };
      
      if (!validTransitions[currentState].includes(newState)) {
        throw new Error(`Invalid transition from ${currentState} to ${newState}`);
      }
      
      return newState;
    }
  ]
});
```

### Complex Computations
Handle complex dependencies and async computations:

```typescript
// Multiple dependencies
const fullAddress = computed(
  [street, city, state, zip],
  ([s, c, st, z]) => `${s}, ${c}, ${st} ${z}`
);

// Async computation with error handling
const userProfile = computed(
  [userId],
  async ([id]) => {
    try {
      const response = await fetch(`/api/users/${id}`);
      return await response.json();
    } catch (error) {
      console.error('Failed to fetch user:', error);
      return null;
    }
  }
);
```

## Advanced Flow Control

### Backpressure Management
Handle high-frequency updates:

```typescript
// Buffer values and emit in batches
const bufferedValues = value.buffer({
  size: 10, // Collect 10 values
  time: 1000 // Or emit every second
});

// Sample values at regular intervals
const sampledValues = value.sample(1000); // Take one value per second

// Throttle rapid updates
const throttledValues = value.throttle(500); // Max one update per 500ms
```

### Custom Operators
Create your own operators:

```typescript
function distinctUntilChanged<T>(equals = (a: T, b: T) => a === b) {
  return (source: Reflex<T>): Reflex<T> => {
    let lastValue: T | undefined;
    
    return source.filter(value => {
      if (lastValue === undefined || !equals(value, lastValue)) {
        lastValue = value;
        return true;
      }
      return false;
    });
  };
}

const uniqueValues = myReflex.pipe(distinctUntilChanged());
```

## Advanced Patterns

### Dependency Injection
Manage services and dependencies:

```typescript
class UserService {
  private currentUser = reflex<User | null>({ initialValue: null });
  
  async login(credentials: Credentials) {
    this.currentUser.setValue(await api.login(credentials));
  }
  
  logout() {
    this.currentUser.setValue(null);
  }
}

// Inject and use in components
const userService = new UserService();
const isLoggedIn = computed(
  [userService.currentUser],
  ([user]) => user !== null
);
```

### Middleware Chains
Complex value transformations:

```typescript
const value = reflex({
  initialValue: 0,
  middleware: [
    // Validation
    value => {
      if (typeof value !== 'number') throw new Error('Must be a number');
      return value;
    },
    // Transformation
    value => Math.round(value),
    // Bounds checking
    value => Math.min(Math.max(value, 0), 100),
    // Logging
    value => {
      console.log(`Value updated to: ${value}`);
      return value;
    }
  ]
});
```

### Batch Updates
Optimize performance with batch updates:

```typescript
function batchUpdate() {
  // Start batch
  Reflex.batch(() => {
    value1.setValue(1);
    value2.setValue(2);
    value3.setValue(3);
  });
  // All subscribers notified once at the end
}
```

## Testing

### Unit Testing
Test reactive values and computations:

```typescript
describe('Counter', () => {
  let counter: Reflex<number>;
  
  beforeEach(() => {
    counter = reflex({ initialValue: 0 });
  });
  
  it('should increment', () => {
    counter.setValue(prev => prev + 1);
    expect(counter.getValue()).toBe(1);
  });
  
  it('should notify subscribers', (done) => {
    counter.subscribe(value => {
      expect(value).toBe(1);
      done();
    });
    counter.setValue(1);
  });
});
```

### Integration Testing
Test complex interactions:

```typescript
describe('UserProfile', () => {
  it('should update full name when first or last name changes', () => {
    const firstName = reflex({ initialValue: 'John' });
    const lastName = reflex({ initialValue: 'Doe' });
    const fullName = computed(
      [firstName, lastName],
      ([first, last]) => `${first} ${last}`
    );
    
    let lastValue: string | undefined;
    fullName.subscribe(value => { lastValue = value; });
    
    firstName.setValue('Jane');
    expect(lastValue).toBe('Jane Doe');
  });
});
```

## Performance Optimization

### Memory Management
Proper cleanup in complex scenarios:

```typescript
class Component {
  private subscriptions: Array<() => void> = [];
  
  init() {
    this.subscriptions.push(
      value1.subscribe(this.handler1),
      value2.subscribe(this.handler2)
    );
  }
  
  destroy() {
    this.subscriptions.forEach(unsubscribe => unsubscribe());
    this.subscriptions = [];
  }
}
```

### Computation Optimization
Minimize unnecessary updates:

```typescript
const optimizedComputation = computed(
  [value1, value2],
  ([v1, v2]) => expensiveCalculation(v1, v2),
  {
    equals: (prev, next) => {
      // Custom equality check to prevent unnecessary updates
      return Math.abs(prev - next) < 0.001;
    }
  }
);
```

## Next Steps

- Review the [API Reference](./api-reference.md) for detailed method documentation
- Check out [Performance Tips](./performance.md) for more optimization strategies
- See [Best Practices](./best-practices.md) for recommended patterns 