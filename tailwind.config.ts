import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cyber: {
          950: "#060A10", // deepest dark background
          900: "#0B111D", // main container background
          850: "#10192A", // panel background
          800: "#17233B", // elevated panel/hover
          700: "#1E3050", // border & dividers
          600: "#2B436D", // subtle highlight
          500: "#3D6098", // muted text
          400: "#6085C0", // secondary text
          300: "#93B3E6", // body text
          200: "#C9DCFA", // primary text
          100: "#EBF3FE", // brightest text
        },
        neon: {
          cyan: "#00F0FF",
          blue: "#3B82F6",
          purple: "#8B5CF6",
          emerald: "#10B981",
          amber: "#F59E0B",
          crimson: "#EF4444",
        },
      },
      fontFamily: {
        mono: ["ui-monospace", "SFMono-Regular", "Menlo", "Monaco", "Consolas", "Liberation Mono", "monospace"],
        sans: ["Inter", "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
      },
      boxShadow: {
        "cyan-glow": "0 0 15px -3px rgba(0, 240, 255, 0.25)",
        "red-glow": "0 0 15px -3px rgba(239, 68, 68, 0.3)",
        "amber-glow": "0 0 15px -3px rgba(245, 158, 11, 0.25)",
        "emerald-glow": "0 0 15px -3px rgba(16, 185, 129, 0.25)",
        "panel-edge": "inset 0 1px 0 0 rgba(255, 255, 255, 0.05)",
      },
      animation: {
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "scan-line": "scanline 8s linear infinite",
      },
      keyframes: {
        scanline: {
          "0%": { transform: "translateY(-100%)" },
          "100%": { transform: "translateY(1000%)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
