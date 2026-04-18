import type { Config } from 'tailwindcss';

/**
 * Строгая корпоративная палитра «больничной» CRM:
 * приглушённые серо-синие тона, плоские бордеры, без теней.
 */
export default {
  content: ['./index.html', './src/**/*.{vue,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        kmis: {
          bg: '#f3f5f8',
          panel: '#ffffff',
          border: '#c5cdd8',
          ink: '#1f2937',
          muted: '#6b7280',
          accent: '#0b5394',
          accentHover: '#0a437a',
          danger: '#b91c1c',
          success: '#166534',
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'Tahoma', 'Arial', 'sans-serif'],
      },
      borderRadius: {
        kmis: '2px',
      },
    },
  },
  plugins: [],
} satisfies Config;
