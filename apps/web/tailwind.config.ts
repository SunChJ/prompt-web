import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        banana: {
          bg: "#0b0a09",
          fg: "#f2f2f2",
          muted: "#a6a39e",
          panel: "#101010",
          border: "rgba(255, 219, 117, 0.14)",
          borderStrong: "rgba(255, 219, 117, 0.22)",
          glow: "rgba(255, 219, 117, 0.22)"
        }
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(255, 219, 117, 0.18), 0 0 44px rgba(255, 219, 117, 0.08)"
      }
    }
  },
  plugins: []
} satisfies Config;


