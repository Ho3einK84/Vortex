// Minimal visual-regression scaffold for Vortex.
// Run with: node tests/visual-regression.mjs
// Requires a local server (npm run serve) and a Chromium/Playwright environment.

import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = dirname(fileURLToPath(import.meta.url))
const DIST = join(ROOT, '..', 'dist', 'index.html')

async function run() {
  const html = await readFile(DIST, 'utf8')
  const checks = [
    ['data-island present', html.includes('id="rb-data"')],
    ['no external scripts', !html.includes('<script src=')],
    ['no external links', !html.includes('<link rel=')],
    ['base64 loader present', html.includes('__vortex_app')],
    ['brand binding present', html.includes('data-brand-name')],
    ['online count binding present', html.includes('data-online-count')],
    ['usage dashboard markup present', html.includes('usage-dashboard')],
    ['lazy apps placeholder present', html.includes('lazy-placeholder')],
  ]
  let ok = true
  for (const [name, pass] of checks) {
    console.log((pass ? '✓' : '✗') + ' ' + name)
    if (!pass) ok = false
  }
  process.exit(ok ? 0 : 1)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
