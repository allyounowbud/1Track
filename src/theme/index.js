// Main theme export file
export { colors, semantic } from './colors.js';
export { components, cn } from './components.js';

// Common theme combinations for quick use
export const theme = {
  // Page layouts
  page: {
    container: 'min-h-screen bg-slate-950 text-slate-100',
    content: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8',
    header: 'bg-slate-900 border-b border-slate-800',
    sidebar: 'bg-slate-900 border-r border-slate-800',
  },
  
  // Card variations
  card: {
    default: 'bg-slate-900 border border-slate-800 rounded-xl',
    elevated: 'bg-slate-900 border border-slate-800 rounded-xl shadow-lg',
    interactive: 'bg-slate-900 border border-slate-800 rounded-xl hover:bg-slate-800/50 transition-colors cursor-pointer',
  },
  
  // Button sizes
  button: {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
    xl: 'px-8 py-4 text-lg',
  },
  
  // Common patterns
  patterns: {
    kpiCard: 'bg-slate-900 border border-slate-800 rounded-xl p-6 text-center',
    statsCard: 'bg-slate-900 border border-slate-800 rounded-xl p-4',
    filterCard: 'bg-slate-900 border border-slate-800 rounded-xl p-4 mb-6',
    chartCard: 'bg-slate-900 border border-slate-800 rounded-xl p-6',
    listItem: 'flex items-center justify-between p-4 bg-slate-900 border border-slate-800 rounded-lg hover:bg-slate-800/50 transition-colors',
  }
};

// Export everything as default for convenience
export default {
  colors,
  semantic,
  components,
  theme,
  cn
};
