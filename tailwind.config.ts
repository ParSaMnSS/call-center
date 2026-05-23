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
        sans: ["var(--font-vazirmatn)", "system-ui", "sans-serif"],
      },
      colors: {
        bg: "#0b0f17",
        panel: "#121826",
        panel2: "#1a2233",
        border: "#252d3f",
        text: "#e7ecf3",
        muted: "#8a94a6",
        accent: "#6ea8ff",
        accent2: "#9b8cff",
        success: "#3ddc97",
        warn: "#ffb454",
        danger: "#ff5d6c",
      },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.2), 0 8px 24px rgba(0,0,0,0.25)",
      },
      borderRadius: {
        xl2: "14px",
      },
    },
  },
  plugins: [],
};

export default config;
