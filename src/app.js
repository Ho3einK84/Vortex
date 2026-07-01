// Vortex — application logic (vanilla JS, no framework).
//
// Responsibilities: read the Rebecca data-island, drive i18n + RTL + Persian digits,
// theme switching, the dual progress rings, quota-reset countdown, config list with
// copy / QR, OS-grouped app importers, offline handling and graceful state rendering.
//
// The entire bundle is base64-injected at runtime by the build, so pongo2 never sees
// any of this source — only the data-island bindings remain as live template tags.

import { STRINGS, toFaDigits, locNum, fmtDate } from './i18n.js'
import { icon } from './icons.js'
import APPS from './apps.json'

// `qr.js` (and the qrcode-generator library it wraps, ~21KB minified — a quarter
// of the whole app bundle) is intentionally NOT imported here. It's built as its
// own tiny ES module by scripts/build.mjs and embedded as a second, inert
// base64 blob (#__vortex_qr) so its parsing/execution cost is only paid the
// first time a user actually opens a QR modal — see loadQrSvg() below.

/* ------------------------------------------------------------------ helpers */

const $ = (sel, root = document) => root.querySelector(sel)
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel))

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n))

/** Parse a value that may be a string/number/empty into a finite number or 0. */
function num(v) {
  if (v == null) return 0
  const n = typeof v === 'number' ? v : parseFloat(String(v).trim())
  return Number.isFinite(n) ? n : 0
}

/** Truthy guard for ints that the server may emit as "", "0", "false", etc. */
function hasValue(v) {
  if (v == null) return false
  const s = String(v).trim().toLowerCase()
  return s !== '' && s !== '0' && s !== 'false' && s !== 'none' && s !== 'null'
}

const reduceMotion =
  typeof matchMedia === 'function' &&
  matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * Fallback brand name when the panel's `{{ brand_name }}` binding is empty.
 * Read from a plain-text <meta name="vortex-brand"> in <head> (not hardcoded
 * here) so a self-hoster can rebrand an already-built dist/index.html with a
 * one-line `sed` on the server, with no rebuild and no touching the base64 JS.
 */
function defaultBrand() {
  const meta = document.querySelector('meta[name="vortex-brand"]')
  return (meta && meta.content.trim()) || 'Vortex'
}

/* --------------------------------------------------------- read data-island */

function readContext() {
  const el = $('#rb-data')
  const d = el ? el.dataset : {}

  // links: newline-separated inside a <script type="text/plain">.
  let links = []
  const linkNode = $('#rb-links')
  if (linkNode) {
    links = linkNode.textContent
      .split(/\r?\n/)
      .map((s) => s.trim())
      // Accept any scheme-prefixed URI (some valid config schemes omit the `//`,
      // e.g. ss:// vs. proprietary `scheme:` deep links). Require a scheme, but
      // reject script-bearing schemes so a hostile config line can't smuggle one in.
      .filter((s) => {
        if (!s || !/^[a-z][a-z0-9+.-]*:/i.test(s)) return false
        const scheme = s.slice(0, s.indexOf(':')).toLowerCase()
        return scheme !== 'javascript' && scheme !== 'data' && scheme !== 'vbscript'
      })
  }

  let subUrl = (d.subscriptionUrl || '').trim()
  if (!/^https?:\/\//i.test(subUrl)) {
    // Derive an absolute URL when the server handed us a relative one (or none).
    subUrl = location.origin + location.pathname
  }

  return {
    username: (d.username || '').trim() || '—',
    brandName: (d.brandName || '').trim() || defaultBrand(),
    onlineCount: num(d.onlineCount),
    status: (d.status || '').trim().toLowerCase(),
    statusClass: (d.statusClass || '').trim(),
    dataLimit: num(d.dataLimit),
    dataLimitRaw: d.dataLimit,
    resetStrategy: (d.resetStrategy || 'no_reset').trim().toLowerCase(),
    usedTraffic: num(d.usedTraffic),
    expire: num(d.expire),
    expireRaw: d.expire,
    remainingDays: num(d.remainingDays),
    subUrl,
    usageUrl: (d.usageUrl || '').trim(),
    supportUrl: (d.supportUrl || '').trim(),
    token: (d.token || '').trim(),
    links,
  }
}

/* ------------------------------------------------------------ state derivation */

/** Normalize the effective state from server status + computed conditions. */
function deriveState(ctx) {
  const s = ctx.status
  if (s === 'disabled') return 'disabled'
  if (s === 'on_hold') return 'on_hold'
  if (s === 'expired') return 'expired'
  if (s === 'limited') return 'limited'

  // Fall back to computed conditions when status is "active"/unknown.
  const expired = hasValue(ctx.expireRaw) && ctx.expire * 1000 < Date.now()
  if (expired) return 'expired'
  const limited =
    hasValue(ctx.dataLimitRaw) &&
    ctx.dataLimit > 0 &&
    ctx.usedTraffic >= ctx.dataLimit
  if (limited) return 'limited'

  return s === 'active' || s === '' ? 'active' : s
}

/* ----------------------------------------------------------------- formatting */

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']

/** Human-readable byte size, returning { value, unit } so the unit can be styled. */
function fmtBytes(bytes) {
  bytes = Math.max(0, num(bytes))
  if (bytes < 1) return { value: '0', unit: 'B' }
  let i = 0
  let v = bytes
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024
    i++
  }
  const value = v >= 100 || i === 0 ? Math.round(v).toString() : v.toFixed(v >= 10 ? 1 : 2)
  return { value, unit: UNITS[i] }
}

/* ------------------------------------------------------------------- i18n/theme */

let lang = 'en'
let theme = 'vortex-light'

function t(key) {
  return (STRINGS[lang] && STRINGS[lang][key]) || STRINGS.en[key] || key
}

function applyI18n() {
  const dict = STRINGS[lang] || STRINGS.en
  document.documentElement.lang = lang
  document.documentElement.dir = dict.dir
  $$('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n')
    if (dict[key] != null) el.textContent = dict[key]
  })
  // Placeholder attributes (search input, etc.).
  $$('[data-i18n-ph]').forEach((el) => {
    const key = el.getAttribute('data-i18n-ph')
    if (dict[key] != null) el.setAttribute('placeholder', dict[key])
  })
  // Title/tooltip attributes (icon-only tool buttons).
  $$('[data-i18n-title]').forEach((el) => {
    const key = el.getAttribute('data-i18n-title')
    if (dict[key] != null) {
      el.setAttribute('title', dict[key])
      el.setAttribute('aria-label', dict[key])
    }
  })
  // Re-render dynamic, number-bearing sections so digits/labels follow the language.
  renderDynamic()
}

function persist(key, value) {
  try {
    localStorage.setItem(key, value)
  } catch (e) {
    /* storage-optional: ignore quota / privacy-mode errors */
  }
}

function read(key) {
  try {
    return localStorage.getItem(key)
  } catch (e) {
    return null
  }
}

function setTheme(next) {
  theme = next === 'vortex-dark' ? 'vortex-dark' : 'vortex-light'
  document.documentElement.setAttribute('data-theme', theme)
  persist('vortex:theme', theme)
  const btn = $('#theme-toggle')
  if (btn) {
    btn.querySelector('[data-slot=icon]').innerHTML = icon(
      theme === 'vortex-dark' ? 'sun' : 'moon',
    )
  }
  // Keep PWA manifest + browser chrome colour in step with the theme (Bug #13).
  if (CTX) installManifest()
  else {
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', themeColor('--paper', '#111111'))
  }
}

function setLang(next) {
  lang = next === 'fa' ? 'fa' : 'en'
  persist('vortex:lang', lang)
  const btn = $('#lang-toggle')
  if (btn) btn.querySelector('[data-slot=label]').textContent = lang === 'fa' ? 'EN' : 'فا'
  applyI18n()
}

/* ----------------------------------------------------------------------- rings */

const RING_R = 52
const RING_CIRC = 2 * Math.PI * RING_R

/** Animate (or snap) a ring to `fraction` (0..1). null = indeterminate/unlimited. */
function setRing(id, fraction) {
  const circle = $('#' + id + ' .ring-value')
  if (!circle) return
  circle.style.strokeDasharray = RING_CIRC.toFixed(2)
  if (fraction == null) {
    // indeterminate (unlimited / never): show a full faint track, no value arc.
    circle.style.strokeDashoffset = RING_CIRC.toFixed(2)
    return
  }
  const f = clamp(fraction, 0, 1)
  const offset = RING_CIRC * (1 - f)
  if (reduceMotion) {
    circle.style.transition = 'none'
  }
  // Force a reflow-free assignment; CSS handles the transition.
  circle.style.strokeDashoffset = offset.toFixed(2)
}

/* ------------------------------------------------------------- number counters */

const countAnims = new WeakMap()

