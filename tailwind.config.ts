import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: "#0D1B2A",
        "zimba-blue": "#1B3A5C",
        "zimba-gold": "#E8B100",
        "off-white": "#F5F5F5",
        "alert-red": "#C62828",
        "eco-green": "#2E7D32",
        ink: {
          900: "#0D1B2A",
          800: "#15263A",
          700: "#1B3A5C",
          600: "#2C4A6E",
          500: "#4A627E",
          400: "#7A8DA3",
          300: "#B5C0CD",
          200: "#DDE3EA",
          100: "#ECEFF3",
          50: "#F5F5F5",
        },
        gold: {
          700: "#B58A00",
          600: "#CC9A00",
          500: "#E8B100",
          400: "#F2C534",
          100: "#FBEFC1",
          50: "#FDF7DD",
        },
        red: {
          700: "#8E1F1F",
          500: "#C62828",
          100: "#FBE3E3",
        },
        green: {
          700: "#1F5723",
          500: "#2E7D32",
          100: "#DCEDDD",
        },
        "border-subtle": "#DDE3EA",
        "border-strong": "#B5C0CD",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "Arial", "sans-serif"],
        serif: ["Georgia", '"Times New Roman"', "serif"],
        display: ["Georgia", '"Times New Roman"', "serif"],
        mono: ['"JetBrains Mono"', "Menlo", "Consolas", "monospace"],
      },
      fontSize: {
        "fs-12": ["0.75rem", { lineHeight: "1.4" }],
        "fs-13": ["0.8125rem", { lineHeight: "1.45" }],
        "fs-14": ["0.875rem", { lineHeight: "1.5" }],
        "fs-15": ["0.9375rem", { lineHeight: "1.5" }],
        "fs-16": ["1rem", { lineHeight: "1.55" }],
        "fs-18": ["1.125rem", { lineHeight: "1.55" }],
        "fs-20": ["1.25rem", { lineHeight: "1.18" }],
        "fs-24": ["1.5rem", { lineHeight: "1.18" }],
        "fs-28": ["1.75rem", { lineHeight: "1.18" }],
        "fs-34": ["2.125rem", { lineHeight: "1.12" }],
        "fs-44": ["2.75rem", { lineHeight: "1.12" }],
        "fs-56": ["3.5rem", { lineHeight: "1.05" }],
      },
      letterSpacing: {
        tight2: "-0.02em",
        tag: "0.12em",
        wide2: "0.04em",
      },
      borderRadius: {
        xs: "2px",
        sm: "4px",
        md: "6px",
        lg: "8px",
        DEFAULT: "6px",
      },
      maxWidth: {
        container: "1180px",
        narrow: "720px",
        text: "880px",
        wide: "1320px",
      },
      boxShadow: {
        "z-1": "0 1px 0 0 rgba(13, 27, 42, 0.06)",
        "z-2":
          "0 1px 2px 0 rgba(13, 27, 42, 0.08), 0 0 0 1px rgba(13, 27, 42, 0.04)",
        "z-3":
          "0 4px 12px -2px rgba(13, 27, 42, 0.10), 0 0 0 1px rgba(13, 27, 42, 0.04)",
        "focus-gold": "0 0 0 3px rgba(232, 177, 0, 0.45)",
      },
      transitionTimingFunction: {
        standard: "cubic-bezier(0.2, 0, 0.2, 1)",
        out2: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
export default config;
