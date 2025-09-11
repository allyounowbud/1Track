// Reusable component styles using the theme colors
import { semantic } from './colors.js';

export const components = {
  // Card styles
  card: {
    base: 'bg-slate-900 border border-slate-800 rounded-xl',
    header: 'border-b border-slate-800 px-6 py-4',
    body: 'px-6 py-4',
    footer: 'border-t border-slate-800 px-6 py-4',
  },
  
  // Button styles
  button: {
    base: 'inline-flex items-center justify-center px-4 py-2 rounded-lg font-medium text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-slate-900',
    primary: 'bg-slate-800 text-slate-100 hover:bg-slate-700 focus:ring-slate-500',
    secondary: 'bg-slate-700 text-slate-200 hover:bg-slate-600 focus:ring-slate-500',
    success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
    error: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
    warning: 'bg-yellow-600 text-white hover:bg-yellow-700 focus:ring-yellow-500',
    ghost: 'text-slate-300 hover:text-slate-100 hover:bg-slate-800 focus:ring-slate-500',
    disabled: 'bg-slate-800 text-slate-500 cursor-not-allowed opacity-50',
  },
  
  // Input styles
  input: {
    base: 'w-full px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-100 placeholder-slate-400 outline-none transition-colors',
    focus: 'focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500',
    error: 'border-red-500 focus:ring-red-500',
    disabled: 'bg-slate-800 text-slate-500 cursor-not-allowed',
  },
  
  // Form styles
  form: {
    label: 'block text-sm font-medium text-slate-300 mb-2',
    helper: 'text-xs text-slate-400 mt-1',
    error: 'text-xs text-red-400 mt-1',
  },
  
  // Table styles
  table: {
    container: 'overflow-hidden rounded-xl border border-slate-800',
    header: 'bg-slate-800/50 border-b border-slate-800',
    headerCell: 'px-6 py-3 text-left text-xs font-medium text-slate-300 uppercase tracking-wider',
    body: 'divide-y divide-slate-800',
    row: 'hover:bg-slate-800/30 transition-colors',
    cell: 'px-6 py-4 whitespace-nowrap text-sm text-slate-200',
  },
  
  // Badge styles
  badge: {
    base: 'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
    primary: 'bg-slate-800 text-slate-200',
    success: 'bg-green-900 text-green-200',
    error: 'bg-red-900 text-red-200',
    warning: 'bg-yellow-900 text-yellow-200',
    info: 'bg-blue-900 text-blue-200',
  },
  
  // Modal styles
  modal: {
    overlay: 'fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-50',
    container: 'fixed inset-0 z-50 flex items-center justify-center p-4',
    content: 'bg-slate-900 border border-slate-800 rounded-xl shadow-xl max-w-md w-full',
    header: 'px-6 py-4 border-b border-slate-800',
    body: 'px-6 py-4',
    footer: 'px-6 py-4 border-t border-slate-800 flex justify-end gap-3',
  },
  
  // Dropdown styles
  dropdown: {
    container: 'relative',
    trigger: 'flex items-center justify-between w-full px-4 py-3 bg-slate-900/60 border border-slate-800 rounded-xl text-slate-100',
    menu: 'absolute left-0 right-0 mt-2 z-50 rounded-xl border border-slate-800 bg-slate-900/95 backdrop-blur shadow-xl',
    item: 'w-full text-left px-3 py-2 hover:bg-slate-800 text-slate-200',
    itemActive: 'w-full text-left px-3 py-2 bg-slate-800 text-white',
  },
  
  // Navigation styles
  nav: {
    item: 'flex items-center px-3 py-2 text-sm font-medium rounded-lg transition-colors',
    itemActive: 'bg-slate-800 text-slate-100',
    itemInactive: 'text-slate-400 hover:text-slate-200 hover:bg-slate-800',
  },
  
  // Status indicators
  status: {
    online: 'bg-green-500',
    offline: 'bg-slate-500',
    pending: 'bg-yellow-500',
    error: 'bg-red-500',
  },
  
  // Layout styles
  layout: {
    container: 'max-w-7xl mx-auto px-4 sm:px-6 lg:px-8',
    section: 'py-8',
    grid: 'grid gap-6',
    flex: 'flex items-center gap-4',
  },
  
  // Typography
  typography: {
    heading1: 'text-3xl font-bold text-slate-100',
    heading2: 'text-2xl font-semibold text-slate-100',
    heading3: 'text-xl font-semibold text-slate-100',
    heading4: 'text-lg font-medium text-slate-100',
    body: 'text-slate-200',
    caption: 'text-sm text-slate-400',
    muted: 'text-slate-500',
  },
  
  // Spacing utilities
  spacing: {
    section: 'mb-8',
    card: 'mb-6',
    element: 'mb-4',
    small: 'mb-2',
  },
  
  // Animation utilities
  animation: {
    fadeIn: 'animate-in fade-in duration-200',
    slideIn: 'animate-in slide-in-from-bottom-2 duration-200',
    scaleIn: 'animate-in zoom-in-95 duration-200',
  }
};

// Utility function to combine classes
export const cn = (...classes) => {
  return classes.filter(Boolean).join(' ');
};
