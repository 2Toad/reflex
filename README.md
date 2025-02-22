# Reflex ⚡

![GitHub Release](https://img.shields.io/github/v/release/2Toad/reflex)
[![Downloads](https://img.shields.io/npm/dm/@2toad/reflex.svg)](https://www.npmjs.com/package/@2toad/reflex)
[![Build status](https://github.com/2toad/reflex/actions/workflows/ci.yml/badge.svg)](https://github.com/2Toad/reflex/actions/workflows/nodejs.yml)

A lightweight, framework-agnostic reactive state management system with zero dependencies.

## Features

- 🪶 **Lightweight** - Zero dependencies, minimal implementation
- 🎯 **Framework Agnostic** - Works with any JavaScript framework or vanilla JS
- 📦 **TypeScript First** - Full type safety and excellent IDE support
- 🧮 **Computed Values** - Derive state from other reactive values
- 🧹 **Automatic Cleanup** - Prevents memory leaks
- ⚡ **Efficient** - Only updates when values actually change
- 🔍 **Deep Reactivity** - Track changes in nested objects and arrays
- 🛡️ **Safe** - Protection against recursive updates and error propagation

## Getting Started

Install package

```Shell
npm i @2toad/reflex
```

## Usage

```typescript
import { reflex } from '@2toad/reflex';
// or
const { reflex } = require('@2toad/reflex');
```

```typescript
// Create a reactive value
const count = reflex({ initialValue: 0 });

// Subscribe to changes
const unsubscribe = count.subscribe(value => {
  console.log('Count changed:', value);
}); // Logs: Count changed: 0 (immediate call with current value)

// Update the value
count.setValue(1); // Logs: Count changed: 1

// Cleanup when done
unsubscribe();
```

## API

### Methods

#### reflex<T>(options: ReactiveOptions<T>): Reactive<T>
- Creates a reactive value with subscription capabilities
- Supports custom equality functions for complex objects
- Returns a Reactive object with `value`, `setValue`, and `subscribe` methods

```typescript
const counter = reflex({ initialValue: 0 });
const user = reflex({
  initialValue: { name: 'John' },
  equals: (prev, next) => prev.name === next.name
});
```

#### deepReflex<T extends object>(options: DeepReactiveOptions<T>): DeepReactive<T>
- Creates a deeply reactive value that automatically tracks nested changes
- Supports objects and arrays at any depth
- Provides granular property change tracking
- Returns a DeepReactive object with deep reactivity features

```typescript
const user = deepReflex({
  initialValue: {
    name: 'John',
    profile: { age: 30 }
  },
  onPropertyChange: (path, value) => {
    console.log(`Changed ${path.join('.')} to ${value}`);
  }
});
```

#### computed<TDeps, TResult>(dependencies: TDeps[], compute: (values: TDeps) => TResult): Reactive<TResult>
- Creates a read-only reactive value derived from other reactive values
- Automatically updates when dependencies change
- Efficient: only recomputes when dependency values actually change

```typescript
const width = reflex({ initialValue: 5 });
const height = reflex({ initialValue: 10 });
const area = computed([width, height], ([w, h]) => w * h);
```

## Further Reading

For more detailed information about specific features, please refer to the following documentation:

- [Deep Reactivity](./docs/deep-reactivity.md)
- [Computed Values](./docs/computed-values.md)
- [Batch Operations](./docs/batch-operations.md)
- [Memory Management](./docs/memory-management.md)

## Contributing 🤝

Want to contribute to the Reflex project? Fantastic! Please read our [Contributing Guidelines](./docs/contribute.md) to get started. 