# Batch Operations

When you need to make multiple changes to a reactive value but only want to trigger a single update, use the `batch` method.

## Basic Usage

```typescript
const user = reflex({
  initialValue: { name: 'John', score: 0, level: 1 }
});

// Without batching - triggers an update for each change
user.value.name = 'Jane';    // Triggers update
user.value.score = 100;      // Triggers update
user.value.level = 2;        // Triggers update

// With batching - triggers only one update after all changes
user.batch(value => {
  value.name = 'Jane';
  value.score = 100;
  value.level = 2;
}); // Single update at the end
```

## Nested Batch Operations

Batch operations can be nested, and only the outermost batch will trigger an update:

```typescript
const counter = reflex({ initialValue: 0 });

counter.batch(value => {
  counter.setValue(value + 1);      // No update yet
  
  counter.batch(v => {
    counter.setValue(v + 2);        // No update yet
    counter.setValue(v + 3);        // No update yet
  });
}); // Single update at the end of outermost batch
```

## Deep Reactive Batching

Batching is especially useful with deep reactive values, where it can prevent cascading updates from nested changes:

```typescript
const game = deepReflex({
  initialValue: {
    player: {
      name: 'Player1',
      stats: { health: 100, mana: 100 }
    },
    inventory: []
  }
});

// Batch multiple nested changes
game.batch(state => {
  // All these changes trigger only one update at the end
  state.player.name = 'Player2';
  state.player.stats.health = 90;
  state.player.stats.mana = 80;
  state.inventory.push({ id: 1, name: 'Potion' });
});
```

## Property Change Tracking in Batch

For deep reactive values, property changes are collected during the batch and reported together:

```typescript
const user = deepReflex({
  initialValue: {
    profile: { name: 'John', age: 30 }
  },
  onPropertyChange: (path, value) => {
    console.log(`Changed ${path.join('.')} to ${value}`);
  }
});

// Changes are collected and reported after the batch
user.batch(value => {
  value.profile.name = 'Jane';  // Change tracked but not reported yet
  value.profile.age = 31;       // Change tracked but not reported yet
}); // All changes reported here
```

## Return Values from Batch

The batch function can return a value, useful for computing results during updates:

```typescript
const cart = reflex({
  initialValue: { items: [], total: 0 }
});

const newTotal = cart.batch(state => {
  state.items.push({ id: 1, price: 10 });
  state.total += 10;
  return state.total; // Return the new total
});
```

## Best Practices

1. **Use for Multiple Changes**: When you need to update multiple properties at once, especially in deep reactive objects.

2. **Error Handling**: Batch operations handle errors gracefully - if an error occurs during the batch, previous changes are preserved.

3. **Computed Values**: Batch operations on computed values are read-only and will throw an error if you try to modify the value.

4. **Nested Batches**: While supported, prefer to keep batch operations at a single level for clarity.

5. **Avoid Async**: Batch operations should be synchronous. For async operations, collect all changes first, then apply them in a batch.

6. **Performance**: Use batching when making multiple related changes to prevent unnecessary intermediate updates. 