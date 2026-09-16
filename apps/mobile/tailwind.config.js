/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        primary: "#003B7A",
        "primary-royal": "#005A9C",
        "primary-sky": "#0080C8",
        teal: "#00A99D",
        "teal-dark": "#008B75",
        mint: "#6DD5A3",
        charcoal: "#2D3E50",
        "light-gray": "#F3F5F7",
        success: "#00A99D",
        warning: "#f59e0b",
        danger: "#ef4444",
        surface: "#ffffff",
        "surface-dark": "#071321",
        muted: "#64748b",
        border: "#e2e8f0",
        brand: {
          navy: "#003B7A",
          royal: "#005A9C",
          sky: "#0080C8",
          teal: "#00A99D",
          mint: "#6DD5A3",
          darkTeal: "#008B75",
          lightGray: "#F3F5F7",
          charcoal: "#2D3E50",
        },
      },
    },
  },
  plugins: [],
};
