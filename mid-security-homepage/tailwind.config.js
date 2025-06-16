/** @type {import('tailwindcss').Config} */
const tailwindConfig = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#e24343',
        'primary-dark': '#c53030',
        'primary-light': '#f87171',
        'ms-gray-50': '#fafafa',
        'ms-gray-100': '#f5f5f5',
        'ms-gray-200': '#e5e5e5',
        'ms-gray-300': '#d4d4d4',
        'ms-gray-400': '#a3a3a3',
        'ms-gray-500': '#737373',
        'ms-gray-600': '#525252',
        'ms-gray-700': '#404040',
        'ms-gray-800': '#262626',
        'ms-gray-900': '#171717',
      },
      boxShadow: {
        'ms-sm': '0 2px 4px rgba(0, 0, 0, 0.1)',
        'ms': '0 4px 6px rgba(0, 0, 0, 0.1)',
        'ms-md': '0 6px 10px rgba(0, 0, 0, 0.08)',
        'ms-lg': '0 10px 15px rgba(0, 0, 0, 0.07)',
        'ms-xl': '0 15px 25px rgba(0, 0, 0, 0.06)',
        'ms-inner': 'inset 0 2px 4px rgba(0, 0, 0, 0.06)',
      },
      fontFamily: {
        'segoe': ['"Segoe UI"', 'system-ui', '-apple-system', 'sans-serif'],
      },
      borderRadius: {
        'ms': '2px',
        'ms-md': '4px',
        'ms-lg': '6px',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-100%)' }
        },
        marquee2: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0%)' }
        }
      },
      animation: {
        marquee: 'marquee 25s linear infinite',
        marquee2: 'marquee2 25s linear infinite'
      },
    },
  },
  plugins: [],
}

export default tailwindConfig;