/**
 * Tween an element's text from 0 → `to`, formatting each frame via `fmt`.
 * Re-entrant (cancels any in-flight tween on the same element) and a no-op under
 * reduced-motion. `snap` forces the final value immediately (used on re-renders so
 * the count-up only plays once, on first reveal).
 */
function animateCount(el, to, fmt, snap) {
  if (!el) return
  const prev = countAnims.get(el)
  if (prev) cancelAnimationFrame(prev)
  if (snap || reduceMotion) {
    el.textContent = fmt(to)
    return
  }
  const start = performance.now()
  const dur = 900
  const step = (now) => {
    const p = clamp((now - start) / dur, 0, 1)
    // easeOutCubic
    const eased = 1 - Math.pow(1 - p, 3)
    el.textContent = fmt(to * eased)
    if (p < 1) countAnims.set(el, requestAnimationFrame(step))
    else countAnims.delete(el)
  }
  countAnims.set(el, requestAnimationFrame(step))
}

/* --------------------------------------------------------------- subscription */

let CTX = null
let STATE = 'active'
let cardAnimated = false // count-up plays only on the first card render

function importUrl(template) {
  const url = CTX.subUrl
  let b64 = ''
  try {
    b64 = utf8ToBase64(url)
  } catch (e) {
    b64 = ''
  }
  return template
    .replace(/\{url_enc\}/g, encodeURIComponent(url))
    .replace(/\{url_b64\}/g, b64)
    .replace(/\{url\}/g, url)
    .replace(/\{name\}/g, encodeURIComponent(CTX.username))
}

/* ------------------------------------------------------------------ clipboard */

async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch (e) {
    /* fall through to legacy path */
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch (e) {
    return false
  }
}

let toastTimer = null
function toast(msg) {
  const el = $('#toast')
  if (!el) return
  el.textContent = msg
  el.classList.remove('hidden')
  // restart enter animation
  el.classList.remove('toast-in')
  void el.offsetWidth
  el.classList.add('toast-in')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => el.classList.add('hidden'), 1800)
}

/* ----------------------------------------------------------------- QR modal */

let lastFocus = null
let qrSvgFn = null
let qrSvgPromise = null

/**
 * Decode + dynamically import the QR sub-bundle embedded by the build as a
 * second inert base64 blob (#__vortex_qr), exactly once, then cache its
 * `qrSvg` export. Uses the same "base64 → bytes → Blob → self-contained
 * execution" trick as the service worker registration below, so this never
 * triggers a network request.
 */
function loadQrSvg() {
  if (qrSvgFn) return Promise.resolve(qrSvgFn)
  if (qrSvgPromise) return qrSvgPromise
  qrSvgPromise = (async () => {
    const el = document.getElementById('__vortex_qr')
    const bytes = Uint8Array.from(atob(el.textContent.trim()), (c) => c.charCodeAt(0))
    const src = new TextDecoder('utf-8').decode(bytes)
    const url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }))
    try {
      const mod = await import(url)
      qrSvgFn = mod.qrSvg
      return qrSvgFn
    } finally {
      URL.revokeObjectURL(url)
    }
  })()
  return qrSvgPromise
}

async function openQr(title, text) {
  lastFocus = document.activeElement
  const modal = $('#qr-modal')
  $('#qr-modal-title').textContent = title
  $('#qr-modal-text').textContent = text
  // Placeholder while the QR sub-bundle loads (instant on every call after the
  // first, since loadQrSvg() caches its result).
  $('#qr-modal-canvas').innerHTML = `<span class="muted text-xs">${escapeHtml(t('qr_loading'))}</span>`
  modal.classList.remove('hidden')
  modal.setAttribute('aria-hidden', 'false')
  // focus trap: move focus to close button, then constrain Tab.
  $('#qr-modal-close').focus()
  document.addEventListener('keydown', trapFocus)

  const dark = theme === 'vortex-dark' ? '#f4f1e8' : '#0a0a0a'
  const light = theme === 'vortex-dark' ? '#0a0a0a' : '#ffffff'
  try {
    const svg = await loadQrSvg()
    if (modal.classList.contains('hidden')) return // closed before it loaded
    $('#qr-modal-canvas').innerHTML = svg(text, { dark, light, margin: 2, errorText: t('qr_too_long') })
  } catch (e) {
    if (modal.classList.contains('hidden')) return
    $('#qr-modal-canvas').innerHTML = `<span class="muted text-xs">${escapeHtml(t('qr_load_error'))}</span>`
  }
}

function closeQr() {
  const modal = $('#qr-modal')
  modal.classList.add('hidden')
  modal.setAttribute('aria-hidden', 'true')
  document.removeEventListener('keydown', trapFocus)
  if (lastFocus && lastFocus.focus) lastFocus.focus()
}

function trapFocus(e) {
  if (e.key !== 'Tab') return
  const modal = $('#qr-modal')
  const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
  if (!focusable.length) return
  const first = focusable[0]
  const last = focusable[focusable.length - 1]
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault()
    first.focus()
  }
}

/* --------------------------------------------------------------- render: card */

function renderCard() {
  const used = CTX.usedTraffic
  const limit = CTX.dataLimit
  const unlimited = !hasValue(CTX.dataLimitRaw) || limit <= 0

  // username + status badge
  $('#username').textContent = CTX.username
  const badge = $('#status-badge')
  badge.textContent = t('status_' + STATE) || t('status_unknown')
  // Surface the server-provided status_class as a styling hook (was read but unused).
  if (CTX.statusClass) badge.setAttribute('data-status-class', CTX.statusClass)
  $('#service-card').setAttribute('data-state', STATE)
  $('#app').setAttribute('data-state', STATE)

  // Build a count-up formatter that matches the decimal precision of `finalStr`.
  const numFmt = (finalStr) => {
    const dot = String(finalStr).indexOf('.')
    const dec = dot >= 0 ? String(finalStr).length - dot - 1 : 0
    return (n) => locNum(n.toFixed(dec), lang)
  }
  const snap = cardAnimated

  // ---- data ring + stats
  const usedF = fmtBytes(used)
  animateCount($('#stat-used-val'), parseFloat(usedF.value) || 0, numFmt(usedF.value), snap)
  $('#stat-used-unit').textContent = usedF.unit

  if (unlimited) {
    setRing('ring-data', null)
    $('#ring-data-pct').innerHTML = icon('infinity')
    $('#ring-data-pct').classList.add('is-infinity')
    $('#stat-total-val').innerHTML = icon('infinity')
    $('#stat-total-unit').textContent = ''
    $('#ring-data').classList.remove('is-urgent')
  } else {
    const frac = clamp(used / limit, 0, 1)
    setRing('ring-data', frac)
    // Urgent glow once usage crosses 90%.
    $('#ring-data').classList.toggle('is-urgent', frac >= 0.9)
    const pct = Math.round(frac * 100)
    $('#ring-data-pct').textContent = locNum(pct, lang) + (lang === 'fa' ? '٪' : '%')
    $('#ring-data-pct').classList.remove('is-infinity')
    const totalF = fmtBytes(limit)
    animateCount($('#stat-total-val'), parseFloat(totalF.value) || 0, numFmt(totalF.value), snap)
    $('#stat-total-unit').textContent = totalF.unit
    const remF = fmtBytes(Math.max(0, limit - used))
    animateCount($('#stat-remaining-val'), parseFloat(remF.value) || 0, numFmt(remF.value), snap)
    $('#stat-remaining-unit').textContent = remF.unit
  }
  if (unlimited) {
    $('#stat-remaining-val').innerHTML = icon('infinity')
    $('#stat-remaining-unit').textContent = ''
  }

  // ---- time ring + expiry
  const neverExpire = !hasValue(CTX.expireRaw)
  if (neverExpire) {
    setRing('ring-time', null)
    $('#ring-time-pct').innerHTML = icon('infinity')
    $('#ring-time-pct').classList.add('is-infinity')
    $('#stat-expire-val').textContent = t('never')
    $('#stat-expire-unit').textContent = ''
    $('#ring-time').classList.remove('is-urgent')
  } else {
    const nowSec = Date.now() / 1000
    const remainingSec = Math.max(0, CTX.expire - nowSec)
    // Always derive the remaining duration client-side from `expire`; `remaining_days`
    // is precomputed server-side without a now() and can be stale by the time the page
    // loads, so it is only used as a fallback when `expire` is unavailable.
    const remainingDaysForCycle = Math.max(CTX.remainingDays, remainingSec / 86400)
    const cycleDays = remainingDaysForCycle <= 1 ? 1
      : remainingDaysForCycle <= 7 ? 7
        : remainingDaysForCycle <= 31 ? 31
          : remainingDaysForCycle <= 93 ? 93
            : remainingDaysForCycle <= 366 ? 366
              : remainingDaysForCycle
    const total = Math.max(remainingSec, cycleDays * 86400)
    const frac = total > 0 ? clamp(remainingSec / total, 0, 1) : 0
    setRing('ring-time', frac)
    $('#ring-time-pct').classList.remove('is-infinity')
    // Urgent glow when less than 10% of the cycle remains.
    $('#ring-time').classList.toggle('is-urgent', frac <= 0.1)

    // Prefer the live client-side computation; fall back to the server value only
    // when `expire` did not yield a usable remaining duration.
    const days =
      remainingSec > 0
        ? Math.max(0, Math.ceil(remainingSec / 86400))
        : CTX.remainingDays > 0
          ? Math.round(CTX.remainingDays)
          : 0
    $('#ring-time-pct').textContent = locNum(days, lang)
    $('#ring-time-days').textContent = days === 1 ? t('day_unit') : t('days_unit')

    const expDate = new Date(CTX.expire * 1000)
    const dStr = fmtDate(expDate, lang, { month: 'short' })
    $('#stat-expire-val').textContent = dStr
    $('#stat-expire-unit').textContent = ''
  }

  // ---- quota reset countdown
  renderReset()

  // ---- state note
  const note = $('#state-note')
  const noteKey =
    STATE === 'expired'
      ? 'expired_note'
      : STATE === 'limited'
        ? 'limited_note'
        : STATE === 'disabled'
          ? 'disabled_note'
          : STATE === 'on_hold'
            ? 'on_hold_note'
            : ''
  if (noteKey) {
    note.textContent = t(noteKey)
    note.classList.remove('hidden')
  } else {
    note.classList.add('hidden')
  }

  // ---- usage dashboard
  renderUsageDashboard()

  // First paint is done — subsequent renders (e.g. language switch) snap, not tween.
  cardAnimated = true
}

