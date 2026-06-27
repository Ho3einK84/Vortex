// Vortex build — compile UnoCSS, inline fonts + CSS + JS into ONE self-contained
// dist/index.html with zero external requests, and guarantee pongo2 safety.
//
// Hard rules enforced here (see README / project spec):
//   * The ONLY template directives ({{ }} {% %} {# #}) in the output live inside the
//     #rb-data data-island and must match the known Rebecca bindings exactly.
//   * Any inlined JS (which may contain `{{`, `${...}`, etc.) is base64-encoded and
//     injected at runtime so pongo2 never parses it.
//   * The build FAILS if any inlined asset introduces a stray directive.
//
// Usage:
//   node scripts/build.mjs               full build → dist/index.html
//   node scripts/build.mjs --guard-only  re-run the directive guard on dist/index.html

import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { createGenerator } from '@unocss/core'
import * as esbuild from 'esbuild'
import unoConfig from '../uno.config.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')
const FONTS = join(ROOT, 'assets', 'fonts')
const DIST = join(ROOT, 'dist')

const GUARD_ONLY = process.argv.includes('--guard-only')

/* ----------------------------------------------------------- directive guard */

// Bindings allowed to remain (normalized: collapse inner whitespace).
const ALLOWED_DIRECTIVES = new Set(
  [
    '{{ user.username }}',
    '{{ user.status }}',
    '{{ user.status_class }}',
    '{{ user.data_limit }}',
    '{{ user.data_limit_reset_strategy }}',
    '{{ user.used_traffic }}',
    '{{ user.expire }}',
    '{{ remaining_days }}',
    '{{ user.subscription_url }}',
    '{{ usage_url }}',
    '{{ support_url }}',
    '{{ token }}',
    '{{ brand_name }}',
    '{{ user.online_count }}',
    '{{ link }}',
    '{% for link in links %}',
    '{% endfor %}',
  ].map(normalizeDirective),
)

function normalizeDirective(d) {
  return d.replace(/\s+/g, ' ').trim()
}

/**
 * Throw if the HTML contains any template directive outside the #rb-data island,
 * or any unexpected directive inside it.
 */
