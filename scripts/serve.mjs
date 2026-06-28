// Local preview server for dist/index.html.
//
// Rebecca renders the template through pongo2 at request time; for local preview we
// emulate that with sample data so the page is viewable in a normal browser. This is
// a DEV tool only — it never runs in production and is not part of the bundle.
//
//   node scripts/serve.mjs            sample "active" user on http://localhost:8787
//   STATE=expired node scripts/serve.mjs   try other states (active|limited|expired|disabled|on_hold|unlimited|forever)
//
// The /usage route serves a sample 30-day history so the usage dashboard, tooltips
// and alerts are exercisable locally. Set USAGE=html to emulate Rebecca answering
// with an HTML panel page that embeds the JSON (tests the HTML-scrape fallback),
// or USAGE=empty for the "no usage data yet" state.

import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'dist', 'index.html')
const PORT = Number(process.env.PORT || 8787)
const STATE = process.env.STATE || 'active'
const USAGE = process.env.USAGE || 'json' // json | html | empty

const GB = 1024 ** 3
const DAY = 86400

const SAMPLE_LINKS = [
  'vless://11111111-2222-3333-4444-555555555555@example.com:443?type=ws&security=tls&path=%2Fvortex#Vortex%20Germany%20%F0%9F%87%A9%F0%9F%87%AA',
  'vmess://eyJ2IjoiMiIsInBzIjoiVm9ydGV4IEZpbmxhbmQiLCJhZGQiOiJleGFtcGxlLmNvbSIsInBvcnQiOiI0NDMifQ==',
  'trojan://password123@example.com:443?security=tls&type=grpc#Vortex%20Netherlands',
  'ss://YWVzLTI1Ni1nY206cGFzc3dvcmQ@example.com:8388#Vortex%20France',
]

function ctxFor(state) {
  const now = Math.floor(Date.now() / 1000)
  const base = {
    'user.username': 'alice_wonder',
    'user.status': 'active',
    'user.status_class': 'active',
    'user.data_limit': String(50 * GB),
    'user.data_limit_reset_strategy': 'month',
    'user.used_traffic': String(Math.floor(21.4 * GB)),
    'user.expire': String(now + 18 * DAY),
    remaining_days: '18',
    'user.subscription_url': 'http://localhost:' + PORT + '/sub/alice',
    usage_url: 'http://localhost:' + PORT + '/usage',
    support_url: 'https://t.me/support',
    token: 'sample-token',
  }
  switch (state) {
    case 'expired':
      base['user.status'] = 'expired'
      base['user.expire'] = String(now - 3 * DAY)
      base.remaining_days = '0'
      break
    case 'limited':
      base['user.status'] = 'limited'
      base['user.used_traffic'] = String(50 * GB)
      break
    case 'disabled':
      base['user.status'] = 'disabled'
      break
    case 'on_hold':
      base['user.status'] = 'on_hold'
      break
    case 'unlimited':
      base['user.data_limit'] = '0'
      base['user.data_limit_reset_strategy'] = 'no_reset'
      break
    case 'forever':
      base['user.expire'] = '0'
      base.remaining_days = '0'
      break
  }
  return base
}

/** A plausible 30-day usage history (bytes/day) for the local dashboard preview. */
function sampleUsage() {
  const out = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  for (let i = 29; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(d.getDate() - i)
    // Some natural-looking variation, with the odd quiet day.
    const base = 0.3 + Math.abs(Math.sin(i * 0.7)) * 1.6
    const used = i % 9 === 0 ? 0 : Math.floor(base * GB)
    out.push({ date: d.toISOString().slice(0, 10), used })
  }
  return out
}

/** Serve the usage endpoint as JSON, HTML-embedded JSON, or an empty set. */
function usageResponse(res) {
  if (USAGE === 'empty') {
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
    res.end(JSON.stringify({ history: [] }))
    return
  }
  if (USAGE === 'html') {
    // Emulate Rebecca returning an HTML panel page that embeds the JSON in a
    // <script type="application/json"> block (exercises the scrape fallback).
    const json = JSON.stringify({ history: sampleUsage() })
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(
      `<!doctype html><html><head><title>Usage</title></head><body>` +
        `<h1>Usage</h1>` +
        `<script type="application/json" id="usage-data">${json}</script>` +
        `</body></html>`,
    )
    return
  }
  res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify({ history: sampleUsage() }))
}

/** Minimal pongo2 emulation for exactly the directives Vortex uses. */
function render(html, ctx) {
  // {% for link in links %} ... {{ link }} ... {% endfor %}
  html = html.replace(
    /\{%\s*for\s+link\s+in\s+links\s*%\}([\s\S]*?)\{%\s*endfor\s*%\}/g,
    (_, body) => SAMPLE_LINKS.map((l) => body.replace(/\{\{\s*link\s*\}\}/g, l)).join(''),
  )
  // {{ key }}
  html = html.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => (ctx[key] != null ? ctx[key] : ''))
  return html
}

createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x')
    // Usage endpoint: serve sample history (JSON / HTML-embedded / empty).
    if (url.pathname === '/usage') {
      usageResponse(res)
      return
    }
    const tpl = await readFile(OUT, 'utf8')
    const state = url.searchParams.get('state') || STATE
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    res.end(render(tpl, ctxFor(state)))
  } catch (e) {
    res.writeHead(500)
    res.end(String(e))
  }
}).listen(PORT, () => {
  console.log(`Vortex preview → http://localhost:${PORT}  (state=${STATE}, usage=${USAGE})`)
  console.log('Try ?state=expired|limited|disabled|on_hold|unlimited|forever  ·  ?lang=fa  ·  ?theme=vortex-dark')
  console.log('Usage modes: USAGE=json|html|empty node scripts/serve.mjs')
})
