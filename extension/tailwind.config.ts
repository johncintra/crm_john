import type { Config } from 'tailwindcss';

export default {
  content: ['./popup.html', './src/**/*.{ts,tsx}'],
  prefix: 'crm-',
  corePlugins: {
    preflight: false
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        background: 'oklch(var(--crm-background) / <alpha-value>)',
        foreground: 'oklch(var(--crm-foreground) / <alpha-value>)',
        card: 'oklch(var(--crm-card) / <alpha-value>)',
        'card-2': 'oklch(var(--crm-card-2) / <alpha-value>)',
        muted: 'oklch(var(--crm-muted) / <alpha-value>)',
        'muted-foreground': 'oklch(var(--crm-muted-foreground) / <alpha-value>)',
        border: 'oklch(var(--crm-border) / <alpha-value>)',
        destructive: 'oklch(var(--crm-destructive) / <alpha-value>)',
        sidebar: 'oklch(var(--crm-sidebar) / <alpha-value>)',
        primary: 'oklch(var(--crm-primary) / <alpha-value>)',
        'primary-foreground': 'oklch(var(--crm-primary-foreground) / <alpha-value>)',
        'primary-hover': 'oklch(var(--crm-primary-hover) / <alpha-value>)',
        ring: 'oklch(var(--crm-ring) / <alpha-value>)',
        // Legacy aliases kept during the wacrm-style migration so older
        // markup using crm-bg-surface-*/crm-bg-accent-* still resolves.
        surface: {
          950: '#060816',
          900: '#0b1120',
          850: '#111827',
          800: '#162033',
          700: '#24314a'
        },
        accent: {
          500: 'oklch(var(--crm-primary) / <alpha-value>)',
          400: 'oklch(var(--crm-primary-hover) / <alpha-value>)',
          300: 'oklch(var(--crm-primary) / 0.7)'
        }
      },
      boxShadow: {
        glow: '0 20px 55px rgba(6, 10, 28, 0.55)',
        soft: '0 10px 35px rgba(2, 6, 23, 0.45)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.06)'
      },
      backgroundImage: {
        aurora:
          'radial-gradient(circle at top left, oklch(var(--crm-primary) / 0.18), transparent 34%), radial-gradient(circle at 85% 20%, oklch(var(--crm-primary) / 0.12), transparent 30%), linear-gradient(180deg, rgba(10,15,28,0.98) 0%, rgba(5,8,18,0.98) 100%)'
      },
      borderRadius: {
        DEFAULT: '0.625rem',
        lg: '0.625rem',
        xl: '0.875rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem'
      }
    }
  },
  plugins: []
} satisfies Config;
