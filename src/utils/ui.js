// Legacy UI constants - DEPRECATED: Use theme system instead
// This file is kept for backward compatibility but new code should use src/theme/

import { components, theme, cn } from '../theme/index.js';

// Legacy exports for backward compatibility
export const card = theme.card.default;
export const inputBase = components.input.base + ' ' + components.input.focus;
export const inputSm = "h-10 text-sm " + components.input.base + ' ' + components.input.focus;
export const rowCard = "rounded-xl border border-slate-800 bg-slate-900/60 p-3 overflow-hidden";
export const pageCard = theme.card.elevated;
export const pill = components.badge.base;
export const dateFix = "w-full max-w-full min-w-0 box-border [field-sizing:content]";
export const disabledInput = components.input.disabled;

// Tab styles
export const tabBase = "inline-flex items-center justify-center h-10 px-4 rounded-xl border transition";
export const tabIdle = "border-slate-800 bg-slate-900/60 text-slate-200 hover:bg-slate-900";
export const tabActive = "border-indigo-600 bg-indigo-600 text-white shadow-[0_8px_24px_rgba(79,70,229,.35)] hover:bg-indigo-600";

// Button styles
export const headerIconBtn = "h-9 w-9 inline-flex items-center justify-center rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100";
export const headerGhostBtn = "h-9 px-4 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-900 text-slate-100";
export const iconSave = "inline-flex items-center justify-center h-9 w-9 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500";
export const iconSaveBusy = "inline-flex items-center justify-center h-9 w-9 rounded-lg bg-slate-700 text-slate-300 cursor-not-allowed border border-slate-800";
export const iconDelete = "inline-flex items-center justify-center h-9 w-9 rounded-lg bg-rose-600 hover:bg-rose-500 text-white border border-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500";

// Re-export theme utilities for easy access
export { components, theme, cn } from '../theme/index.js';