/* ---------------------------------------------------------- quota reset timer */

let resetTimer = null

function nextResetDate(strategy) {
  const now = new Date()
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  switch (strategy) {
    case 'day':
      d.setDate(d.getDate() + 1)
      return d
    case 'week': {
      // next Monday
      const day = d.getDay() // 0 Sun .. 6 Sat
      const add = ((8 - (day === 0 ? 7 : day)) % 7) || 7
      d.setDate(d.getDate() + add)
      return d
    }
    case 'month':
      return new Date(now.getFullYear(), now.getMonth() + 1, 1)
    case 'year':
      return new Date(now.getFullYear() + 1, 0, 1)
    default:
      return null
  }
}

function renderReset() {
  const strategy = CTX.resetStrategy
  const row = $('#reset-row')
  clearInterval(resetTimer)

  const labelMap = {
    no_reset: 'reset_no',
    day: 'reset_daily',
    week: 'reset_weekly',
    month: 'reset_monthly',
    year: 'reset_yearly',
  }
  $('#reset-strategy').textContent = t(labelMap[strategy] || 'reset_no')

  const target = nextResetDate(strategy)
  if (!target || STATE === 'expired' || STATE === 'disabled') {
    row.setAttribute('data-active', 'false')
    $('#reset-countdown').textContent = ''
    $('#reset-label').classList.add('hidden')
    return
  }
  row.setAttribute('data-active', 'true')
  $('#reset-label').classList.remove('hidden')

  const tick = () => {
    let diff = Math.max(0, target.getTime() - Date.now())
    const dd = Math.floor(diff / 86400000)
    diff -= dd * 86400000
    const hh = Math.floor(diff / 3600000)
    diff -= hh * 3600000
    const mm = Math.floor(diff / 60000)
    diff -= mm * 60000
    const ss = Math.floor(diff / 1000)
    const pad = (n) => String(n).padStart(2, '0')
    const parts = []
    // Persian: space + full day word ("روز") rather than the stray "ر" glyph.
    if (dd > 0) parts.push(locNum(dd, lang) + (lang === 'fa' ? ' ' + t('days_unit') : 'd'))
    parts.push(locNum(pad(hh), lang) + ':' + locNum(pad(mm), lang) + ':' + locNum(pad(ss), lang))
    $('#reset-countdown').textContent = parts.join(' ')
  }
  tick()
  resetTimer = setInterval(tick, 1000)
}

/* --------------------------------------------------------- render: configs */

// Config view state: search text, active protocol filter, bulk-selection mode,
// and (v1.4.0) whether configs are grouped by country.
let configSearch = ''
let configProtocol = 'all'
let selectionMode = false
let groupByCountry = false
const selectedLinks = new Set()

/** Upper-case protocol scheme of a config URI (VLESS, VMESS, TROJAN, SS, …). */
function protocolOf(uri) {
  const m = uri.match(/^([a-z0-9+.-]+):/i)
  return m ? m[1].toUpperCase() : 'OTHER'
}

/* ----------------------------------------------- v1.4.0: country grouping */

// ISO-3166 alpha-2 → display name, for grouping configs by server country. Kept to a
// common-VPN-country subset; anything unmatched falls under the "Other" group.
const COUNTRIES = {
  US: 'United States', GB: 'United Kingdom', DE: 'Germany', NL: 'Netherlands',
  FR: 'France', FI: 'Finland', SE: 'Sweden', NO: 'Norway', DK: 'Denmark',
  IE: 'Ireland', IS: 'Iceland', CH: 'Switzerland', AT: 'Austria', BE: 'Belgium',
  IT: 'Italy', ES: 'Spain', PT: 'Portugal', PL: 'Poland', CZ: 'Czechia',
  RO: 'Romania', RU: 'Russia', UA: 'Ukraine', TR: 'Turkey', AE: 'United Arab Emirates',
  QA: 'Qatar', SA: 'Saudi Arabia', IR: 'Iran', IN: 'India', SG: 'Singapore',
  JP: 'Japan', KR: 'South Korea', HK: 'Hong Kong', TW: 'Taiwan', CN: 'China',
  AU: 'Australia', CA: 'Canada', BR: 'Brazil', AM: 'Armenia', AZ: 'Azerbaijan',
  GE: 'Georgia', KZ: 'Kazakhstan', LT: 'Lithuania', LV: 'Latvia', EE: 'Estonia',
}

// Aliases / name needles → code (longest needles matched first to avoid e.g. "Iran"
// colliding with "Ireland"). Built once from COUNTRIES plus a few common aliases.
const COUNTRY_NEEDLES = (() => {
  const extra = {
    'united states': 'US', usa: 'US', america: 'US',
    'united kingdom': 'GB', uk: 'GB', england: 'GB', britain: 'GB',
    holland: 'NL', deutschland: 'DE', türkiye: 'TR', turkiye: 'TR',
    'south korea': 'KR', korea: 'KR', 'hong kong': 'HK', emirates: 'AE', uae: 'AE',
  }
  const map = new Map()
  for (const [code, name] of Object.entries(COUNTRIES)) map.set(name.toLowerCase(), code)
  for (const [needle, code] of Object.entries(extra)) map.set(needle, code)
  return [...map.entries()].sort((a, b) => b[0].length - a[0].length)
})()

/** Regional-indicator pair (🇩🇪) → ISO code (DE), or null when no flag is present. */
function codeFromFlag(str) {
  const cps = Array.from(String(str))
    .map((c) => c.codePointAt(0))
    .filter((cp) => cp >= 0x1f1e6 && cp <= 0x1f1ff)
  if (cps.length < 2) return null
  return String.fromCharCode(cps[0] - 0x1f1e6 + 65) + String.fromCharCode(cps[1] - 0x1f1e6 + 65)
}

/** ISO code (DE) → flag emoji (🇩🇪). */
function flagOf(code) {
  return code.replace(/[A-Z]/g, (c) => String.fromCodePoint(0x1f1e6 + c.charCodeAt(0) - 65))
}

/**
 * Detect a config's server country from its remark — first via a flag emoji, then by
 * matching a country name/alias as a whole word. Returns { code, name, flag } or null.
 */
function countryOf(label) {
  const fromFlag = codeFromFlag(label)
  if (fromFlag) {
    return { code: fromFlag, name: COUNTRIES[fromFlag] || fromFlag, flag: flagOf(fromFlag) }
  }
  const low = label.toLowerCase()
  for (const [needle, code] of COUNTRY_NEEDLES) {
    const re = new RegExp('(^|[^a-z])' + needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^a-z]|$)', 'i')
    if (re.test(low)) return { code, name: COUNTRIES[code] || code, flag: flagOf(code) }
  }
  return null
}

/** Links passing the current search + protocol filter, carrying their 1-based index. */
function filteredConfigs() {
  const q = configSearch.trim().toLowerCase()
  return CTX.links
    .map((link, i) => ({ link, i, name: labelForConfig(link, i), proto: protocolOf(link) }))
    .filter((r) => configProtocol === 'all' || r.proto === configProtocol)
    .filter(
      (r) =>
        !q ||
        r.name.toLowerCase().includes(q) ||
        r.proto.toLowerCase().includes(q) ||
        r.link.toLowerCase().includes(q),
    )
}

