import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-vazirmatn)", "var(--font-inter)", "system-ui", "sans-serif"],
        latin: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      colors: {
        bg: "#f6f4ef",
        surface: "#fdfbf7",
        surface2: "#eeeae1",
        border: "#e2dccf",
        borderStrong: "#d2cbbb",
        fg: "#0a0a0a",
        muted: "#6b6a64",
        subtle: "#a09e95",
        // Legacy aliases so older class references keep compiling.
        panel: "#fdfbf7",
        panel2: "#eeeae1",
        text: "#0a0a0a",
        accent: "#0a0a0a",
        accent2: "#262626",
        success: "#16a34a",
        warn: "#d97706",
        danger: "#dc2626",
        info: "#525252",
      },
      boxShadow: {
        flat: "0 1px 2px rgb(0 0 0 / 0.04)",
        // Keep legacy `soft` reference compiling but as a flat shadow.
        soft: "0 1px 2px rgb(0 0 0 / 0.04)",
      },
      borderRadius: {
        // Legacy alias.
        xl2: "12px",
      },
    },
  },
  plugins: [],
};

export default config;
