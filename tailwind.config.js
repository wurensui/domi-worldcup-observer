/** @type {import('tailwindcss').Config} */
export default {
  content: ["./app/**/*.{js,jsx}", "./components/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        cream: "#F6F0E6",
        porcelain: "#FFFDF8",
        leaf: "#496B4A",
        moss: "#6F7F4D",
        coffee: "#2B211B",
        cacao: "#513A2D",
        gold: "#C8A45D",
        blush: "#E8CFC0"
      },
      fontFamily: {
        sans: [
          "Inter",
          "HarmonyOS Sans",
          "Source Han Sans SC",
          "Noto Sans CJK SC",
          "PingFang SC",
          "Microsoft YaHei",
          "sans-serif"
        ],
        display: [
          "Playfair Display",
          "Times New Roman",
          "Source Han Serif SC",
          "serif"
        ]
      },
      boxShadow: {
        glow: "0 28px 80px rgba(200, 164, 93, 0.28)",
        soft: "0 28px 70px rgba(43, 33, 27, 0.13)",
        night: "0 30px 90px rgba(0, 0, 0, 0.3)"
      }
    }
  },
  plugins: []
};
