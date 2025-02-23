# Reflex ⚡

![GitHub Release](https://img.shields.io/github/v/release/2Toad/reflex)
[![Downloads](https://img.shields.io/npm/dm/@2toad/reflex.svg)](https://www.npmjs.com/package/@2toad/reflex)
[![Build status](https://github.com/2toad/reflex/actions/workflows/ci.yml/badge.svg)](https://github.com/2Toad/reflex/actions/workflows/nodejs.yml)

A simple yet powerful way to manage state in any JavaScript environment. Whether you're building browser applications, Node.js services, or CLI tools, Reflex helps you handle your data elegantly. Works with any framework (React, Vue, Angular) or vanilla JavaScript.

## Quick Start

1. Install the package:
```bash
npm i @2toad/reflex
```

2. Create and use a reactive value:
```typescript
import { reflex } from '@2toad/reflex';

// Create a reactive value
const counter = reflex({ initialValue: 0 });

// Listen for changes
counter.subscribe(value => {
  console.log('Counter is now:', value);
});

// Update the value
counter.setValue(1);
```

## Key Features

- 🪶 **Simple to Use** - Start managing state in minutes
- 🎯 **Works Everywhere** - Use with any JavaScript framework or vanilla JS
- ⚡ **Fast & Efficient** - Only updates when values actually change
- 🧮 **Smart Calculations** - Compute values based on other values automatically
- 🔄 **Async Ready** - Built-in support for async operations
- 🛡️ **Safe & Reliable** - Prevents common pitfalls and memory leaks

## Common Use Cases

### Basic Value Management
```typescript
const username = reflex({ initialValue: '' });
username.subscribe(name => updateUI(name));
```

### Computed Values
```typescript
const price = reflex({ initialValue: 10 });
const quantity = reflex({ initialValue: 2 });
const total = computed([price, quantity], ([p, q]) => p * q);
```

### Complex Objects
```typescript
const user = deepReflex({
  initialValue: {
    name: 'John',
    preferences: { theme: 'dark' }
  }
});
```

## Want to learn more?
Start here to learn the basics and get a solid foundation:

- [Features Guide](./docs/features.md) - Core features and basic usage
- [Advanced Usage](./docs/advanced-usage.md) - Complex patterns and techniques
- [Best Practices](./docs/best-practices.md) - Guidelines for clean, efficient code
- [Performance Tips](./docs/performance.md) - Optimization strategies
- [API Reference](./docs/api-reference.md) - Complete API documentation

Detailed guides for specific features:

- [Backpressure Handling](./docs/backpressure.md) - Managing high-frequency updates
- [Batch Operations](./docs/batch-operations.md) - Efficient bulk updates
- [Computed Values](./docs/computed-values.md) - Deriving state
- [Deep Reactivity](./docs/deep-reactivity.md) - Nested object reactivity
- [Operators](./docs/operators.md) - Transform and combine values

## Contributing

We welcome contributions! See our [Contributing Guide](./docs/contribute.md) to get started. 