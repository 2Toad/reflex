# Backpressure Handling

Backpressure is a mechanism that helps manage the flow of data when producers emit values faster than consumers can process them. This is crucial for building robust reactive applications that can handle:

- High-frequency events (e.g., mouse moves, scroll events)
- Resource-intensive operations
- Memory-constrained environments
- Network request batching

## Core Concepts

### What is Backpressure?

Backpressure occurs when a system component cannot process incoming data as fast as it receives it. Without proper handling, this can lead to:

- Memory leaks from buffered data
- Degraded application performance
- Unresponsive UI
- System crashes

### Buffer Size

The `bufferSize` parameter represents the total number of values the system can handle, including:
- The current value being processed
- Any values stored in the buffer
- Values being processed by subscribers

When this limit is reached:
- `Drop` strategy will discard new values
- `Buffer` strategy will stop accepting new values
- `Sliding` strategy will remove oldest values
- `Error` strategy will throw an error

### Strategies

Reflex provides four strategies for handling backpressure:

1. **Drop**: Discards new values when the system is overwhelmed
2. **Buffer**: Stores values up to a limit for later processing
3. **Sliding**: Maintains a fixed-size window of most recent values
4. **Error**: Throws an error when capacity is exceeded

## Operators

### withBackpressure

The primary operator for adding backpressure handling capabilities to a reflex. Returns a combined type that includes both the original Reflex functionality and backpressure control methods.

```typescript
import { reflex, withBackpressure, BackpressureStrategy } from '@2toad/reflex';

const source = reflex({ initialValue: 0 });
const controlled = withBackpressure(source, {
  strategy: BackpressureStrategy.Buffer,
  bufferSize: 100
});
```

#### Configuration Options

```typescript
interface BackpressureOptions {
  strategy: BackpressureStrategy;
  bufferSize?: number;
  shouldApplyBackpressure?: () => boolean;
}

enum BackpressureStrategy {
  Drop = 'drop',
  Buffer = 'buffer',
  Sliding = 'sliding',
  Error = 'error'
}

interface BackpressureCapable {
  pause: () => void;
  resume: () => void;
  isPaused: () => boolean;
  getBufferSize: () => number;
}
```

#### Manual Control

```typescript
// Pause processing
controlled.pause();

// Values will be handled according to strategy
source.setValue(1);
source.setValue(2);

// Resume processing
controlled.resume();

// Check current state
console.log(controlled.isPaused()); // false
console.log(controlled.getBufferSize()); // 0
```

### Supporting Operators

#### buffer
Collects values over time and emits them as arrays.

```typescript
const clicks = reflex({ initialValue: { x: 0, y: 0 } });
const bufferedClicks = buffer(clicks, 1000);

bufferedClicks.subscribe(batch => {
  console.log(`Processing ${batch.length} clicks`);
});
```

#### sample
Takes periodic snapshots of the current value.

```typescript
const mousePosition = reflex({ initialValue: { x: 0, y: 0 } });
const sampledPosition = sample(mousePosition, 16); // ~60fps

sampledPosition.subscribe(updateUI);
```

#### throttle
Limits emission rate with intelligent value selection:

1. Initial Phase: Always emits the initial value immediately
2. Early Window Phase: Emits the first value in a new throttle window if it arrives early (within first third of the window)
3. Late Window Phase: Schedules the last value received during the throttle window for emission when the window ends

```typescript
const scrollEvents = reflex({ initialValue: 0 });
const smoothScroll = throttle(scrollEvents, 100);

// If scrollEvents emits: 0, 1, 2, 3, 4, 5 rapidly
// smoothScroll will emit:
// - 0 (initial value)
// - 1 (first in window)
// - 3 (last in window)

smoothScroll.subscribe(updateScrollIndicator);
```

This intelligent throttling ensures:
- No initial delay (first value is immediate)
- Responsive to early changes (useful for UI feedback)
- Eventual consistency (last value is always processed)

## Strategy Details

### Drop Strategy
Best for real-time UI updates where missed values are acceptable.

```typescript
const mouseMove = withBackpressure(source, {
  strategy: BackpressureStrategy.Drop,
  bufferSize: 1
});
```

### Buffer Strategy
Ideal when all values must eventually be processed.

```typescript
const dataQueue = withBackpressure(source, {
  strategy: BackpressureStrategy.Buffer,
  bufferSize: 1000
});
```

