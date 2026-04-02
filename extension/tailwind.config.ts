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
        sans: ['ui-sans-serif', 'system-ui', 'sans-serif']
      },
      colors: {
        surface: {
          950: '#060816',
          900: '#0b1120',
          850: '#111827',
          800: '#162033',
          700: '#24314a'
        },
        accent: {
          500: '#3dd9b5',
          400: '#5ae7c4',
          300: '#8bf0d7'
        }
      },
      boxShadow: {
        glow: '0 20px 55px rgba(6, 10, 28, 0.55)',
        soft: '0 10px 35px rgba(2, 6, 23, 0.45)',
        inset: 'inset 0 1px 0 rgba(255,255,255,0.06)'
      },
      backgroundImage: {
        aurora:
          'radial-gradient(circle at top left, rgba(61,217,181,0.18), transparent 34%), radial-gradient(circle at 85% 20%, rgba(56,189,248,0.14), transparent 30%), linear-gradient(180deg, rgba(10,15,28,0.98) 0%, rgba(5,8,18,0.98) 100%)'
      },
      borderRadius: {
        '2xl': '1.25rem',
        '3xl': '1.5rem'
      }
    }
  },
  plugins: []
} satisfies Config;
