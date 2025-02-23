# Computed Values

Computed values automatically update when their dependencies change. They provide a way to derive state from other reactive values, supporting both synchronous and asynchronous computations.

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

## Asynchronous Computed Values

```typescript
// Create an async computed value
const userProfile = computed(
  [userId],
  async ([id]) => {
    const data = await fetchUserProfile(id);
    return data;
  }
);

// Subscribe to async updates
userProfile.subscribe(profile => {
  console.log('Profile updated:', profile);
});

// Update triggers async recomputation
userId.setValue(123);
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

### API-based Validation (Async)

```typescript
const username = reflex({ initialValue: '' });

const isAvailable = computed(
  [username],
  async ([name]) => {
    if (name.length < 3) return false;
    const result = await checkUsernameAvailability(name);
    return result.available;
  }
);

isAvailable.subscribe(available => {
  usernameField.setCustomValidity(
    available ? '' : 'Username already taken'
  );
});
```

### Shopping Cart with Tax Calculation

```typescript
const items = reflex({ initialValue: [] });
const region = reflex({ initialValue: 'US' });

const total = computed(
  [items, region],
  async ([cartItems, userRegion]) => {
    const subtotal = cartItems.reduce((sum, item) => sum + item.price, 0);
    const taxRate = await fetchTaxRate(userRegion);
    return subtotal * (1 + taxRate);
  }
);

total.subscribe(finalTotal => {
  if (finalTotal > 100) {
    showFreeShippingBanner();
  }
});
```

## Memory Management

The system automatically manages subscriptions and cleanup for both sync and async computed values:

```typescript
// Computed values clean up when all subscribers unsubscribe
const computed = computed([dependency], async ([value]) => {
  const result = await processValue(value);
  return result * 2;
});

const unsub = computed.subscribe(value => console.log(value));

// Later...
unsub(); // Automatically cleans up subscription to dependency
```

## Batch Operations

Computed values support both sync and async batch operations:

```typescript
// Sync computed with sync batch
const doubled = computed([value], ([v]) => v * 2);
const result = doubled.batch(v => someCalculation(v));

// Async computed with async batch
const profile = computed([userId], async ([id]) => fetchProfile(id));
const result = await profile.batchAsync(async p => {
  const extra = await fetchExtraData(p.id);
  return { ...p, ...extra };
});
```

## Best Practices

1. **Choose the Right Type**: Use sync computed values for simple calculations and async ones for operations involving promises or API calls.

2. **Error Handling**: Both sync and async computed values handle errors gracefully and prevent error propagation.

3. **Dependencies**: Keep computed value dependencies minimal and consider the cost of recomputation, especially for async operations.

4. **Pure Functions**: The compute function should be pure - it should only depend on its input values and not have side effects.

5. **Type Safety**: Take advantage of TypeScript's type inference for better IDE support and catch errors early.

6. **Performance**: 
   - Sync computed values are more efficient for simple calculations
   - Async computed values automatically debounce rapid dependency changes
   - Use appropriate equality functions to prevent unnecessary recomputations

7. **Middleware**: Computed values don't support middleware - use the compute function for transformations. 