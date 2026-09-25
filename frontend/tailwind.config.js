/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        mate: '#1a1a1a',
        mate_dark: '#121212',
        mate_light: '#2a2a2a',
        gold: '#d4af37'
      }
    },
  },
  plugins: [],
}
