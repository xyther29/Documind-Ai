/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#142D4E",
          hover: "#0E1F36",
          dark: "#0B1A2D",
        },
        electric: {
          DEFAULT: "#3478F6",
          hover: "#2264E2",
          subtle: "#EFF6FF",
        },
        teal: {
          DEFAULT: "#0F9D91",
          subtle: "#E6F6F5",
          dark: "#0B7A70",
        },
        amber: {
          DEFAULT: "#E8A23A",
          subtle: "#FEF7ED",
          dark: "#B45309",
        },
        coral: {
          DEFAULT: "#E87568",
          subtle: "#FDF2F1",
          dark: "#C53B2B",
        },
        canvas: "#F3F6FA",
        surface: "#FFFFFF",
        tint: "#EBF1F7",
        selection: "#E4ECF4",
        border: {
          DEFAULT: "#D7E0EB",
          secondary: "#BAC7D5",
        },
        slateText: {
          primary: "#263548",
          secondary: "#586B80",
          muted: "#7E90A5",
        },
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          "Segoe UI",
          "Roboto",
          "Helvetica",
          "Arial",
          "sans-serif",
        ],
        mono: [
          "ui-monospace",
          "SF Mono",
          "Menlo",
          "Consolas",
          "monospace",
        ],
      },
      boxShadow: {
        card: "0 1px 3px rgba(20, 45, 78, 0.06), 0 1px 2px rgba(20, 45, 78, 0.04)",
        cardHover: "0 4px 12px rgba(20, 45, 78, 0.09), 0 1px 3px rgba(20, 45, 78, 0.05)",
        btn: "0 2px 6px rgba(52, 120, 246, 0.28)",
      },
      borderRadius: {
        DEFAULT: "6px",
      },
    },
  },
  plugins: [],
};
