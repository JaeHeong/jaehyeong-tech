/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    screens: {
      'sm': '640px',
      'md': '768px',
      'tablet': '1000px',
      'lg': '1024px',
      'xl': '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        primary: '#3182f6',
        'background-light': '#f5f7f8',
        'background-dark': '#101722',
        'card-light': '#ffffff',
        'card-dark': '#1c232d',
        'secondary-dark': '#282f39',
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
        full: '9999px',
      },
      animation: {
        'terminal-wiggle': 'terminal-wiggle 0.5s ease-in-out infinite',
      },
      keyframes: {
        'terminal-wiggle': {
          '0%, 100%': { transform: 'rotate(0deg) scale(1)' },
          '25%': { transform: 'rotate(-8deg) scale(1.1)' },
          '75%': { transform: 'rotate(8deg) scale(1.1)' },
        },
      },
    },
  },
  plugins: [],
}