function guard(html) {
  const islandMatch = html.match(/<div\b[^>]*\bid="rb-data"[\s\S]*?<\/div>/)
  if (!islandMatch) {
    throw new Error('[guard] #rb-data data-island not found — bindings missing.')
  }
  const island = islandMatch[0]
  const rest = html.replace(island, '')

  // 1. No directives whatsoever outside the island.
  const strayRe = /\{\{|\}\}|\{%|%\}|\{#|#\}/g
  const strays = rest.match(strayRe)
  if (strays) {
    const ctx = []
    let m
    const re = /\{\{|\}\}|\{%|%\}|\{#|#\}/g
    while ((m = re.exec(rest)) && ctx.length < 6) {
      ctx.push(JSON.stringify(rest.slice(Math.max(0, m.index - 30), m.index + 30)))
    }
    throw new Error(
      `[guard] ${strays.length} stray template directive(s) outside data-island:\n  ` +
        ctx.join('\n  '),
    )
  }

  // 2. Every directive inside the island must be an expected binding.
  const directives = island.match(/\{\{[\s\S]*?\}\}|\{%[\s\S]*?%\}|\{#[\s\S]*?#\}/g) || []
  for (const d of directives) {
    if (!ALLOWED_DIRECTIVES.has(normalizeDirective(d))) {
      throw new Error(`[guard] Unexpected directive in data-island: ${JSON.stringify(d)}`)
    }
  }

  // 3. No external resource loads (self-contained requirement).
  const offenders = []
  if (/<link\b[^>]*\brel=/i.test(rest)) offenders.push('<link rel> tag')
  if (/<script\b[^>]*\bsrc=/i.test(html)) offenders.push('<script src> tag')
  if (/@import\b/i.test(html)) offenders.push('@import in CSS')
  if (/url\(\s*['"]?https?:/i.test(html)) offenders.push('url(http…) in CSS')
  if (offenders.length) {
    throw new Error('[guard] external resource reference(s): ' + offenders.join(', '))
  }

  console.log(
    `✓ guard: ${directives.length} binding(s) in data-island, 0 stray directives, no external loads.`,
  )
}

/* ------------------------------------------------------------------- fonts */

const EXO_RANGES = {
  latin:
    'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
  'latin-ext':
    'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
}

const ARAD_WEIGHTS = {
  Regular: 400,
  Medium: 500,
  SemiBold: 600,
  Bold: 700,
  ExtraBold: 800,
}

async function b64Font(file) {
  const buf = await readFile(join(FONTS, file))
  return buf.toString('base64')
}

async function buildFontFaces() {
  const present = existsSync(FONTS) ? await readdir(FONTS) : []
  const faces = []

  // Exo 2 — variable weight (400–900), latin + latin-ext subsets.
  for (const subset of ['latin', 'latin-ext']) {
    const file = `exo2-${subset}.woff2`
    if (!present.includes(file)) {
      throw new Error(`[fonts] missing ${file} in assets/fonts`)
    }
    const data = await b64Font(file)
    faces.push(
      `@font-face{font-family:'Exo 2';font-style:normal;font-weight:400 900;` +
        `font-display:swap;` +
        `src:url(data:font/woff2;base64,${data}) format('woff2');` +
        `unicode-range:${EXO_RANGES[subset]}}`,
    )
  }

  // Arad — static weights for Persian/Farsi.
  for (const [name, weight] of Object.entries(ARAD_WEIGHTS)) {
    const file = `Arad-${name}.woff2`
    if (!present.includes(file)) {
      throw new Error(`[fonts] missing ${file} in assets/fonts`)
    }
    const data = await b64Font(file)
    faces.push(
      `@font-face{font-family:'Arad';font-style:normal;font-weight:${weight};` +
        `font-display:swap;` +
        `src:url(data:font/woff2;base64,${data}) format('woff2')}`,
    )
  }

  return faces.join('\n')
}

/* --------------------------------------------------------------------- CSS */

async function buildCss(html, appSource) {
  const uno = createGenerator(unoConfig)
  // Feed both the markup and the JS so dynamically-built class strings are generated.
  const { css } = await uno.generate(html + '\n' + appSource, { preflights: true })
  const base = await readFile(join(SRC, 'base.css'), 'utf8')
  const fonts = await buildFontFaces()
  return `${fonts}\n${css}\n${base}`
}

/* ---------------------------------------------------------------------- JS */

async function buildJs() {
  const result = await esbuild.build({
    entryPoints: [join(SRC, 'app.js')],
    bundle: true,
    minify: true,
    format: 'iife',
    target: ['es2018'],
    charset: 'utf8',
    loader: { '.json': 'json' },
    legalComments: 'none',
    write: false,
  })
  return result.outputFiles[0].text
}

/* ------------------------------------------------------------- runtime loader */

// Tiny loader: base64 → UTF-8 bytes → source → executed <script>. Contains no
// template directives, so pongo2 leaves it untouched.
function loaderScript(b64) {
  return (
    `<script id="__vortex_app" type="application/octet-stream">${b64}</script>\n` +
    `<script>(function(){` +
    `var b=document.getElementById('__vortex_app').textContent.trim();` +
    `var bytes=Uint8Array.from(atob(b),function(c){return c.charCodeAt(0)});` +
    `var src=new TextDecoder('utf-8').decode(bytes);` +
    `var s=document.createElement('script');s.textContent=src;` +
    `document.documentElement.appendChild(s);` +
    `})();</script>`
  )
}

/* -------------------------------------------------------------------- build */

async function runGuardOnly() {
  const out = join(DIST, 'index.html')
  if (!existsSync(out)) {
    throw new Error('[guard-only] dist/index.html not found — run `npm run build` first.')
  }
  guard(await readFile(out, 'utf8'))
  console.log('✓ guard-only passed.')
}

async function build() {
  let html = await readFile(join(SRC, 'index.html'), 'utf8')
  const appSource = await readFile(join(SRC, 'app.js'), 'utf8')

  const css = await buildCss(html, appSource)
  const js = await buildJs()
  const b64 = Buffer.from(js, 'utf8').toString('base64')

  // Sanity: base64 must be brace-free (so it can never re-introduce a directive).
  if (/[{}]/.test(b64)) throw new Error('[build] base64 payload contained a brace — impossible?')

  html = html.replace('<!-- vortex:styles -->', `<style>${css}</style>`)
  html = html.replace('<!-- vortex:script -->', loaderScript(b64))

  guard(html)

  await mkdir(DIST, { recursive: true })
  const out = join(DIST, 'index.html')
  await writeFile(out, html, 'utf8')

  const kb = (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1)
  console.log(`✓ wrote ${out} (${kb} KB)`)
  console.log(`  css ${(css.length / 1024).toFixed(1)} KB · js ${(js.length / 1024).toFixed(1)} KB (base64 ${(b64.length / 1024).toFixed(1)} KB)`)
}

try {
  if (GUARD_ONLY) await runGuardOnly()
  else await build()
} catch (err) {
  console.error(err.message || err)
  process.exit(1)
}
