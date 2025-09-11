// Theme colors for consistent styling across the app
export const colors = {
  // Primary colors
  primary: {
    50: 'rgb(238, 242, 255)',
    100: 'rgb(224, 231, 255)',
    200: 'rgb(199, 210, 254)',
    300: 'rgb(165, 180, 252)',
    400: 'rgb(129, 140, 248)',
    500: 'rgb(99, 102, 241)',
    600: 'rgb(79, 70, 229)',
    700: 'rgb(67, 56, 202)',
    800: 'rgb(55, 48, 163)',
    900: 'rgb(49, 46, 129)',
  },
  
  // Slate colors (our main theme)
  slate: {
    50: 'rgb(248, 250, 252)',
    100: 'rgb(241, 245, 249)',
    200: 'rgb(226, 232, 240)',
    300: 'rgb(203, 213, 225)',
    400: 'rgb(148, 163, 184)',
    500: 'rgb(100, 116, 139)',
    600: 'rgb(71, 85, 105)',
    700: 'rgb(51, 65, 85)',
    800: 'rgb(30, 41, 59)',
    900: 'rgb(15, 23, 42)',
  },
  
  // Success colors
  success: {
    50: 'rgb(240, 253, 244)',
    100: 'rgb(220, 252, 231)',
    200: 'rgb(187, 247, 208)',
    300: 'rgb(134, 239, 172)',
    400: 'rgb(74, 222, 128)',
    500: 'rgb(34, 197, 94)',
    600: 'rgb(22, 163, 74)',
    700: 'rgb(21, 128, 61)',
    800: 'rgb(22, 101, 52)',
    900: 'rgb(20, 83, 45)',
  },
  
  // Error colors
  error: {
    50: 'rgb(254, 242, 242)',
    100: 'rgb(254, 226, 226)',
    200: 'rgb(254, 202, 202)',
    300: 'rgb(252, 165, 165)',
    400: 'rgb(248, 113, 113)',
    500: 'rgb(239, 68, 68)',
    600: 'rgb(220, 38, 38)',
    700: 'rgb(185, 28, 28)',
    800: 'rgb(153, 27, 27)',
    900: 'rgb(127, 29, 29)',
  },
  
  // Warning colors
  warning: {
    50: 'rgb(255, 251, 235)',
    100: 'rgb(254, 243, 199)',
    200: 'rgb(253, 230, 138)',
    300: 'rgb(252, 211, 77)',
    400: 'rgb(251, 191, 36)',
    500: 'rgb(245, 158, 11)',
    600: 'rgb(217, 119, 6)',
    700: 'rgb(180, 83, 9)',
    800: 'rgb(146, 64, 14)',
    900: 'rgb(120, 53, 15)',
  },
  
  // Info colors
  info: {
    50: 'rgb(239, 246, 255)',
    100: 'rgb(219, 234, 254)',
    200: 'rgb(191, 219, 254)',
    300: 'rgb(147, 197, 253)',
    400: 'rgb(96, 165, 250)',
    500: 'rgb(59, 130, 246)',
    600: 'rgb(37, 99, 235)',
    700: 'rgb(29, 78, 216)',
    800: 'rgb(30, 64, 175)',
    900: 'rgb(30, 58, 138)',
  },
  
  // Neutral colors
  neutral: {
    50: 'rgb(250, 250, 250)',
    100: 'rgb(245, 245, 245)',
    200: 'rgb(229, 229, 229)',
    300: 'rgb(212, 212, 212)',
    400: 'rgb(163, 163, 163)',
    500: 'rgb(115, 115, 115)',
    600: 'rgb(82, 82, 82)',
    700: 'rgb(64, 64, 64)',
    800: 'rgb(38, 38, 38)',
    900: 'rgb(23, 23, 23)',
  }
};

// Semantic color mappings
export const semantic = {
  background: {
    primary: colors.slate[900],
    secondary: colors.slate[800],
    tertiary: colors.slate[700],
    card: colors.slate[900],
    overlay: `${colors.slate[900]}95`,
  },
  
  text: {
    primary: colors.slate[100],
    secondary: colors.slate[300],
    tertiary: colors.slate[400],
    muted: colors.slate[500],
  },
  
  border: {
    primary: colors.slate[800],
    secondary: colors.slate[700],
    focus: colors.primary[500],
  },
  
  status: {
    success: colors.success[500],
    error: colors.error[500],
    warning: colors.warning[500],
    info: colors.info[500],
  }
};
