import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    container: {
      center: true,
      padding: "1.5rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        bg: {
          base: "hsl(var(--bg-base) / <alpha-value>)",
          elevated: "hsl(var(--bg-elevated) / <alpha-value>)",
          hover: "hsl(var(--bg-hover) / <alpha-value>)",
          pressed: "hsl(var(--bg-pressed) / <alpha-value>)",
        },
        border: {
          DEFAULT: "hsl(var(--border-subtle) / <alpha-value>)",
          subtle: "hsl(var(--border-subtle) / <alpha-value>)",
          strong: "hsl(var(--border-strong) / <alpha-value>)",
        },
        text: {
          primary: "hsl(var(--text-primary) / <alpha-value>)",
          secondary: "hsl(var(--text-secondary) / <alpha-value>)",
          muted: "hsl(var(--text-muted) / <alpha-value>)",
          inverse: "hsl(var(--text-inverse) / <alpha-value>)",
        },
        gold: {
          DEFAULT: "hsl(var(--gold) / <alpha-value>)",
          bright: "hsl(var(--gold-bright) / <alpha-value>)",
          muted: "hsl(var(--gold-muted) / <alpha-value>)",
        },
        silver: {
          DEFAULT: "hsl(var(--silver) / <alpha-value>)",
          bright: "hsl(var(--silver-bright) / <alpha-value>)",
        },
        success: {
          DEFAULT: "hsl(var(--success) / <alpha-value>)",
          bg: "hsl(var(--success) / 0.10)",
        },
        danger: {
          DEFAULT: "hsl(var(--danger) / <alpha-value>)",
          bg: "hsl(var(--danger) / 0.10)",
        },
        info: "hsl(var(--info) / <alpha-value>)",
        warning: "hsl(var(--warning) / <alpha-value>)",
        background: "hsl(var(--bg-base) / <alpha-value>)",
        foreground: "hsl(var(--text-primary) / <alpha-value>)",
        ring: "hsl(var(--gold) / <alpha-value>)",
      },
      borderRadius: {
        sm: "6px",
        md: "10px",
        lg: "14px",
        xl: "20px",
      },
      fontFamily: {
        display: ["var(--font-sora)", "Sora", "system-ui", "sans-serif"],
        sans: ["var(--font-inter)", "Inter", "system-ui", "sans-serif"],
        mono: ["var(--font-jetbrains)", "JetBrains Mono", "monospace"],
      },
      fontSize: {
        "display-xl": ["64px", { lineHeight: "72px", fontWeight: "700", letterSpacing: "-0.03em" }],
        "display-lg": ["48px", { lineHeight: "56px", fontWeight: "700", letterSpacing: "-0.025em" }],
        "display-md": ["36px", { lineHeight: "44px", fontWeight: "600", letterSpacing: "-0.02em" }],
      },
      boxShadow: {
        card: "var(--shadow-card)",
        elevated: "0 20px 50px rgba(0,0,0,0.55)",
        "gold-glow": "0 0 24px rgba(212,175,55,0.35)",
        "success-glow": "0 0 24px rgba(34,197,94,0.30)",
        "danger-glow": "0 0 24px rgba(239,68,68,0.30)",
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #F0C75E 0%, #D4AF37 50%, #8A7427 100%)",
        "silver-gradient": "linear-gradient(180deg, #FFFFFF 0%, #C0C5CE 100%)",
        "hero-radial":
          "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(212,175,55,0.18) 0%, transparent 60%)",
        grid: "linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "48px 48px",
      },
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "pulse-soft": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.55" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.4s ease-out",
        "pulse-soft": "pulse-soft 2s ease-in-out infinite",
        shimmer: "shimmer 2.4s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

export default config;
