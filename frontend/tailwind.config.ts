import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          black: "#0a0a0a",
          panel: "#141414",
          border: "#262626",
          red: "#8B0000",
          "red-bright": "#B22222",
        },
        // Light "premium SaaS" theme, scoped to the /dashboard section only —
        // the marketing/auth pages keep the dark brand.* theme above.
        dash: {
          bg: "#FAFAF8",
          card: "#FFFFFF",
          ink: "#1A1A1A",
          sub: "#6B6B65",
          border: "#E6E4DC",
          hover: "#F1F0EA",
        },
      },
      fontFamily: {
        sans: ["ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
      },
    },
  },
  plugins: [],
};

export default config;
