# Deep Reactivity

Deep Reflex values automatically track changes to nested properties in objects and arrays.

## Basic Usage

```typescript
import { deepReflex } '@2toad/reflex';

// Create a deeply reactive object
const user = deepReflex({
  initialValue: {
    name: 'John',
    profile: {
      age: 30,
      settings: { theme: 'light' }
    }
  }
});

// Subscribe to changes
user.subscribe(value => console.log('User changed:', value));

// Nested changes trigger updates
user.value.profile.age = 31; // Triggers update
user.value.profile.settings.theme = 'dark'; // Triggers update

// Array mutations are tracked
const list = deepReflex({
  initialValue: { items: [1, 2, 3] }
});
list.value.items.push(4); // Triggers update
```

## Property Change Tracking

Track specific property changes with the `onPropertyChange` callback. The callback receives a path array (which can include array indices) and the new value:

```typescript
const user = deepReflex({
  initialValue: {
    name: 'John',
    profile: { age: 30 },
    scores: [10, 20, 30]
  },
  onPropertyChange: (path, value) => {
    console.log(`Property changed: ${path.join('.')} = ${value}`);
  }
});

user.value.profile.age = 31;     // Logs: "Property changed: profile.age = 31"
user.value.scores[0] = 15;       // Logs: "Property changed: scores.0 = 15"
delete user.value.profile.age;   // Logs: "Property changed: profile.age = undefined"
```

## Options

```typescript
interface DeepReflexOptions<T extends object> extends ReflexOptions<T> {
  /** Whether to make nested objects deeply reactive (default: true) */
  deep?: boolean;

  /** Custom handler for specific property changes */
  onPropertyChange?: (path: PropertyPath, value: PropertyValue) => void;
}

/** Path segments can be either strings (for object properties) or numbers (for array indices) */
type PropertyPath = (string | number)[];

/** Type for property change values */
type PropertyValue = unknown;
```

## Best Practices

1. **Memory Management**: Deep reactivity creates proxies for all nested objects. For very large objects with many levels of nesting, consider using regular `reflex` with manual nested value management.

2. **Circular References**: While supported, be cautious with circular references as they can lead to infinite loops in your application logic.

3. **Performance**: 
   - Use `onPropertyChange` for fine-grained updates instead of subscribing to the entire object when you only need to react to specific property changes.
   - Consider using `batch` operations when making multiple changes to reduce the number of updates.
   - For large arrays or objects, consider using immutable patterns with regular reactive values.

4. **Type Safety**:
   - Always provide proper types for your reactive values
   - Use type narrowing in `onPropertyChange` callbacks when working with specific paths
   - Let TypeScript help you catch invalid assignments early
   - Use union types for properties that can have multiple types

5. **Symbol Properties**:
   - Symbol properties are fully supported but won't trigger reactive updates
   - Use symbols for internal implementation details that shouldn't trigger updates 