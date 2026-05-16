# @capsuletech/profiler

Performance monitoring and profiling utilities for SolidJS applications.

## Features

- 🎯 Web Vitals tracking (CLS, FCP, INP, LCP, TTFB)
- 📊 Real-time performance metrics dashboard
- 💾 Memory usage monitoring
- 📡 Network performance tracking
- ⚡ Lightweight and non-intrusive

## Installation

```bash
pnpm add @capsuletech/profiler
```

## Usage

### VitalsMonitoringProvider

Wrap your application with the provider to start collecting metrics:

```tsx
import { VitalsMonitoringProvider } from '@capsuletech/profiler/providers';

export default function App() {
  return (
    <VitalsMonitoringProvider>
      <YourComponent />
    </VitalsMonitoringProvider>
  );
}
```

### Using Metrics in Components

Access metrics from the context:

```tsx
import { useVitalsContext } from '@capsuletech/profiler/providers';

function MyComponent() {
  const context = useVitalsContext();
  
  return (
    <div>
      <p>Performance Metrics Available</p>
    </div>
  );
}
```

## Monitored Metrics

- **FCP** - First Contentful Paint
- **LCP** - Largest Contentful Paint
- **CLS** - Cumulative Layout Shift
- **INP** - Interaction to Next Paint
- **TTFB** - Time to First Byte
- **Memory Usage** - JavaScript heap usage
- **Network Load** - Total network data transferred
- **Bundle Size** - Total resource bundle size
- **Connection Type** - Network connection speed

## License

MIT

