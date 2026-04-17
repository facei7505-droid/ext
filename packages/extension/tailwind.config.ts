import type { Config } from 'tailwindcss';

export default {
  content: [
    './src/popup/**/*.{vue,ts,html}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#0b5394',
          dark: '#08407a',
          light: '#e6eef7',
        },
        accent: {
          DEFAULT: '#166534',
          warn: '#b38700',
          error: '#b91c1c',
        },
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'Tahoma', 'Arial', 'sans-serif'],
        mono: ['"Cascadia Code"', '"Consolas"', 'monospace'],
      },
    },
  },
  plugins: [],
} satisfies Config;