/** Build the All / protocol filter pills from the protocols actually present. */
function renderConfigFilters() {
  const wrap = $('#config-filters')
  if (!wrap) return
  const protos = []
  CTX.links.forEach((l) => {
    const p = protocolOf(l)
    if (!protos.includes(p)) protos.push(p)
  })
  // Hide the bar entirely when there is nothing meaningful to filter.
  if (CTX.links.length === 0 || protos.length <= 1) {
    wrap.innerHTML = ''
    wrap.classList.add('hidden')
    return
  }
  wrap.classList.remove('hidden')
  if (!protos.includes(configProtocol)) configProtocol = 'all'

  const pills = [['all', t('filter_all')], ...protos.map((p) => [p, p])]
  wrap.innerHTML = pills
    .map(
      ([val, label]) =>
        `<button class="filter-pill" role="tab" data-proto="${escapeAttr(val)}" ` +
        `aria-selected="${val === configProtocol}">${escapeHtml(label)}</button>`,
    )
    .join('')
  $$('.filter-pill', wrap).forEach((btn) => {
    btn.addEventListener('click', () => {
      configProtocol = btn.getAttribute('data-proto')
      renderConfigFilters()
      renderConfigs()
    })
  })
}

function renderConfigs() {
  const list = $('#configs-list')
  const links = CTX.links
  $('#configs-count').textContent = locNum(links.length, lang)
  list.innerHTML = ''
  list.classList.toggle('is-selecting', selectionMode)

  updateConfigButtons()
  updateSelectionBar()

  if (!links.length) {
    const empty = document.createElement('div')
    empty.className = 'muted text-sm py-4 text-center'
    empty.textContent = t('no_configs')
    list.appendChild(empty)
    return
  }

  const rows = filteredConfigs()
  if (!rows.length) {
    const empty = document.createElement('div')
    empty.className = 'muted text-sm py-4 text-center'
    empty.textContent = t('no_match')
    list.appendChild(empty)
    return
  }

  if (groupByCountry) {
    renderGroupedConfigs(list, rows)
  } else {
    rows.forEach((r) => list.appendChild(buildConfigRow(r)))
  }
}

/** Build one interactive config row (copy / QR / select), shared by both layouts. */
function buildConfigRow({ link, i, name }) {
  const row = document.createElement('div')
  row.className = 'config-row'
  row.setAttribute('tabindex', '0')
  row.dataset.link = link
  row.innerHTML = `
      <label class="config-check" aria-label="${t('select_label')}">
        <input type="checkbox" ${selectedLinks.has(link) ? 'checked' : ''} />
      </label>
      <div class="config-meta">
        <span class="config-index">${locNum(i + 1, lang)}</span>
        <div class="config-name" dir="auto" title="${escapeAttr(link)}">${escapeHtml(name)}</div>
      </div>
      <div class="config-actions">
        <button class="icon-btn" data-act="qr" aria-label="${t('show_qr')}">${icon('qr')}</button>
        <button class="icon-btn" data-act="copy" aria-label="${t('copy')}">${icon('copy')}</button>
      </div>`
  row.querySelector('[data-act=copy]').addEventListener('click', async (e) => {
    e.stopPropagation()
    const ok = await copyText(link)
    toast(ok ? t('copied') : '✕')
  })
  row.querySelector('[data-act=qr]').addEventListener('click', (e) => {
    e.stopPropagation()
    openQr(name, link)
  })
  const cb = row.querySelector('input[type=checkbox]')
  cb.addEventListener('change', () => {
    if (cb.checked) selectedLinks.add(link)
    else selectedLinks.delete(link)
    updateSelectionBar()
  })
  return row
}

/** v1.4.0 — render rows grouped under country headers (largest groups first). */
function renderGroupedConfigs(list, rows) {
  const groups = new Map()
  rows.forEach((r) => {
    const c = countryOf(r.name)
    const key = c ? c.code : '_other'
    if (!groups.has(key)) {
      groups.set(key, {
        flag: c ? c.flag : '🏳️',
        name: c ? c.name : t('country_other'),
        isOther: !c,
        items: [],
      })
    }
    groups.get(key).items.push(r)
  })
  // Largest groups first; the catch-all "Other" group is always pinned last.
  const ordered = [...groups.values()].sort((a, b) => {
    if (a.isOther !== b.isOther) return a.isOther ? 1 : -1
    return b.items.length - a.items.length
  })
  ordered.forEach((g) => {
    const head = document.createElement('div')
    head.className = 'config-group-head'
    head.innerHTML =
      `<span class="cg-flag">${escapeHtml(g.flag)}</span>` +
      `<span class="cg-name" dir="auto">${escapeHtml(g.name)}</span>` +
      `<span class="cg-count">${locNum(g.items.length, lang)}</span>`
    list.appendChild(head)
    g.items.forEach((r) => list.appendChild(buildConfigRow(r)))
  })
}

/** Enable/disable the bulk action buttons when there are zero configs. */
function updateConfigButtons() {
  const empty = !CTX.links.length
  ;['#copy-all', '#sub-qr-btn', '#config-export', '#config-select-toggle', '#config-group-toggle'].forEach((sel) => {
    const el = $(sel)
    if (!el) return
    el.classList.toggle('is-disabled', empty)
    if (empty) el.setAttribute('disabled', '')
    else el.removeAttribute('disabled')
  })
}

function updateSelectionBar() {
  const bar = $('#selection-bar')
  if (!bar) return
  bar.classList.toggle('hidden', !selectionMode)
  $('#selection-count').textContent = locNum(selectedLinks.size, lang)
  const copyBtn = $('#copy-selected')
  if (copyBtn) copyBtn.classList.toggle('is-disabled', selectedLinks.size === 0)
}

function toggleSelectionMode() {
  selectionMode = !selectionMode
  if (!selectionMode) selectedLinks.clear()
  const btn = $('#config-select-toggle')
  if (btn) {
    btn.setAttribute('aria-pressed', String(selectionMode))
    const label = btn.querySelector('[data-i18n-dyn]')
    if (label) {
      label.setAttribute('data-i18n-dyn', selectionMode ? 'select_done' : 'select_label')
      label.textContent = t(selectionMode ? 'select_done' : 'select_label')
    }
  }
  renderConfigs()
}

/** v1.4.0 — toggle grouping configs by detected server country. */
function toggleGroupByCountry() {
  groupByCountry = !groupByCountry
  const btn = $('#config-group-toggle')
  if (btn) btn.setAttribute('aria-pressed', String(groupByCountry))
  renderConfigs()
}

