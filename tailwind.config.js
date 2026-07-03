/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // Midnight graphite / deep navy-black backgrounds
        ink: {
          950: '#070a12',
          900: '#0a0e1a',
          850: '#0d1320',
          800: '#111827',
          750: '#161f33',
          700: '#1c2740',
          600: '#243150',
          500: '#2e3d5e',
        },
        // Ice-cyan intelligence accent
        cyan: {
          50: '#ecfeff',
          100: '#cffafe',
          200: '#a5f3fc',
          300: '#67e8f9',
          400: '#22d3ee',
          500: '#06b6d4',
          600: '#0891b2',
          700: '#0e7490',
          800: '#155e75',
          900: '#164e63',
        },
        // Electric-blue intelligence accent
        electric: {
          50: '#eff6ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8',
          800: '#1e40af',
          900: '#1e3a8a',
        },
        // Severity scale
        severity: {
          advisory: '#94a3b8', // muted grey
          elevated: '#facc15', // yellow/amber
          high: '#fb923c', // orange
          critical: '#f87171', // coral-red
        },
        success: {
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
        },
        warning: {
          400: '#fbbf24',
          500: '#f59e0b',
          600: '#d97706',
        },
        error: {
          400: '#f87171',
          500: '#ef4444',
          600: '#dc2626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        glow: '0 0 20px rgba(34, 211, 238, 0.15)',
        'glow-cyan': '0 0 24px rgba(34, 211, 238, 0.25)',
        'glow-critical': '0 0 24px rgba(248, 113, 113, 0.3)',
        'glow-elevated': '0 0 18px rgba(250, 204, 21, 0.2)',
        'glow-high': '0 0 18px rgba(251, 146, 60, 0.2)',
        panel: '0 8px 32px rgba(0, 0, 0, 0.4)',
      },
      animation: {
        'pulse-marker': 'pulse-marker 2s ease-in-out infinite',
        'pulse-dot': 'pulse-dot 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'scan-line': 'scan-line 4s linear infinite',
        'fade-in': 'fade-in 0.4s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'slide-in-right': 'slide-in-right 0.3s ease-out',
        'grid-pan': 'grid-pan 20s linear infinite',
        'spin-slow': 'spin 8s linear infinite',
        'ping-slow': 'ping-slow 3s cubic-bezier(0, 0, 0.2, 1) infinite',
        'reveal-up': 'reveal-up 0.4s cubic-bezier(0.16, 1, 0.3, 1) both',
        'stagger-in': 'stagger-in 0.35s cubic-bezier(0.16, 1, 0.3, 1) both',
        'toast-in': 'toast-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'toast-out': 'toast-out 0.25s cubic-bezier(0.4, 0, 1, 1) both',
        'skeleton': 'skeleton 1.5s ease-in-out infinite',
        'ambient-sweep': 'ambient-sweep 8s ease-in-out infinite',
        'halo-pulse': 'halo-pulse 2.5s ease-in-out infinite',
        'amber-pulse': 'amber-pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        'pulse-marker': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.15)' },
        },
        'pulse-dot': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.4' },
        },
        'scan-line': {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(100vh)' },
        },
        'fade-in': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'slide-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          '0%': { opacity: '0', transform: 'translateX(24px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'grid-pan': {
          '0%': { backgroundPosition: '0 0' },
          '100%': { backgroundPosition: '40px 40px' },
        },
        'ping-slow': {
          '75%, 100%': { transform: 'scale(2)', opacity: '0' },
        },
        'reveal-up': {
          '0%': { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'stagger-in': {
          '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'toast-in': {
          '0%': { opacity: '0', transform: 'translateY(20px) scale(0.95)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'toast-out': {
          '0%': { opacity: '1', transform: 'translateY(0) scale(1)' },
          '100%': { opacity: '0', transform: 'translateY(20px) scale(0.95)' },
        },
        'skeleton': {
          '0%, 100%': { opacity: '0.3' },
          '50%': { opacity: '0.6' },
        },
        'ambient-sweep': {
          '0%, 100%': { opacity: '0.3', transform: 'translateX(-30%)' },
          '50%': { opacity: '0.6', transform: 'translateX(30%)' },
        },
        'halo-pulse': {
          '0%, 100%': { opacity: '0.3', transform: 'scale(1)' },
          '50%': { opacity: '0.5', transform: 'scale(1.3)' },
        },
        'amber-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.5' },
        },
      },
      backgroundImage: {
        'grid-texture':
          'linear-gradient(rgba(34, 211, 238, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(34, 211, 238, 0.04) 1px, transparent 1px)',
        'scan-lines':
          'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255, 255, 255, 0.015) 2px, rgba(255, 255, 255, 0.015) 4px)',
      },
    },
  },
  plugins: [],
};