### Sliding Strategy
Perfect for maintaining recent history or moving averages.

```typescript
const recentValues = withBackpressure(source, {
  strategy: BackpressureStrategy.Sliding,
  bufferSize: 10
});
```

### Error Strategy
Used when overflow indicates a critical problem. Will throw 'Backpressure limit exceeded' when:
- Total values (current + buffered) reaches bufferSize
- System is paused
- Custom shouldApplyBackpressure returns true

```typescript
const criticalData = withBackpressure(source, {
  strategy: BackpressureStrategy.Error,
  bufferSize: 5
});
```

## Advanced Usage

### Custom Backpressure Conditions

```typescript
const controlled = withBackpressure(source, {
  strategy: BackpressureStrategy.Buffer,
  shouldApplyBackpressure: () => {
    return (
      memoryUsage() > threshold ||
      processorLoad() > 80 ||
      networkQueueSize() > 100
    );
  }
});
```

### Combining Operators

```typescript
const mouseMove = reflex({ initialValue: { x: 0, y: 0 } });
const smoothMove = mouseMove.pipe(
  withBackpressure({
    strategy: BackpressureStrategy.Sliding,
    bufferSize: 2
  }),
  sample(16), // ~60fps
  map(pos => calculateVelocity(pos))
);
```

## Real-World Examples

### High-frequency Event Handling

```typescript
const touchEvents = reflex({ initialValue: null });
const processedEvents = touchEvents.pipe(
  withBackpressure({
    strategy: BackpressureStrategy.Sliding,
    bufferSize: 3
  }),
  sample(16),
  map(calculateGesture)
);
```

### Resource-intensive Processing

```typescript
const dataStream = reflex({ initialValue: [] });
const processedStream = withBackpressure(dataStream, {
  strategy: BackpressureStrategy.Buffer,
  bufferSize: 1000,
  shouldApplyBackpressure: () => {
    return memoryUsage() > threshold || processorLoad() > 80;
  }
});

processedStream.subscribe(async batch => {
  await processIntensiveOperation(batch);
});
```

### API Request Batching

```typescript
const userActions = reflex({ initialValue: null });
const batchedActions = userActions.pipe(
  withBackpressure({
    strategy: BackpressureStrategy.Buffer,
    bufferSize: 100
  }),
  buffer(2000) // 2-second batches
);

batchedActions.subscribe(async batch => {
  await api.bulkUpdate(batch);
});
```

## Best Practices

### Memory Management

1. Set appropriate buffer sizes based on:
   - Available memory
   - Processing speed
   - Data arrival rate
   - Business requirements
   - Total value count (current + buffered)

2. Monitor buffer usage:
   ```typescript
   setInterval(() => {
     const size = controlled.getBufferSize();
     if (size > warningThreshold) {
       console.warn(`Buffer size: ${size}`);
     }
   }, 1000);
   ```

### Performance Optimization

1. Choose strategies based on requirements:
   - Use `BackpressureStrategy.Drop` for real-time UI
   - Use `BackpressureStrategy.Buffer` for data that must be processed
   - Use `BackpressureStrategy.Sliding` for recent history
   - Use `BackpressureStrategy.Error` for critical systems

2. Combine operators effectively:
   ```typescript
   const optimized = source.pipe(
     withBackpressure({ 
       strategy: BackpressureStrategy.Sliding, 
       bufferSize: 10 
     }),
     sample(16),
     map(process),
     catchError(handleError)
   );
   ```

### Testing

1. Test different load scenarios:
   ```typescript
   it('handles high frequency updates', async () => {
     const source = reflex({ initialValue: 0 });
     const controlled = withBackpressure(source, {
       strategy: BackpressureStrategy.Buffer,
       bufferSize: 3
     });
     
     // Simulate rapid updates
     for (let i = 0; i < 100; i++) {
       source.setValue(i);
     }
     
     expect(controlled.getBufferSize()).to.be.lte(3);
   });
   ```

2. Test recovery from backpressure:
   ```typescript
   it('recovers after backpressure is relieved', async () => {
     const source = reflex({ initialValue: 0 });
     const controlled = withBackpressure(source, {
       strategy: BackpressureStrategy.Buffer,
       bufferSize: 2
     });
     
     controlled.pause();
     source.setValue(1);
     source.setValue(2);
     source.setValue(3);
     
     controlled.resume();
     expect(controlled.getBufferSize()).to.equal(0);
   });
   ``` 