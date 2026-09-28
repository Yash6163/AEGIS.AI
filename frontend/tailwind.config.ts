import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: { 0: "#111110", 1: "#1a1a19", 2: "#222220", 3: "#2c2c29" },
        line: { DEFAULT: "#33332f", strong: "#4a4a45" },
        ink: { 1: "#f4f3ef", 2: "#c3c2b7", 3: "#8f8e86" },
        accent: "#3987e5",
        status: { good: "#0ca30c", warning: "#fab219", serious: "#ec835a", critical: "#d03b3b" },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
    },
  },
  plugins: [],
};
export default config;
