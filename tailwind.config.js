/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{ts,tsx,html}',
  ],
  theme: {
    extend: {
      colors: {
        status: {
          pending: '#6B7280',
          inprogress: '#3B82F6',
          blocked: '#F59E0B',
          done: '#10B981',
          cancelled: '#EF4444',
          urgent: '#DC2626',
        },
        priority: {
          low: '#10B981',
          medium: '#F59E0B',
          high: '#F97316',
          urgent: '#DC2626',
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
