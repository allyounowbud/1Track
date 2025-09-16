/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html','./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      boxShadow: { soft: '0 10px 30px rgba(0,0,0,0.35)' },
      borderRadius: { card: '20px', pill: '9999px' },
      screens: {
        'sm': '750px', // Changed from default 640px to 750px (749px and below is small screen)
      },
    },
  },
  plugins: [],
}
