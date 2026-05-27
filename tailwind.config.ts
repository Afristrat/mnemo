import type { Config } from "tailwindcss";

// Système de design Strate, tokens portés de design-reference/mn_mo_brand_identity/DESIGN.md.
// Source de vérité : ne pas inventer de couleur hors de cette palette.
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        surface: "#faf8ff",
        "surface-dim": "#d2d9f4",
        "surface-bright": "#faf8ff",
        "surface-container-lowest": "#ffffff",
        "surface-container-low": "#f2f3ff",
        "surface-container": "#eaedff",
        "surface-container-high": "#e2e7ff",
        "surface-container-highest": "#dae2fd",
        "on-surface": "#131b2e",
        "on-surface-variant": "#3d4947",
        "inverse-surface": "#283044",
        "inverse-on-surface": "#eef0ff",
        outline: "#6d7a77",
        "outline-variant": "#bcc9c6",
        "surface-tint": "#006a61",
        primary: "#00685f",
        "on-primary": "#ffffff",
        "primary-container": "#008378",
        "on-primary-container": "#f4fffc",
        "inverse-primary": "#6bd8cb",
        secondary: "#0051d5",
        "on-secondary": "#ffffff",
        "secondary-container": "#316bf3",
        "on-secondary-container": "#fefcff",
        tertiary: "#7d5400",
        "on-tertiary": "#ffffff",
        "tertiary-container": "#9d6a00",
        "on-tertiary-container": "#fffbff",
        error: "#ba1a1a",
        "on-error": "#ffffff",
        "error-container": "#ffdad6",
        "on-error-container": "#93000a",
        background: "#faf8ff",
        "on-background": "#131b2e",
        "surface-variant": "#dae2fd",
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        display: ["var(--font-space-grotesk)", "var(--font-inter)", "sans-serif"],
        mono: ["var(--font-jetbrains-mono)", "monospace"],
      },
      fontSize: {
        "display-lg": ["48px", { lineHeight: "1.1", letterSpacing: "-0.04em", fontWeight: "700" }],
        "headline-lg": ["32px", { lineHeight: "1.2", letterSpacing: "-0.03em", fontWeight: "700" }],
        "headline-md": ["24px", { lineHeight: "1.3", letterSpacing: "-0.02em", fontWeight: "600" }],
        "body-lg": ["18px", { lineHeight: "1.6", fontWeight: "400" }],
        "body-md": ["16px", { lineHeight: "1.5", fontWeight: "400" }],
        "body-sm": ["14px", { lineHeight: "1.5", fontWeight: "400" }],
        "code-md": ["14px", { lineHeight: "1.4", fontWeight: "500" }],
        "label-caps": ["12px", { lineHeight: "1", letterSpacing: "0.05em", fontWeight: "600" }],
      },
      borderRadius: {
        sm: "0.25rem",
        DEFAULT: "0.5rem",
        md: "0.75rem",
        lg: "1rem",
        xl: "1.5rem",
        full: "9999px",
        card: "14px",
        input: "10px",
      },
      spacing: {
        "container-margin": "24px",
        "element-gap": "20px",
        "section-padding": "40px",
        "grid-gutter": "24px",
      },
      boxShadow: {
        elevation: "0 1px 3px rgba(15, 23, 42, 0.06)",
      },
    },
  },
  plugins: [],
};

export default config;
