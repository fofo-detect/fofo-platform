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
      keyframes: {
        "mesh-pulse": {
          "0%, 100%": { opacity: "0.4", transform: "scale(1)" },
          "50%": { opacity: "1", transform: "scale(1.6)" },
        },
        "scan-sweep": {
          "0%": { transform: "translateY(-20px)" },
          "100%": { transform: "translateY(400px)" },
        },
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        "mesh-pulse": "mesh-pulse 2.4s ease-in-out infinite",
        "scan-sweep": "scan-sweep 3.2s linear infinite",
        "fade-up": "fade-up 0.6s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
