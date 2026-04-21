// Tailwind config for KFZ-Branchen-Template v1.
// Plan §4.1: Tailwind for structure (utilities), CSS Custom Props for theme.
// Theme stays minimal — colors/fonts/radii live in tokens.css and resolve
// per [data-variant="a|b|c"]. Tailwind only needs spacing/breakpoints/typography.

const path = require('node:path');
const ROOT = path.resolve(__dirname, '../..');

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    path.join(__dirname, '**/*.eta'),
    path.join(__dirname, '**/*.html'),
    path.join(ROOT, 'sites/onepages/**/*.html'),
  ],
  // No safelist needed — variant switching uses [data-variant="…"] attribute
  // selectors in tokens.css (resolved by browser, not Tailwind).
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1440px',
    },
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        fg: 'var(--color-fg)',
        muted: 'var(--color-muted)',
        accent: 'var(--color-accent)',
        'accent-fg': 'var(--color-accent-fg)',
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
      },
      fontFamily: {
        heading: 'var(--font-heading)',
        body: 'var(--font-body)',
      },
      fontSize: {
        // 4pt-anchored, modular scale (1.25 ratio), fluid via clamp on display sizes
        xs: ['0.75rem', { lineHeight: '1.5' }],
        sm: ['0.875rem', { lineHeight: '1.55' }],
        base: ['1rem', { lineHeight: '1.6' }],
        lg: ['1.125rem', { lineHeight: '1.55' }],
        xl: ['1.25rem', { lineHeight: '1.4' }],
        '2xl': ['clamp(1.5rem, 1.3rem + 1vw, 1.875rem)', { lineHeight: '1.3' }],
        '3xl': ['clamp(1.875rem, 1.5rem + 1.6vw, 2.5rem)', { lineHeight: '1.2' }],
        '4xl': ['clamp(2.25rem, 1.6rem + 2.6vw, 3.25rem)', { lineHeight: '1.15' }],
        '5xl': ['clamp(2.75rem, 1.8rem + 3.4vw, 4rem)', { lineHeight: '1.05' }],
      },
      borderRadius: {
        card: 'var(--radius-card)',
        btn: 'var(--radius-btn)',
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        btn: 'var(--shadow-btn)',
      },
      maxWidth: {
        prose: '65ch',
        container: '1200px',
      },
      spacing: {
        // 4pt grid plus a couple of fluid section pads
        section: 'clamp(3rem, 6vw, 5.5rem)',
        gutter: 'clamp(1rem, 3vw, 2rem)',
      },
    },
  },
  plugins: [],
};
