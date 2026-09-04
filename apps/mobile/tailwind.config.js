/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.{js,jsx,ts,tsx}', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#3b82f6',
        success: '#22c55e',
        warning: '#f59e0b',
        danger: '#ef4444',
        surface: '#ffffff',
        'surface-dark': '#1e293b',
        muted: '#94a3b8',
        border: '#e2e8f0',
      },
    },
  },
  plugins: [],
};
