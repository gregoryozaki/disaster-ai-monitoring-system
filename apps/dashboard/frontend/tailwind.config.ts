import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        kamara: {
          green: '#047857',
          blue: '#2563eb',
          ink: '#111827',
          muted: '#6b7280',
        },
      },
    },
  },
  plugins: [],
};

export default config;
