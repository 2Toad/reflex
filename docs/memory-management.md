# Memory Management

Reflex provides automatic memory management and cleanup features to prevent memory leaks and ensure efficient resource usage.

## Automatic Cleanup

The system automatically manages subscriptions and cleanup:

```typescript
// Create a computed value with a dependency
const computed = computed([dependency], ([value]) => value * 2);

// Subscribe to the computed value
const unsub = computed.subscribe(value => console.log(value));

// Later...
unsub(); // Automatically cleans up subscription to dependency
```

## Custom Equality Functions

You can provide custom equality functions for more complex values to prevent unnecessary updates and memory allocation:

```typescript
const items = reflex({
  initialValue: [],
  equals: (prev, next) => 
    prev.length === next.length && 
    prev.every((item, i) => item.id === next[i].id)
});
```

## Best Practices

1. **Cleanup Subscriptions**: 
   - Always call the unsubscribe function when you're done with a subscription
   - Store unsubscribe functions and call them during cleanup/unmount in frameworks
   - Consider using framework-specific lifecycle hooks for cleanup

2. **Memory Usage**:
   - Avoid creating unnecessary subscriptions
   - Clean up subscriptions when they're no longer needed
   - Use appropriate data structures and avoid deep nesting when possible

3. **Deep Reactivity**:
   - Be mindful of deep reactive objects with many levels of nesting
   - Consider using regular `reflex` with manual nested value management for very large objects
   - Use `onPropertyChange` for fine-grained updates instead of subscribing to entire objects

4. **Framework Integration**:
   - Follow framework-specific best practices for cleanup
   - Use framework-provided utilities for subscription management when available
   - Consider creating framework-specific wrappers for common patterns

5. **Performance**:
   - Use custom equality functions for complex objects
   - Implement batching for multiple updates
   - Keep computed value dependencies minimal
   - Clean up resources promptly when no longer needed 