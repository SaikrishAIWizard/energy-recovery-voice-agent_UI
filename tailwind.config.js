/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Operations-dashboard palette: deep navy chrome, light working surface.
        navy: {
          50: '#f2f5fa',
          100: '#e3e9f3',
          200: '#c3cfe3',
          300: '#93a7c8',
          400: '#5f79a6',
          500: '#3d588a',
          600: '#2c4370',
          700: '#23355a',
          800: '#1a2744',
          900: '#131d33',
          950: '#0b1220',
        },
        signal: {
          done: '#15803d',
          active: '#b45309',
          blocked: '#b91c1c',
          dnc: '#64748b',
          info: '#1d4ed8',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(15 23 42 / 0.06), 0 1px 3px 0 rgb(15 23 42 / 0.08)',
        panel: '0 4px 16px -2px rgb(15 23 42 / 0.12)',
      },
    },
  },
  plugins: [],
}
