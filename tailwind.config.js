/** @type {import('tailwindcss').Config} */
module.exports = {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
        "./app/**/*.{js,ts,jsx,tsx}",
        "./components/**/*.{js,ts,jsx,tsx}",
        "./packages/studio/src/**/*.{js,jsx}",
        "./packages/Open-AI-Design-Agent/packages/design-agent/src/**/*.{js,jsx}",
        "./packages/Open-Poe-AI/packages/agents/src/**/*.{js,jsx,ts,tsx}",
        "./packages/Vibe-Workflow/packages/workflow-builder/src/**/*.{js,jsx,ts,tsx}",
    ],
    theme: {
        extend: {
            // Light theme tokens — values live in app/globals.css :root vars.
            colors: {
                primary: {
                    DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
                    hover: '#1d4ed8',
                },
                accent: {
                    DEFAULT: 'rgb(var(--accent-rgb) / <alpha-value>)',
                    hover: '#1d4ed8',
                },
                // "ink" replaces the old white-on-dark text/border/tint scale;
                // opacity modifiers (text-ink/65 …) keep the hierarchy.
                ink: 'rgb(var(--ink-rgb) / <alpha-value>)',
                'app-bg': 'var(--background)',
                'panel-bg': 'var(--surface)',
                'card-bg': 'var(--surface)',
                surface: {
                    DEFAULT: 'rgb(var(--surface-rgb) / <alpha-value>)',
                    2: 'var(--surface-secondary)',
                },
                line: 'var(--border)',
                secondary: 'var(--text-secondary)',
                muted: 'var(--text-muted)',
            },
            fontFamily: {
                sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
            },
            borderRadius: {
                'xl': '1rem',
                '2xl': '1.5rem',
                '3xl': '2rem',
            },
            boxShadow: {
                'glow': '0 0 20px rgba(37, 99, 235, 0.18)',
                'glow-accent': '0 0 20px rgba(124, 58, 237, 0.18)',
                '3xl': '0 35px 60px -15px rgba(15, 23, 42, 0.18)',
            }
        },
    },
    plugins: [],
}
