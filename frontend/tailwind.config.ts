export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#00ff88',
        secondary: '#ff3366',
      },
      fontFamily: {
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SF Mono',
          'Menlo',
          'Monaco',
          'Cascadia Code',
          'Roboto Mono',
          'Consolas',
          'Courier New',
          'monospace'
        ],
      },
    },
  },
};