/** Download all configs as a plain-text file (one URI per line). */
function exportConfigs() {
  if (!CTX.links.length) return
  const blob = new Blob([CTX.links.join('\n') + '\n'], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const safeName = (CTX.username || 'vortex').replace(/[^a-z0-9_-]+/gi, '_')
  a.download = safeName + '-configs.txt'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  toast(t('export_done'))
}

/** Arrow-key navigation across config rows: ↑/↓ move, Enter copies, Space → QR. */
function onConfigKeydown(e) {
  const rows = $$('#configs-list .config-row')
  if (!rows.length) return
  const active = document.activeElement
  const idx = rows.indexOf(active)
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    rows[idx < 0 ? 0 : Math.min(rows.length - 1, idx + 1)].focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    rows[idx <= 0 ? 0 : idx - 1].focus()
  } else if (idx >= 0 && (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar')) {
    const link = active.dataset.link
    if (!link) return
    e.preventDefault()
    if (e.key === 'Enter') {
      copyText(link).then((ok) => toast(ok ? t('copied') : '✕'))
    } else {
      const realIdx = CTX.links.indexOf(link)
      openQr(labelForConfig(link, realIdx < 0 ? 0 : realIdx), link)
    }
  }
}

/** Derive a friendly label from a config URI (protocol + #fragment remark). */
function labelForConfig(uri, i) {
  try {
    const hash = uri.indexOf('#')
    if (hash >= 0) {
      const remark = decodeURIComponent(uri.slice(hash + 1)).trim()
      if (remark) return remark
    }
  } catch (e) {
    /* ignore malformed escapes */
  }
  const proto = (uri.match(/^([a-z0-9+.-]+):\/\//i) || [])[1]
  return (proto ? proto.toUpperCase() : 'CONFIG') + ' ' + (i + 1)
}

/* ------------------------------------------------------------ render: apps */

let appsRendered = false

function osIconName(osId) {
  return {
    android: 'android',
    ios: 'apple',
    macos: 'apple',
    windows: 'windows',
    linux: 'linux',
  }[osId] || 'download'
}

function renderApps(force) {
  // First call renders; later calls only re-render when explicitly forced (e.g. a
  // language switch) AND the section was already built, so labels follow the language
  // without losing the user's expand/collapse choices (Bug #2).
  if (appsRendered && !force) return
  if (force && !appsRendered) return
  const wrap = $('#apps-list')

  // Preserve which OS groups are open across a forced re-render.
  const openState = {}
  $$('.os-group', wrap).forEach((g) => {
    const head = g.querySelector('.os-head')
    const id = g.dataset.os
    if (head && id) openState[id] = head.getAttribute('aria-expanded') === 'true'
  })

  appsRendered = true
  wrap.innerHTML = ''
  const osList = (APPS && APPS.os) || []

  osList.forEach((group, gi) => {
    const expanded = group.id in openState ? openState[group.id] : gi === 0
    const section = document.createElement('div')
    section.className = 'os-group'
    section.dataset.os = group.id
    section.innerHTML = `
      <button class="os-head" data-act="toggle" aria-expanded="${expanded}">
        <span class="os-name"><span class="os-icon">${icon(osIconName(group.id))}</span>${escapeHtml(group.name)}</span>
        <span class="os-chevron">${icon('chevron')}</span>
      </button>
      <div class="os-body${expanded ? '' : ' hidden'}"></div>`
    const body = section.querySelector('.os-body')
    const list = document.createElement('div')
    if (group.apps.length > 3) list.className = 'apps-scroll'
    body.appendChild(list)

    group.apps.forEach((app) => {
      const card = document.createElement('div')
      card.className = 'app-row'
      let actions = ''
      if (app.import) {
        actions += `<a class="app-btn app-import" href="${escapeAttr(
          importUrl(app.import),
        )}">${icon('bolt')}<span data-i18n-dyn="import_app">${t('import_app')}</span></a>`
      }
      if (app.download) {
        actions += `<a class="app-btn app-get" href="${escapeAttr(
          app.download,
        )}" target="_blank" rel="noopener noreferrer">${icon('download')}<span data-i18n-dyn="download_app">${t(
          'download_app',
        )}</span></a>`
      }
      card.innerHTML = `
        <div class="app-os-icon">${icon(osIconName(group.id))}</div>
        <div class="app-name">${escapeHtml(app.name)}</div>
        <div class="app-actions">${actions}</div>`
      list.appendChild(card)
    })

    section.querySelector('[data-act=toggle]').addEventListener('click', (e) => {
      const head = e.currentTarget
      const expanded = head.getAttribute('aria-expanded') === 'true'
      head.setAttribute('aria-expanded', String(!expanded))
      body.classList.toggle('hidden', expanded)
    })

    wrap.appendChild(section)
  })
}

function lazyLoadApps() {
  const wrap = $('#apps-list')
  if (!wrap || appsRendered) return
  // Render immediately if already visible, else observe once.
  const section = $('#apps-section')
  if (!section) {
    renderApps()
    return
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          renderApps()
          io.disconnect()
        }
      },
      { rootMargin: '100px' },
    )
    io.observe(section)
  } else {
    renderApps()
  }
}

/* ------------------------------------------------------------- misc render */

function renderLinks() {
  const sup = $('#support-link')
  if (sup) {
    if (CTX.supportUrl) {
      sup.href = CTX.supportUrl
      sup.classList.remove('hidden')
    } else sup.classList.add('hidden')
  }
  // The footer "Usage" button used to open Rebecca's raw JSON endpoint in a new tab;
  // the in-card usage dashboard now renders that data as a chart, so the external
  // link is intentionally gone to avoid showing the bare JSON page.
}

function renderBrand() {
  const brand = $('#brand-name')
  const splash = $('.splash-word')
  if (brand) brand.textContent = CTX.brandName
  if (splash) splash.textContent = CTX.brandName
  document.title = CTX.username + ' · ' + CTX.brandName
}

function renderOnlineBadge() {
  const badge = $('#online-badge')
  const count = $('#online-count')
  if (!badge || !count) return
  if (CTX.onlineCount > 0) {
    count.textContent = locNum(CTX.onlineCount, lang)
    badge.classList.remove('hidden')
  } else {
    badge.classList.add('hidden')
  }
}

/* --------------------------------------------------------- usage dashboard */

let usageHistory = null
let usageUpdatedAt = 0 // epoch ms of the data currently shown
let usageStale = false // true when showing cached data we couldn't refresh
let nodeUsage = null // v1.4.0 — [{ name, value }] per-server breakdown, when present

const USAGE_CACHE_KEY = 'vortex:usage'

/** Pull a {history:[…]} / [...] payload out of a parsed JS value. */
function pickUsageArray(data) {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object') return data.history || data.data || data.usages || null
  return null
}

/**
 * v1.4.0 — pull a per-server breakdown out of Rebecca's `node_usages[]` (already in
 * the same payload we fetch for the chart). Sums uplink+downlink per node, falling
 * back to used_traffic/value, and drops zero-traffic nodes. Returns null when absent.
 */
function pickNodeUsage(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null
  const arr = data.node_usages || data.nodes || null
  if (!Array.isArray(arr) || !arr.length) return null
  const rows = arr
    .map((n) => ({
      name: String((n && (n.node_name || n.name)) || '').trim() || '—',
      value: num(n && n.uplink) + num(n && n.downlink) || num(n && n.used_traffic) || num(n && n.value),
    }))
    .filter((n) => n.value > 0)
  return rows.length ? rows : null
}

/**
 * Rebecca's usage endpoint may answer with JSON *or* an HTML panel page. We ask for
 * JSON via the Accept header, but if HTML comes back we scrape an embedded
 * `<script type="application/json">` data block (or a window.__USAGE__ = {...} blob)
 * before giving up. (Bug #1)
 */
function parseUsageFromHtml(html) {
  // 1) <script type="application/json" id="…usage…">{…}</script>
  const re = /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi
  let m
  while ((m = re.exec(html))) {
    try {
      const arr = pickUsageArray(JSON.parse(m[1].trim()))
      if (arr && arr.length) return arr
    } catch (e) {
      /* keep scanning other blocks */
    }
  }
  // 2) a JS assignment such as `window.__USAGE__ = {…}` or `var usage = [...]`
  const assign = html.match(/(?:__USAGE__|usageHistory|usage)\s*=\s*(\[[\s\S]*?\]|\{[\s\S]*?\})\s*[;\n]/i)
  if (assign) {
    try {
      const arr = pickUsageArray(JSON.parse(assign[1]))
      if (arr && arr.length) return arr
    } catch (e) {
      /* fall through */
    }
  }
  return null
}

function cacheUsage(data, nodes) {
  persist(USAGE_CACHE_KEY, JSON.stringify({ ts: Date.now(), data, nodes: nodes || null }))
}

function readCachedUsage() {
  try {
    const raw = read(USAGE_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && Array.isArray(parsed.data)) return parsed
  } catch (e) {
    /* ignore corrupt cache */
  }
  return null
}

