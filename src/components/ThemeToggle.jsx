import { useTheme } from '../contexts/ThemeContext';

export default function ThemeToggle({ isCollapsed = false }) {
  const { theme, toggleTheme, isDark } = useTheme();

  // Base styling to match page rows - full width when expanded
  const itemBase = isCollapsed 
    ? "flex items-center justify-center w-10 h-10 rounded-lg"
    : "flex items-center gap-3 px-3 py-2 rounded-lg w-full";
  const itemIdle = "text-gray-600 dark:text-slate-300 hover:text-gray-900 dark:hover:text-slate-100 hover:bg-gray-100 dark:hover:bg-slate-800/50";

  return (
    <button
      onClick={toggleTheme}
      className={`${itemBase} ${itemIdle}`}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      {/* Icon - sun for light mode, moon for dark mode */}
      {isDark ? (
        // Moon icon for dark mode (when in dark mode, show moon)
        <svg className={`${isCollapsed ? 'h-5 w-5' : 'h-5 w-5 flex-shrink-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      ) : (
        // Sun icon for light mode (when in light mode, show sun)
        <svg className={`${isCollapsed ? 'h-5 w-5' : 'h-5 w-5 flex-shrink-0'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      )}
      
      {!isCollapsed && (
        <>
          {/* Text - shows current mode */}
          <span className="text-sm font-medium truncate flex-1 text-left">
            {isDark ? 'Dark Mode' : 'Light Mode'}
          </span>
          
          {/* Toggle Switch - positioned on the right */}
          <div className="flex-shrink-0">
            <div className={`relative inline-flex h-5 w-9 items-center rounded-full ${
              isDark ? 'bg-blue-600' : 'bg-gray-300'
            }`}>
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white ${
                isDark ? 'translate-x-4' : 'translate-x-0.5'
              }`} />
            </div>
          </div>
        </>
      )}
    </button>
  );
}
