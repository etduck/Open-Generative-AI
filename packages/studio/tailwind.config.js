/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      // Light theme tokens — kept in sync with the root tailwind.config.js.
      colors: {
        'app-bg': 'var(--background, #f6f7f9)',
        'panel-bg': 'var(--surface, #ffffff)',
        'card-bg': 'var(--surface, #ffffff)',
        primary: 'rgb(var(--accent-rgb, 37 99 235) / <alpha-value>)',
        accent: {
          DEFAULT: 'rgb(var(--accent-rgb, 37 99 235) / <alpha-value>)',
          hover: '#1d4ed8',
        },
        ink: 'rgb(var(--ink-rgb, 23 25 28) / <alpha-value>)',
        surface: {
          DEFAULT: 'rgb(var(--surface-rgb, 255 255 255) / <alpha-value>)',
          2: 'var(--surface-secondary, #eef0f3)',
        },
        line: 'var(--border, #dfe3e8)',
        secondary: 'var(--text-secondary, #626a73)',
        muted: 'var(--text-muted, #8a929b)',
      },
    },
  },
  plugins: [],
}