async function loadUsageHistory() {
  if (!CTX.usageUrl) return
  try {
    const res = await fetch(CTX.usageUrl, {
      cache: 'no-store',
      credentials: 'same-origin', // Rebecca may gate usage behind a session cookie (Bug #16)
      headers: { Accept: 'application/json' },
    })
    if (!res.ok) throw new Error('usage HTTP ' + res.status)

    const ctype = (res.headers.get('content-type') || '').toLowerCase()
    const body = await res.text()
    let arr = null
    let parsed = null
    if (ctype.includes('application/json') || /^\s*[[{]/.test(body)) {
      try {
        parsed = JSON.parse(body)
        arr = pickUsageArray(parsed)
      } catch (e) {
        arr = parseUsageFromHtml(body) // JSON content-type but malformed → try scraping
      }
    } else {
      arr = parseUsageFromHtml(body) // HTML panel page (Bug #1)
    }
    // v1.4.0 — capture the per-server breakdown when the payload is JSON (the HTML
    // fallback only yields the daily array, so nodes simply stay unavailable there).
    const nodes = pickNodeUsage(parsed)

    if (arr && arr.length) {
      usageHistory = arr
      nodeUsage = nodes
      usageUpdatedAt = Date.now()
      usageStale = false
      cacheUsage(arr, nodes)
      return
    }
    // Parsed but empty/garbage — fall through to cached/empty handling.
    console.warn('[vortex] usage endpoint returned no parseable history')
    usageHistory = arr || []
  } catch (e) {
    console.warn('[vortex] usage history fetch failed:', e && e.message)
    // Feature #4: fall back to the last successfully cached payload, flagged stale.
    const cached = readCachedUsage()
    if (cached) {
      usageHistory = cached.data
      nodeUsage = cached.nodes || null
      usageUpdatedAt = cached.ts
      usageStale = true
    } else if (usageHistory == null) {
      usageHistory = null
    }
  }
}

function dateOf(r) {
  return new Date(r.date || r.day || r.t)
}
function usageValOf(r) {
  // Rebecca emits `used_traffic`; other panels use used/value/bytes/total. As a last
  // resort, sum uplink+downlink when only directional counters are present.
  if (r == null) return 0
  const direct =
    r.used_traffic != null
      ? r.used_traffic
      : r.used != null
        ? r.used
        : r.value != null
          ? r.value
          : r.bytes != null
            ? r.bytes
            : r.total
  if (direct != null) return num(direct)
  if (r.uplink != null || r.downlink != null) return num(r.uplink) + num(r.downlink)
  return 0
}

function renderUsageDashboard() {
  const dash = $('#usage-dashboard')
  const chart = $('#usage-chart')
  const alert = $('#usage-alert')
  const period = $('#usage-period')
  const updated = $('#usage-updated')
  if (!dash || !chart) return

  // Hide entirely only when we never had a usage endpoint or it produced null.
  if (usageHistory == null) {
    dash.classList.add('hidden')
    return
  }
  dash.classList.remove('hidden')

  // Feature #4 — show "Last updated" (and a stale badge when offline-cached).
  if (updated) {
    if (usageUpdatedAt) {
      const d = new Date(usageUpdatedAt)
      const stamp = `${fmtDate(d, lang, { month: 'short' })} ${locNum(
        String(d.getHours()).padStart(2, '0'),
        lang,
      )}:${locNum(String(d.getMinutes()).padStart(2, '0'), lang)}`
      updated.textContent = `${t('last_updated')}: ${stamp}`
      updated.classList.toggle('is-stale', usageStale)
      updated.classList.remove('hidden')
    } else {
      updated.classList.add('hidden')
    }
  }

  // v1.4.0 — usage-transparency insights (both self-hide when data is insufficient).
  renderForecast()
  renderNodeBreakdown()

  // Bug #1 — empty (but present) history shows a message rather than vanishing.
  if (!usageHistory.length) {
    chart.innerHTML = ''
    chart.setAttribute('aria-label', t('no_usage_data'))
    chart.classList.add('is-empty')
    chart.textContent = t('no_usage_data')
    if (period) period.textContent = ''
    if (alert) alert.classList.add('hidden')
    return
  }
  chart.classList.remove('is-empty')

  // Keep last 30 entries, sorted ascending by date.
  const rows = usageHistory
    .slice()
    .sort((a, b) => dateOf(a) - dateOf(b))
    .slice(-30)
  const max = Math.max(1, ...rows.map(usageValOf))

  // Build interactive SVG bar chart with per-bar <title> tooltips (Bug #1, #14).
  const W = 300
  const H = 80
  const pad = 4
  const barW = (W - pad * 2) / rows.length - 2
  let rects = ''
  rows.forEach((r, i) => {
    const v = usageValOf(r)
    const h = (v / max) * (H - 10)
    const x = pad + i * (barW + 2)
    const y = H - h
    const d = dateOf(r)
    const dLabel = isNaN(d) ? '' : fmtDate(d, lang, { month: 'short' })
    const vf = fmtBytes(v)
    const tip = `${locNum(vf.value, lang)} ${vf.unit}${dLabel ? ' ' + t('usage_on') + ' ' + dLabel : ''}`
    rects +=
      `<rect x="${x}" y="${y.toFixed(2)}" width="${Math.max(1, barW).toFixed(2)}" ` +
      `height="${Math.max(0, h).toFixed(2)}" rx="2"><title>${escapeHtml(tip)}</title></rect>`
  })
  const totalF = fmtBytes(rows.reduce((s, r) => s + usageValOf(r), 0))
  chart.setAttribute(
    'aria-label',
    `${t('usage_history')} — ${rows.length} ${t('days_unit')}, ${t('total')} ${locNum(
      totalF.value,
      lang,
    )} ${totalF.unit}`,
  )
  chart.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img">${rects}</svg>`

  // Period label.
  const first = dateOf(rows[0])
  const last = dateOf(rows[rows.length - 1])
  if (period && !isNaN(first) && !isNaN(last)) {
    period.textContent = `${fmtDate(first, lang, { month: 'short' })} – ${fmtDate(last, lang, { month: 'short' })}`
  }

  // Usage alert thresholds — fully localized (Bug #7).
  const limit = CTX.dataLimit
  if (limit > 0) {
    const pct = CTX.usedTraffic / limit
    let level = ''
    let msg = ''
    if (pct >= 0.9) {
      level = 'danger'
      msg = t('usage_alert_90')
    } else if (pct >= 0.8) {
      level = 'warning'
      msg = t('usage_alert_80')
    } else if (pct >= 0.5) {
      level = 'notice'
      msg = t('usage_alert_50')
    }
    if (level) {
      alert.className = 'usage-alert usage-alert-' + level
      alert.textContent = msg
      alert.classList.remove('hidden')
    } else {
      alert.classList.add('hidden')
    }
  } else {
    alert.classList.add('hidden')
  }
}

/**
 * v1.4.0 — depletion forecast. Projects when the data limit will be hit from the
 * average daily usage over the most recent days, and flags when the plan expires
 * first. Only shown for an active plan with a finite limit and remaining headroom.
 */
function renderForecast() {
  const box = $('#usage-forecast')
  if (!box) return
  const limit = CTX.dataLimit
  const unlimited = !hasValue(CTX.dataLimitRaw) || limit <= 0
  const remaining = limit - CTX.usedTraffic
  const inactive = STATE === 'expired' || STATE === 'limited' || STATE === 'disabled'
  if (unlimited || remaining <= 0 || inactive || !usageHistory || !usageHistory.length) {
    box.classList.add('hidden')
    box.innerHTML = ''
    return
  }
  // Average daily usage over the most recent (up to 7) days we have data for.
  const recent = usageHistory.slice().sort((a, b) => dateOf(a) - dateOf(b)).slice(-7)
  const vals = recent.map(usageValOf)
  const avgDaily = vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0
  if (avgDaily <= 0) {
    box.classList.add('hidden')
    box.innerHTML = ''
    return
  }
  const daysLeft = remaining / avgDaily
  const depleteAt = new Date(Date.now() + daysLeft * 86400000)
  const expiresFirst = hasValue(CTX.expireRaw) && CTX.expire * 1000 <= depleteAt.getTime()
  const days = Math.max(0, Math.ceil(daysLeft))
  let body
  if (expiresFirst) {
    body = `<span class="fc-text">${escapeHtml(t('forecast_expire_first'))}</span>`
  } else {
    const dStr = fmtDate(depleteAt, lang, { month: 'short' })
    const dayWord = days === 1 ? t('day_unit') : t('days_unit')
    body =
      `<span class="fc-text">${escapeHtml(t('forecast_deplete'))} ` +
      `<span class="fc-strong">${escapeHtml(dStr)}</span> · ${locNum(days, lang)} ${escapeHtml(dayWord)}</span>`
  }
  box.innerHTML = `<span class="fc-icon">${icon('clock')}</span>${body}`
  box.classList.remove('hidden')
}

/**
 * v1.4.0 — per-server usage breakdown from `node_usages[]`. Horizontal bars sorted
 * by traffic (top 6), with each server's share of the total. Self-hides when the
 * payload carries no node data (e.g. the HTML-scrape fallback path).
 */
function renderNodeBreakdown() {
  const box = $('#usage-nodes')
  if (!box) return
  if (!nodeUsage || !nodeUsage.length) {
    box.classList.add('hidden')
    box.innerHTML = ''
    return
  }
  const rows = nodeUsage.slice().sort((a, b) => b.value - a.value).slice(0, 6)
  const max = Math.max(1, ...rows.map((r) => r.value))
  const total = nodeUsage.reduce((s, r) => s + r.value, 0)
  const items = rows
    .map((r) => {
      const f = fmtBytes(r.value)
      const pct = total > 0 ? Math.round((r.value / total) * 100) : 0
      const w = Math.max(2, Math.round((r.value / max) * 100))
      return (
        `<div class="node-row">` +
        `<div class="node-top">` +
        `<span class="node-name" dir="auto" title="${escapeAttr(r.name)}">${escapeHtml(r.name)}</span>` +
        `<span class="node-val">${locNum(f.value, lang)} ${f.unit} · ${locNum(pct, lang)}${lang === 'fa' ? '٪' : '%'}</span>` +
        `</div>` +
        `<div class="node-bar"><span style="width:${w}%"></span></div>` +
        `</div>`
      )
    })
    .join('')
  box.innerHTML = `<div class="usage-subhead">${escapeHtml(t('usage_by_server'))}</div>${items}`
  box.classList.remove('hidden')
}

/** Re-run renders that depend on language/number formatting. */
function renderDynamic() {
  if (!CTX) return
  renderBrand()
  renderOnlineBadge()
  renderCard()
  renderConfigFilters()
  renderConfigs()
  // Re-render apps so import/download labels follow the language (Bug #2). The APPS
  // data is static; only the DOM is rebuilt, and only if the section was opened.
  renderApps(true)
  // i18n-dyn labels (config tools, app buttons, selection bar).
  $$('[data-i18n-dyn]').forEach((el) => {
    el.textContent = t(el.getAttribute('data-i18n-dyn'))
  })
}

/* ------------------------------------------------------------- escape utils */

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[c])
}

