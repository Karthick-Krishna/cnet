/**
 * Centralised Design Tokens for HSBC Cnet
 * Authentic corporate banking palette: crisp white, warm light grey, deep charcoal, HSBC Red (#DB0011).
 */
export const DESIGN_TOKENS = {
  colors: {
    // Surfaces
    surfacePrimary: '#FFFFFF',
    surfaceSecondary: '#F4F4F4',
    surfaceTertiary: '#EBEBEB',
    surfaceNavy: '#252525', // Deep Charcoal header/utility surface
    surfaceNavyHover: '#383838',

    // Typography
    textPrimary: '#252525',
    textSecondary: '#555555',
    textMuted: '#767676',
    textInverse: '#FFFFFF',

    // Brand Accents (HSBC Red)
    accentPrimary: '#DB0011',
    accentPrimaryHover: '#B0000D',
    accentPrimarySoft: '#FDF2F2',
    accentNavy: '#252525',

    // Borders & Dividers
    borderSubtle: '#D7D8D6',
    borderStrong: '#B8B9B7',
    borderFocus: '#252525',

    // Semantic Statuses
    statusSuccessBg: '#EBF7F0',
    statusSuccessText: '#008A52',
    statusSuccessBorder: '#B7E1CD',

    statusWarningBg: '#FEF7EC',
    statusWarningText: '#9A4A06',
    statusWarningBorder: '#FCD9A5',

    statusPendingBg: '#F3F4F6',
    statusPendingText: '#252525',
    statusPendingBorder: '#D1D5DB',

    statusDangerBg: '#FDF2F2',
    statusDangerText: '#B0000D',
    statusDangerBorder: '#F5C2C7',

    statusNeutralBg: '#F4F4F4',
    statusNeutralText: '#555555',
    statusNeutralBorder: '#D7D8D6',
  },

  typography: {
    fontFamilySans: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    fontFamilyMono: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace",
    scale: {
      xs: { size: '0.75rem', lineHeight: '1rem' },
      sm: { size: '0.8125rem', lineHeight: '1.25rem' },
      base: { size: '0.875rem', lineHeight: '1.375rem' },
      md: { size: '1rem', lineHeight: '1.5rem' },
      lg: { size: '1.125rem', lineHeight: '1.625rem' },
      xl: { size: '1.375rem', lineHeight: '1.875rem' },
      '2xl': { size: '1.75rem', lineHeight: '2.25rem' },
      '3xl': { size: '2.125rem', lineHeight: '2.5rem' },
    },
    weights: {
      regular: 400,
      medium: 500,
      semibold: 600,
      bold: 700,
    },
  },

  spacing: {
    xxs: '0.25rem',
    xs: '0.5rem',
    sm: '0.75rem',
    md: '1rem',
    lg: '1.5rem',
    xl: '2rem',
    '2xl': '3rem',
  },

  radii: {
    none: '0px',
    sm: '2px',
    md: '2px',
    lg: '4px',
    xl: '6px',
    full: '9999px',
  },

  elevation: {
    none: 'none',
    xs: '0 1px 2px rgba(0, 0, 0, 0.04)',
    sm: '0 1px 3px rgba(0, 0, 0, 0.08)',
    md: '0 4px 12px rgba(0, 0, 0, 0.08)',
    lg: '0 10px 25px rgba(0, 0, 0, 0.12)',
  },

  iconSizes: {
    xs: 14,
    sm: 16,
    md: 18,
    lg: 20,
    xl: 24,
  },

  controls: {
    buttonHeightSm: '36px',
    buttonHeightMd: '42px',
    buttonHeightLg: '48px',
    inputHeight: '44px',
    touchMinTarget: '44px',
  },

  navigation: {
    sidebarWidth: '256px',
    topBarHeight: '64px',
    mobileBottomNavHeight: '64px',
    maxContentWidth: '1320px',
  },

  breakpoints: {
    mobileSmall: 360,
    mobileStandard: 390,
    mobileLarge: 430,
    tablet: 768,
    desktop: 1024,
    desktopWide: 1440,
    desktopLarge: 1680,
  },
} as const;
