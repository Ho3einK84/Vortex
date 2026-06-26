// Vortex — UnoCSS configuration.
//
// The whole point of Vortex is a loud, tactile Neo-Brutalist look: thick borders,
// hard offset shadows (no blur), punchy accents and chunky type. Colours are driven
// by CSS custom properties (defined in src/base.css and swapped per `data-theme`),
// so the same shortcuts produce a paper-light or an amoled-dark surface without any
// extra utilities. Borders / shadows reference `var(--ink)` so they invert correctly.
//
// Consumed by scripts/build.mjs via `createGenerator(config)`.

import presetUno from '@unocss/preset-uno'

/** @type {import('@unocss/core').UserConfig} */
const config = {
  presets: [presetUno()],

  // Brutalist design tokens. Everything tactile is expressed here so markup stays terse.
  shortcuts: {
    // Core surface: thick border + hard, blur-less offset shadow.
    'brutal': 'border-3 border-[var(--ink)] shadow-[5px_5px_0_var(--ink)]',
    'brutal-sm': 'border-2 border-[var(--ink)] shadow-[3px_3px_0_var(--ink)]',
    'brutal-lg': 'border-4 border-[var(--ink)] shadow-[8px_8px_0_var(--ink)]',

    // Pressable: the shadow collapses and the element nudges into it for a physical click.
    'brutal-btn':
      'brutal-sm cursor-pointer select-none transition-transform duration-75 ' +
      'hover:-translate-x-px hover:-translate-y-px hover:shadow-[5px_5px_0_var(--ink)] ' +
      'active:translate-x-[3px] active:translate-y-[3px] active:shadow-none',

    // Loud call-to-action button.
    'brutal-cta':
      'brutal-btn bg-[var(--accent)] text-[var(--accent-ink)] font-800 uppercase tracking-wide',

    // Chip / pill used for tags and language + theme toggles.
    'brutal-chip':
      'inline-flex items-center gap-1.5 border-2 border-[var(--ink)] px-2.5 py-1 ' +
      'font-700 text-xs uppercase tracking-wide bg-[var(--surface)]',

    'surface': 'bg-[var(--surface)] text-[var(--ink)]',
    'ink': 'text-[var(--ink)]',
    'muted': 'text-[var(--muted)]',
  },

  theme: {
    fontFamily: {
      sans: "'Exo 2','Arad',system-ui,sans-serif",
    },
    breakpoints: {
      sm: '480px',
      md: '768px',
    },
  },

  rules: [
    // border-3 isn't in the default preset's static set in all versions; define it explicitly.
    ['border-3', { 'border-width': '3px' }],
  ],

  // Classes toggled at runtime by app.js that the static scanner can't see.
  safelist: [
    'hidden',
    'rotate-180',
    'opacity-0',
    'opacity-100',
    'translate-y-2',
    'pointer-events-none',
  ],
}

export default config