/**
 * Strict attribute encoder for href/src/title values. Beyond the five HTML
 * specials, this entity-encodes every non-alphanumeric ASCII character (backticks,
 * newlines, parentheses, etc.) so a hostile config remark can never break out of a
 * quoted attribute or smuggle an event handler. Safe URL chars are preserved so
 * deep links and subscription URLs stay clickable.
 */
function escapeAttr(s) {
  return String(s).replace(/[^a-zA-Z0-9]/g, (c) => {
    const code = c.charCodeAt(0)
    // Keep characters that are legal and meaningful inside a URL attribute value.
    if ('-._~:/?#[]@!$&\'()*+,;=%'.indexOf(c) !== -1) {
      // …but still neutralise the three that matter in attribute context.
      if (c === '&') return '&amp;'
      if (c === "'") return '&#39;'
      return c
    }
    return '&#' + code + ';'
  })
}

/** UTF-8 safe base64 (replaces the deprecated unescape()/escape() idiom). */
function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(String(str))
  let binary = ''
  bytes.forEach((b) => (binary += String.fromCharCode(b)))
  return btoa(binary)
}

/* ------------------------------------------------------------------- offline */

function wireOffline() {
  const banner = $('#offline-banner')
  const update = () => {
    banner.classList.toggle('hidden', navigator.onLine)
    checkConnection()
  }
  window.addEventListener('online', update)
  window.addEventListener('offline', update)
  update()
}

/* --------------------------------------------------- connection quality (F#9) */

/**
 * A lightweight "ping" indicator: time a no-cors round-trip to the subscription
 * origin and classify it good / fair / poor, blending in the Network Information
 * API hint when present. Best-effort and never throws into the UI.
 */
async function checkConnection() {
  const el = $('#conn-indicator')
  if (!el) return
  el.classList.remove('hidden')
  const set = (q, key) => {
    el.setAttribute('data-quality', q)
    el.setAttribute('title', t(key))
    el.setAttribute('aria-label', t(key))
  }

  if (!navigator.onLine) {
    set('offline', 'conn_offline')
    return
  }
  set('checking', 'conn_checking')

  const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection
  const target = (CTX && CTX.subUrl) || location.href
  const start = performance.now()
  try {
    await fetch(target, { method: 'HEAD', cache: 'no-store', mode: 'no-cors', credentials: 'same-origin' })
  } catch (e) {
    try {
      await fetch(target, { cache: 'no-store', mode: 'no-cors' })
    } catch (e2) {
      set('poor', 'conn_poor')
      return
    }
  }
  const ms = performance.now() - start
  let q = 'good'
  let key = 'conn_good'
  if (ms > 1200) {
    q = 'poor'
    key = 'conn_poor'
  } else if (ms > 450) {
    q = 'ok'
    key = 'conn_ok'
  }
  if (conn && (conn.effectiveType === '2g' || conn.effectiveType === 'slow-2g')) {
    q = 'poor'
    key = 'conn_poor'
  }
  set(q, key)
}

/* ------------------------------------------------ usage auto-refresh (F#10) */

let usageRefreshAt = 0
const USAGE_REFRESH_MS = 5 * 60 * 1000

function startUsageAutoRefresh() {
  if (!CTX.usageUrl) return
  usageRefreshAt = Date.now()
  const tick = async () => {
    // Only refresh while the tab is visible and the interval has elapsed.
    if (document.visibilityState !== 'visible') return
    if (Date.now() - usageRefreshAt < USAGE_REFRESH_MS) return
    usageRefreshAt = Date.now()
    await loadUsageHistory()
    renderUsageDashboard()
  }
  setInterval(tick, 30 * 1000)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') tick()
  })
}

/* --------------------------------------------------------------- bootstrap */

function resolvePrefs() {
  const params = new URLSearchParams(location.search)

  // language: ?lang → stored → navigator → IP hint → default en
  const pLang = (params.get('lang') || '').toLowerCase()
  const sLang = read('vortex:lang')
  const nav = (navigator.language || 'en').toLowerCase()
  if (pLang === 'fa' || pLang === 'en') lang = pLang
  else if (sLang === 'fa' || sLang === 'en') lang = sLang
  else if (nav.startsWith('fa')) lang = 'fa'
  else lang = 'en'

  // theme: ?theme → stored → media → light
  const pTheme = (params.get('theme') || '').toLowerCase()
  const sTheme = read('vortex:theme')
  const prefersDark =
    typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
  if (pTheme === 'vortex-dark' || pTheme === 'dark') theme = 'vortex-dark'
  else if (pTheme === 'vortex-light' || pTheme === 'light') theme = 'vortex-light'
  else if (sTheme === 'vortex-dark' || sTheme === 'vortex-light') theme = sTheme
  else theme = prefersDark ? 'vortex-dark' : 'vortex-light'
}

function wireControls() {
  $('#lang-toggle').addEventListener('click', () => setLang(lang === 'fa' ? 'en' : 'fa'))
  $('#theme-toggle').addEventListener('click', () =>
    setTheme(theme === 'vortex-dark' ? 'vortex-light' : 'vortex-dark'),
  )

  $('#copy-all').addEventListener('click', async () => {
    if (!CTX.links.length) return
    const ok = await copyText(CTX.links.join('\n'))
    toast(ok ? t('copied') : '✕')
  })
  $('#sub-qr-btn').addEventListener('click', () => {
    if (!CTX.links.length) return
    openQr(t('sub_link'), CTX.subUrl)
  })

  // Config search (Feature #1) — filter rows live as the user types.
  const search = $('#config-search')
  if (search) {
    search.addEventListener('input', () => {
      configSearch = search.value || ''
      renderConfigs()
    })
  }
  // Export configs to a .txt file (Feature #3).
  const exportBtn = $('#config-export')
  if (exportBtn) exportBtn.addEventListener('click', exportConfigs)
  // Group configs by country (v1.4.0).
  const groupBtn = $('#config-group-toggle')
  if (groupBtn) groupBtn.addEventListener('click', toggleGroupByCountry)
  // Bulk-selection mode (Feature #8).
  const selBtn = $('#config-select-toggle')
  if (selBtn) selBtn.addEventListener('click', toggleSelectionMode)
  const copySel = $('#copy-selected')
  if (copySel) {
    copySel.addEventListener('click', async () => {
      if (!selectedLinks.size) return
      const ok = await copyText(Array.from(selectedLinks).join('\n'))
      toast(ok ? t('copied') : '✕')
    })
  }
  // Keyboard navigation across config rows (Feature #7).
  const list = $('#configs-list')
  if (list) list.addEventListener('keydown', onConfigKeydown)

  // configs / apps section collapse (Bug #15: persist open/closed state).
  $$('[data-collapse]').forEach((head) => {
    head.addEventListener('click', () => {
      const id = head.getAttribute('data-collapse')
      const target = $('#' + id)
      const expanded = head.getAttribute('aria-expanded') !== 'false'
      head.setAttribute('aria-expanded', String(!expanded))
      target.classList.toggle('hidden', expanded)
      persist('vortex:collapse:' + id, expanded ? 'closed' : 'open')
      // Lazy-load apps when the section is opened.
      if (id === 'apps-body' && !expanded) {
        lazyLoadApps()
      }
    })
  })

  // QR modal close
  $('#qr-modal-close').addEventListener('click', closeQr)
  $('#qr-modal').addEventListener('click', (e) => {
    if (e.target.id === 'qr-modal') closeQr()
  })
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeQr()
  })
  $('#qr-modal-copy').addEventListener('click', async () => {
    const ok = await copyText($('#qr-modal-text').textContent)
    toast(ok ? t('copied') : '✕')
  })

  // Keyboard shortcuts.
  document.addEventListener('keydown', (e) => {
    const mod = e.ctrlKey || e.metaKey
    if (mod && e.shiftKey && e.key.toLowerCase() === 'c') {
      e.preventDefault()
      if (CTX.links.length) {
        copyText(CTX.links.join('\n')).then((ok) => toast(ok ? t('copied') : '✕'))
      }
    }
  })

  // Notification opt-in prompt (v1.4.2).
  wireNotifyPrompt()
}

/** Read a resolved theme token (e.g. --paper) for PWA/meta colours. */
function themeColor(name, fallback) {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    return v || fallback
  } catch (e) {
    return fallback
  }
}

