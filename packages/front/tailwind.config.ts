import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        neon: {
          green: "var(--theme-primary)",
          darkgreen: "var(--surface-primary)",
          cyan: "var(--theme-secondary)",
          pink: "var(--theme-accent)",
          yellow: "var(--theme-highlight)",
          red: "var(--theme-alert)",
        },
      },
      boxShadow: {
        neon: "0 0 var(--shadow-strength) var(--theme-primary), inset 0 0 var(--shadow-inner-strength) var(--theme-primary)",
        card: "0 0 calc(var(--shadow-strength) * 0.7) var(--theme-secondary), inset 0 0 calc(var(--shadow-strength) * 0.7) var(--theme-secondary)",
      },
    },
  },
  plugins: [],
};

export default config; 