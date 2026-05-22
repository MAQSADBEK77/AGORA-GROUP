/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: { 50:'#eff6ff',100:'#dbeafe',400:'#60a5fa',500:'#3b82f6',600:'#2563eb',700:'#1d4ed8' },
        danger:  { 50:'#fef2f2',100:'#fee2e2',500:'#ef4444',600:'#dc2626' },
        success: { 50:'#f0fdf4',500:'#22c55e',600:'#16a34a' },
        warning: { 50:'#fffbeb',500:'#f59e0b',600:'#d97706' },
        slate:   { 750:'#1e2d40', 850:'#0f1c2e' },
      },
      animation: {
        'fade-in':    'fadeIn 0.3s ease-out',
        'slide-up':   'slideUp 0.4s ease-out',
        'pulse-slow': 'pulse 3s infinite',
      },
      keyframes: {
        fadeIn:  { '0%':{ opacity:0 }, '100%':{ opacity:1 } },
        slideUp: { '0%':{ opacity:0, transform:'translateY(16px)' }, '100%':{ opacity:1, transform:'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
