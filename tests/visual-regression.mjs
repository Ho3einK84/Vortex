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
    // v1.3.0
    ['theme-flash resolver present', html.includes("getItem('vortex:theme')")],
    ['config search present', html.includes('id="config-search"')],
    ['config filters present', html.includes('id="config-filters"')],
    ['selection bar present', html.includes('id="selection-bar"')],
    ['export button present', html.includes('id="config-export"')],
    ['connection indicator present', html.includes('id="conn-indicator"')],
    ['error banner present', html.includes('id="error-banner"')],
    ['usage updated indicator present', html.includes('id="usage-updated"')],
    ['no deprecated unescape(', !html.includes('unescape(encodeURIComponent')],
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
