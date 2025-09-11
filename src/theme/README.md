# Theme System Documentation

This theme system provides consistent styling across the entire application. It includes colors, components, and utility functions to ensure all pages have the same look and feel.

## Quick Start

```javascript
import { theme, components, cn } from '../theme/index.js';
// or
import { ThemedCard, ThemedButton } from '../components/ThemedComponents.jsx';
```

## Color System

### Using Colors
```javascript
import { colors, semantic } from '../theme/colors.js';

// Use semantic colors for consistent theming
const styles = {
  background: semantic.background.primary, // slate-900
  text: semantic.text.primary,            // slate-100
  border: semantic.border.primary,        // slate-800
};
```

### Available Color Palettes
- **Primary**: Indigo-based colors for accents
- **Slate**: Main theme colors (grays)
- **Success**: Green colors for positive actions
- **Error**: Red colors for errors/warnings
- **Warning**: Yellow/orange colors for warnings
- **Info**: Blue colors for informational content

## Component Styles

### Basic Components
```javascript
import { components } from '../theme/index.js';

// Cards
<div className={components.card.base}>Content</div>

// Buttons
<button className={`${components.button.base} ${components.button.primary}`}>
  Click me
</button>

// Inputs
<input className={`${components.input.base} ${components.input.focus}`} />

// Badges
<span className={`${components.badge.base} ${components.badge.success}`}>
  Success
</span>
```

### Pre-built Themed Components
```javascript
import { ThemedCard, ThemedButton, ThemedKPICard } from '../components/ThemedComponents.jsx';

// KPI Card
<ThemedKPICard 
  title="Total Revenue" 
  value="$12,345" 
  subtitle="+12% from last month" 
/>

// Regular Card
<ThemedCard variant="elevated" header={<h3>Card Title</h3>}>
  Card content here
</ThemedCard>

// Button
<ThemedButton variant="success" size="lg">
  Save Changes
</ThemedButton>
```

## Common Patterns

### Page Layout
```javascript
import { ThemedPageLayout } from '../components/ThemedComponents.jsx';

<ThemedPageLayout 
  title="Dashboard" 
  subtitle="Overview of your business metrics"
>
  {/* Page content */}
</ThemedPageLayout>
```

### Stats Grid
```javascript
import { ThemedGrid, ThemedKPICard } from '../components/ThemedComponents.jsx';

<ThemedGrid cols={4}>
  <ThemedKPICard title="Revenue" value="$12,345" subtitle="This month" />
  <ThemedKPICard title="Orders" value="156" subtitle="Completed" />
  <ThemedKPICard title="Profit" value="$3,456" subtitle="+8.2%" />
  <ThemedKPICard title="Customers" value="89" subtitle="Active" />
</ThemedGrid>
```

### Form Layout
```javascript
import { ThemedCard, ThemedInput, ThemedButton } from '../components/ThemedComponents.jsx';

<ThemedCard>
  <ThemedInput 
    label="Email Address"
    type="email"
    placeholder="Enter your email"
    helper="We'll never share your email"
  />
  <ThemedButton variant="primary" className="mt-4">
    Submit
  </ThemedButton>
</ThemedCard>
```

## Utility Functions

### Combining Classes
```javascript
import { cn } from '../theme/index.js';

// Safely combine classes
<div className={cn(
  theme.card.default,
  'custom-class',
  isActive && 'active-class'
)} />
```

## Migration Guide

### From Old System
```javascript
// Old way
import { card, inputBase } from '../utils/ui.js';

// New way
import { theme, components } from '../theme/index.js';
// or
import { ThemedCard, ThemedInput } from '../components/ThemedComponents.jsx';
```

### Replacing Inline Styles
```javascript
// Old way
<div className="bg-slate-900 border border-slate-800 rounded-xl p-6">

// New way
<ThemedCard variant="elevated">
// or
<div className={theme.card.elevated}>
```

## Best Practices

1. **Use semantic colors** instead of hardcoded color values
2. **Use pre-built components** when possible for consistency
3. **Combine classes with `cn()`** utility function
4. **Follow the established patterns** for common layouts
5. **Use the theme system** for all new pages and components

## Examples

See `src/components/ThemedComponents.jsx` for complete examples of how to build consistent UI components using the theme system.
