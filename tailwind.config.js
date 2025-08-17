/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx,js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        canvas: '#0B0B0C',
      },
      boxShadow: {
        soft: '0 10px 30px rgba(0,0,0,0.15)'
      },
      fontFamily: {
        sans: ['-apple-system','SF Pro Text','system-ui','Inter','Avenir','Helvetica','Arial','sans-serif']
      }
    },
  },
  plugins: [],
}


