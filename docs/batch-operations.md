# Batch Operations

When you need to make multiple changes to a reactive value but only want to trigger a single update, use the `batch` or `batchAsync` methods.

## Basic Usage

```typescript
const user = reflex({
  initialValue: { name: 'John', score: 0, level: 1 }
});

// Without batching - triggers an update for each change
user.setValue({ ...user.value, name: 'Jane' });     // Triggers update
user.setValue({ ...user.value, score: 100 });       // Triggers update
user.setValue({ ...user.value, level: 2 });         // Triggers update

// With batching - triggers only one update after all changes
user.batch(value => {
  value.name = 'Jane';
  value.score = 100;
  value.level = 2;
}); // Single update at the end
```

## Asynchronous Batching

For operations that involve async work, use `batchAsync`:

```typescript
const user = reflex({
  initialValue: { name: 'John', score: 0, level: 1 }
});

// Async batch operation
await user.batchAsync(async value => {
  const newScore = await fetchScoreFromServer();
  const newLevel = await calculateNewLevel(newScore);
  
  value.score = newScore;
  value.level = newLevel;
}); // Single update after async work completes
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

// Mixing sync and async batches
await counter.batchAsync(async value => {
  counter.setValue(value + 1);      // No update yet
  
  await counter.batchAsync(async v => {
    const result = await someAsyncOperation();
    counter.setValue(v + result);   // No update yet
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

// Sync batch for simple updates
game.batch(state => {
  state.player.name = 'Player2';
  state.player.stats.health = 90;
  state.player.stats.mana = 80;
  state.inventory.push({ id: 1, name: 'Potion' });
});

// Async batch for complex operations
await game.batchAsync(async state => {
  const playerStats = await fetchPlayerStats();
  const inventory = await fetchInventory();
  
  state.player.stats = playerStats;
  state.inventory = inventory;
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

// Async property changes
await user.batchAsync(async value => {
  const profile = await fetchProfile();
  value.profile = profile;      // Change tracked but not reported yet
}); // All changes reported after async work completes
```

## Return Values from Batch

Both sync and async batch operations can return values:

```typescript
const cart = reflex({
  initialValue: { items: [], total: 0 }
});

// Sync batch with return value
const newTotal = cart.batch(state => {
  state.items.push({ id: 1, price: 10 });
  state.total += 10;
  return state.total;
});

// Async batch with return value
const finalTotal = await cart.batchAsync(async state => {
  const newItems = await fetchCartItems();
  state.items = newItems;
  state.total = newItems.reduce((sum, item) => sum + item.price, 0);
  return state.total;
});
```

## Best Practices

1. **Choose the Right Method**: Use `batch` for synchronous operations and `batchAsync` for operations involving promises or async work.

2. **Error Handling**: Both sync and async batch operations handle errors gracefully - if an error occurs, previous changes are preserved.

3. **Computed Values**: Batch operations on computed values are read-only. Sync computed values will throw on `batch`, async ones support `batchAsync`.

4. **Nested Batches**: While supported, prefer to keep batch operations at a single level for clarity.

5. **Middleware**: Sync operations skip async middleware with a warning. Use `batchAsync` if you need async middleware support.

6. **Performance**: Use batching to prevent unnecessary intermediate updates, especially with deep reactive values.

7. **Type Safety**: Take advantage of TypeScript's type inference to catch errors early. 