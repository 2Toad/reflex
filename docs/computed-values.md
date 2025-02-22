# Computed Values

Computed values automatically update when their dependencies change. They provide a way to derive state from other reactive values.

## Basic Usage

```typescript
import { reflex, computed } '@2toad/reflex';

// Create base reactive values
const width = reflex({ initialValue: 5 });
const height = reflex({ initialValue: 10 });

// Create a computed value
const area = computed(
  [width, height],
  ([w, h]) => w * h
);

// Subscribe to the computed value
area.subscribe(value => console.log('Area:', value)); // Logs: Area: 50

// Update a dependency
width.setValue(6); // Logs: Area: 60
```

## Examples

### Form Validation

```typescript
const username = reflex({ initialValue: '' });
const password = reflex({ initialValue: '' });

const isValid = computed(
  [username, password],
  ([u, p]) => u.length >= 3 && p.length >= 8
);

isValid.subscribe(valid => {
  submitButton.disabled = !valid;
});
```

### Shopping Cart

```typescript
const items = reflex({ initialValue: [] });
const total = computed(
  [items],
  ([cartItems]) => cartItems.reduce((sum, item) => sum + item.price, 0)
);

total.subscribe(newTotal => {
  if (newTotal > 100) {
    showFreeShippingBanner();
  }
});
```

## Memory Management

The system automatically manages subscriptions and cleanup:

```typescript
// Computed values clean up when all subscribers unsubscribe
const computed = computed([dependency], ([value]) => value * 2);
const unsub = computed.subscribe(value => console.log(value));

// Later...
unsub(); // Automatically cleans up subscription to dependency
```

## Best Practices

1. **Cleanup Subscriptions**: Always call the unsubscribe function when you're done with a subscription.

2. **Dependencies**: Keep computed value dependencies as minimal as possible for better performance.

3. **Pure Functions**: The compute function should be pure - it should only depend on its input values and not have side effects.

4. **Error Handling**: Handle potential errors in your compute function to prevent error propagation.

5. **Type Safety**: Take advantage of TypeScript's type inference for better IDE support and catch errors early. 