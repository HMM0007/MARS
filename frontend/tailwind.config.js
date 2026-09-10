/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        railway: {
          blue: "#1E3A5F",
          teal: "#2F6F7E",
          bg: "#F4F6F8",
          border: "#D6DEE6",
          text: "#1F2933",
          muted: "#52606D",
        },
      },
    },
  },
  plugins: [],
}