// Pre-built themed components using the theme system
import React from 'react';
import { components, theme, cn } from '../theme/index.js';

// Themed Card Component
export const ThemedCard = ({ 
  children, 
  className = '', 
  variant = 'default',
  header,
  footer,
  ...props 
}) => {
  const cardClass = cn(
    theme.card[variant],
    className
  );
  
  return (
    <div className={cardClass} {...props}>
      {header && (
        <div className={components.card.header}>
          {header}
        </div>
      )}
      <div className={components.card.body}>
        {children}
      </div>
      {footer && (
        <div className={components.card.footer}>
          {footer}
        </div>
      )}
    </div>
  );
};

// Themed Button Component
export const ThemedButton = ({ 
  children, 
  variant = 'primary',
  size = 'md',
  className = '',
  disabled = false,
  ...props 
}) => {
  const buttonClass = cn(
    components.button.base,
    components.button[variant],
    theme.button[size],
    disabled && components.button.disabled,
    className
  );
  
  return (
    <button className={buttonClass} disabled={disabled} {...props}>
      {children}
    </button>
  );
};

// Themed Input Component
export const ThemedInput = ({ 
  label,
  error,
  helper,
  className = '',
  ...props 
}) => {
  const inputClass = cn(
    components.input.base,
    components.input.focus,
    error && components.input.error,
    className
  );
  
  return (
    <div>
      {label && (
        <label className={components.form.label}>
          {label}
        </label>
      )}
      <input className={inputClass} {...props} />
      {error && (
        <div className={components.form.error}>
          {error}
        </div>
      )}
      {helper && !error && (
        <div className={components.form.helper}>
          {helper}
        </div>
      )}
    </div>
  );
};

// Themed Badge Component
export const ThemedBadge = ({ 
  children, 
  variant = 'primary',
  className = '',
  ...props 
}) => {
  const badgeClass = cn(
    components.badge.base,
    components.badge[variant],
    className
  );
  
  return (
    <span className={badgeClass} {...props}>
      {children}
    </span>
  );
};

// Themed KPI Card Component
export const ThemedKPICard = ({ 
  title,
  value,
  subtitle,
  trend,
  className = '',
  ...props 
}) => {
  return (
    <div className={cn(theme.patterns.kpiCard, className)} {...props}>
      <div className={components.typography.caption}>
        {title}
      </div>
      <div className={cn(components.typography.heading2, 'mt-1')}>
        {value}
      </div>
      <div className={cn(components.typography.caption, 'mt-1')}>
        {subtitle}
      </div>
      {trend && (
        <div className="mt-2 text-xs">
          {trend}
        </div>
      )}
    </div>
  );
};

// Themed Stats Card Component
export const ThemedStatsCard = ({ 
  title,
  children,
  className = '',
  ...props 
}) => {
  return (
    <div className={cn(theme.patterns.statsCard, className)} {...props}>
      {title && (
        <div className={cn(components.typography.heading4, 'mb-4')}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
};

// Themed Filter Card Component
export const ThemedFilterCard = ({ 
  children,
  className = '',
  ...props 
}) => {
  return (
    <div className={cn(theme.patterns.filterCard, className)} {...props}>
      {children}
    </div>
  );
};

// Themed Chart Card Component
export const ThemedChartCard = ({ 
  title,
  children,
  className = '',
  ...props 
}) => {
  return (
    <div className={cn(theme.patterns.chartCard, className)} {...props}>
      {title && (
        <div className={cn(components.typography.heading3, 'mb-4')}>
          {title}
        </div>
      )}
      {children}
    </div>
  );
};

// Themed Page Layout Component
export const ThemedPageLayout = ({ 
  title,
  subtitle,
  children,
  className = '',
  ...props 
}) => {
  return (
    <div className={cn(theme.page.content, className)} {...props}>
      {(title || subtitle) && (
        <div className="mb-8">
          {title && (
            <h1 className={components.typography.heading1}>
              {title}
            </h1>
          )}
          {subtitle && (
            <p className={cn(components.typography.caption, 'mt-2')}>
              {subtitle}
            </p>
          )}
        </div>
      )}
      {children}
    </div>
  );
};

// Themed Grid Component
export const ThemedGrid = ({ 
  children,
  cols = 4,
  gap = 6,
  className = '',
  ...props 
}) => {
  const gridClass = cn(
    `grid gap-${gap}`,
    `grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-${cols}`,
    className
  );
  
  return (
    <div className={gridClass} {...props}>
      {children}
    </div>
  );
};
