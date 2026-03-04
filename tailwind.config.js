/**
 * Tailwind CSS config with PolicyEngine design tokens.
 * Colors sourced from @policyengine/design-system — keep in sync.
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ["./app/**/*.{js,jsx}", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "-apple-system", "BlinkMacSystemFont", "sans-serif"],
        mono: ["JetBrains Mono", "SF Mono", "Consolas", "monospace"],
      },
      colors: {
        pe: {
          50: "#E6FFFA",
          100: "#B2F5EA",
          200: "#81E6D9",
          300: "#4FD1C5",
          400: "#38B2AC",
          500: "#319795",
          600: "#2C7A7B",
          700: "#285E61",
          800: "#234E52",
          900: "#1D4044",
        },
        gray: {
          50: "#F9FAFB",
          100: "#F2F4F7",
          200: "#E2E8F0",
          300: "#D1D5DB",
          400: "#9CA3AF",
          500: "#6B7280",
          600: "#4B5563",
          700: "#344054",
          800: "#1F2937",
          900: "#101828",
        },
      },
    },
  },
  plugins: [],
};
