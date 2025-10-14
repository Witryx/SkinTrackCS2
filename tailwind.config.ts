import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#0ea5e9",   // hlavni barva
          dark: "#0284c7",
          light: "#38bdf8",
        },
        surface: {
          DEFAULT: "#0b1220",
          soft: "#111827",
          softer: "#0f172a",
          card: "#0b1020",
        },
      },
      boxShadow: {
        soft: "0 6px 24px rgba(0,0,0,.25)",
      },
      borderRadius: {
        xl2: "1rem",
      },
    },
  },
  plugins: [],
};
export default config;
