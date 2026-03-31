module.exports = {
  content: ['./src/**/*.{js,ts,jsx,tsx}', './src/app/globals.css'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        border: 'var(--border)',
        text: 'var(--text)',
        'text-muted': 'var(--text-muted)',
        primary: 'var(--primary)',
      },
    },
  },
  plugins: [],
};