/** Restore persisted open/closed state of collapsible sections (Bug #15). */
function restoreCollapseState() {
  $$('[data-collapse]').forEach((head) => {
    const id = head.getAttribute('data-collapse')
    const saved = read('vortex:collapse:' + id)
    if (saved !== 'open' && saved !== 'closed') return
    const target = $('#' + id)
    const open = saved === 'open'
    head.setAttribute('aria-expanded', String(open))
    if (target) target.classList.toggle('hidden', !open)
    if (id === 'apps-body' && open) lazyLoadApps()
  })
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  // Bug #6: if a controller already exists, this page is already covered — skip to
  // avoid spawning a fresh registration for every (blob-URL changing) page load.
  if (navigator.serviceWorker.controller) return

  navigator.serviceWorker
    .getRegistrations()
    .then((regs) => {
      if (regs && regs.length) return // already registered in a previous load
      // Inline a minimal SW as a blob so we stay self-contained.
      const swSrc =
        "self.addEventListener('install',function(e){self.skipWaiting()});" +
        "self.addEventListener('activate',function(e){e.waitUntil(self.clients.claim())});" +
        "self.addEventListener('fetch',function(e){e.respondWith(fetch(e.request).catch(function(){return new Response('Offline',{status:503})}))});"
      const blob = new Blob([swSrc], { type: 'application/javascript' })
      const url = URL.createObjectURL(blob)
      // Bug #4: revoke the blob URL once the registration settles so it can't leak.
      navigator.serviceWorker
        .register(url)
        .catch(() => {})
        .then(() => URL.revokeObjectURL(url))
    })
    .catch(() => {})
}

let manifestUrl = null

function installManifest() {
  // Register a manifest dynamically so the page remains fully self-contained.
  // Bug #13: colours track the active theme tokens rather than being hardcoded.
  const manifest = {
    name: CTX.brandName || 'Vortex',
    short_name: CTX.brandName || 'Vortex',
    start_url: '.',
    display: 'standalone',
    background_color: themeColor('--paper', '#f3eee1'),
    theme_color: themeColor('--ink', '#111111'),
  }
  const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' })
  // Bug #4: revoke the previous manifest blob before swapping in a new one.
  if (manifestUrl) URL.revokeObjectURL(manifestUrl)
  manifestUrl = URL.createObjectURL(blob)
  let link = document.querySelector('link[rel="manifest"]')
  if (!link) {
    link = document.createElement('link')
    link.rel = 'manifest'
    document.head.appendChild(link)
  }
  link.href = manifestUrl

  // Keep the browser chrome colour in sync with the theme too.
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', themeColor('--paper', '#111111'))
}

function reveal() {
  const items = $$('[data-reveal]')
  if (reduceMotion) {
    items.forEach((el) => el.classList.add('revealed'))
    return
  }
  items.forEach((el, i) => {
    setTimeout(() => el.classList.add('revealed'), 60 + i * 70)
  })
}

function hideSplash() {
  const splash = $('#splash')
  if (!splash) return
  splash.classList.add('splash-out')
  setTimeout(() => splash.remove(), reduceMotion ? 0 : 420)
}

/** Fill static chrome icons declared via `data-icon="name"`. */
function fillIcons() {
  $$('[data-icon]').forEach((el) => {
    el.innerHTML = icon(el.getAttribute('data-icon'))
  })
}

/** Surface a friendly error state instead of a blank/crashed page (Bug #8). */
function showErrorState(err) {
  try {
    console.error('[vortex] init failed:', err)
    const banner = $('#error-banner')
    if (banner) {
      const titleEl = $('#error-title')
      const msgEl = $('#error-msg')
      if (titleEl) titleEl.textContent = t('error_title')
      if (msgEl) msgEl.textContent = t('error_msg')
      banner.classList.remove('hidden')
    }
  } catch (e) {
    /* last-resort: nothing else we can safely do */
  }
  // Always clear the splash so the user is never stuck on the loader.
  try {
    hideSplash()
  } catch (e) {
    const splash = $('#splash')
    if (splash) splash.remove()
  }
}

/* ------------------------------------------- usage/expiry notifications (v1.4.2) */

const NOTIFY_LEVELS_KEY = 'vortex:notify-levels'
const NOTIFY_OPTOUT_KEY = 'vortex:notify-optout'

function notifySupported() {
  return typeof Notification !== 'undefined'
}

function readNotifyLevels() {
  try {
    const o = JSON.parse(read(NOTIFY_LEVELS_KEY))
    return o && typeof o === 'object' ? o : {}
  } catch (e) {
    return {}
  }
}

/**
 * Fire local notifications when usage/expiry cross thresholds. Each milestone is
 * tracked so it notifies once and only re-arms if the metric recovers (a quota reset
 * or a renewal). These are local notifications — with no push backend they surface
 * while the page is open, evaluated on each load.
 *   data: 50% / 70% / 90% consumed (finite limit only)
 *   time: 3 days / 1 day before expiry (skip never-expire)
 */
function evaluateNotifications() {
  if (!notifySupported() || Notification.permission !== 'granted' || !CTX) return
  const levels = readNotifyLevels()
  let changed = false
  const dead = STATE === 'expired' || STATE === 'disabled'

  const post = (body) => {
    try {
      new Notification(CTX.brandName || 'Vortex', { body, lang, tag: 'vortex-alert' })
    } catch (e) {
      /* never let a notification failure bubble into init */
    }
  }

  // ---- data usage thresholds
  const limit = CTX.dataLimit
  const hasLimit = hasValue(CTX.dataLimitRaw) && limit > 0
  let dataLevel = 0
  if (hasLimit && !dead) {
    const frac = CTX.usedTraffic / limit
    dataLevel = frac >= 0.9 ? 3 : frac >= 0.7 ? 2 : frac >= 0.5 ? 1 : 0
  }
  const prevData = levels.data || 0
  if (dataLevel > prevData) post(t('notify_data_' + (dataLevel === 3 ? 90 : dataLevel === 2 ? 70 : 50)))
  if (dataLevel !== prevData) {
    levels.data = dataLevel
    changed = true
  }

  // ---- expiry thresholds
  let timeLevel = 0
  if (hasValue(CTX.expireRaw) && !dead) {
    const days = Math.ceil(Math.max(0, CTX.expire - Date.now() / 1000) / 86400)
    timeLevel = days <= 1 ? 2 : days <= 3 ? 1 : 0
  }
  const prevTime = levels.time || 0
  if (timeLevel > prevTime) post(t('notify_time_' + (timeLevel === 2 ? 1 : 3)))
  if (timeLevel !== prevTime) {
    levels.time = timeLevel
    changed = true
  }

  if (changed) persist(NOTIFY_LEVELS_KEY, JSON.stringify(levels))
}

/** Wire the opt-in prompt buttons (permission is requested from the click gesture). */
function wireNotifyPrompt() {
  const prompt = $('#notify-prompt')
  if (!prompt) return
  const hide = () => prompt.classList.add('hidden')
  const enable = $('#notify-enable')
  const dismiss = $('#notify-dismiss')
  if (enable) {
    enable.addEventListener('click', () => {
      hide()
      if (!notifySupported()) return
      // requestPermission() must run from a user gesture — hence the button.
      Promise.resolve(Notification.requestPermission())
        .then((perm) => {
          if (perm === 'granted') evaluateNotifications()
          else if (perm === 'denied') persist(NOTIFY_OPTOUT_KEY, '1')
        })
        .catch(() => {})
    })
  }
  if (dismiss) {
    dismiss.addEventListener('click', () => {
      hide()
      persist(NOTIFY_OPTOUT_KEY, '1')
    })
  }
}

/**
 * On first load: if the user already granted permission, evaluate thresholds now;
 * if it is still undecided (and not previously dismissed), show the opt-in prompt.
 */
function setupNotifications() {
  try {
    if (!notifySupported()) return
    if (Notification.permission === 'granted') {
      evaluateNotifications()
      return
    }
    if (Notification.permission === 'denied') return
    if (read(NOTIFY_OPTOUT_KEY) === '1') return
    const prompt = $('#notify-prompt')
    if (prompt) prompt.classList.remove('hidden')
  } catch (e) {
    /* notifications are best-effort; never block the page */
  }
}

async function init() {
  try {
    CTX = readContext()
    STATE = deriveState(CTX)

    fillIcons()
    resolvePrefs()
    document.documentElement.setAttribute('data-theme', theme)
    setTheme(theme)
    setLang(lang) // also applies i18n + first dynamic render

    renderBrand()
    renderOnlineBadge()
    renderLinks()
    restoreCollapseState()
    lazyLoadApps() // set up the apps observer (no-op if already rendered)
    wireControls()
    // installManifest() is already invoked by setTheme() above (CTX is set), and
    // wireOffline()'s initial update() calls checkConnection() — so neither is
    // repeated here (was: a second manifest blob + a second probe on every load).
    wireOffline()
    registerServiceWorker()
    setupNotifications() // v1.4.2 — first-load opt-in + usage/expiry threshold alerts

    // Load usage history asynchronously; it will render when ready.
    await loadUsageHistory()
    renderUsageDashboard()
    startUsageAutoRefresh()

    requestAnimationFrame(() => {
      hideSplash()
      reveal()
    })
  } catch (err) {
    showErrorState(err)
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
