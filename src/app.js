// Vortex — application logic (vanilla JS, no framework).
//
// Responsibilities: read the Rebecca data-island, drive i18n + RTL + Persian digits,
// theme switching, the dual progress rings, quota-reset countdown, config list with
// copy / QR, OS-grouped app importers, offline handling and graceful state rendering.
//
// The entire bundle is base64-injected at runtime by the build, so pongo2 never sees
// any of this source — only the data-island bindings remain as live template tags.

import { STRINGS, toFaDigits, locNum } from './i18n.js'
import { icon } from './icons.js'
import { qrSvg } from './qr.js'
import APPS from './apps.json'

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
      .filter((s) => s && /^[a-z][a-z0-9+.-]*:\/\//i.test(s))
  }

  let subUrl = (d.subscriptionUrl || '').trim()
  if (!/^https?:\/\//i.test(subUrl)) {
    // Derive an absolute URL when the server handed us a relative one (or none).
    subUrl = location.origin + location.pathname
  }

  return {
    username: (d.username || '').trim() || '—',
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

/* --------------------------------------------------------------- subscription */

let CTX = null
let STATE = 'active'

function importUrl(template) {
  const url = CTX.subUrl
  let b64 = ''
  try {
    b64 = btoa(unescape(encodeURIComponent(url)))
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

function openQr(title, text) {
  const modal = $('#qr-modal')
  const dark = theme === 'vortex-dark' ? '#f4f1e8' : '#0a0a0a'
  const light = theme === 'vortex-dark' ? '#0a0a0a' : '#ffffff'
  $('#qr-modal-title').textContent = title
  $('#qr-modal-canvas').innerHTML = qrSvg(text, { dark, light, margin: 2 })
  $('#qr-modal-text').textContent = text
  modal.classList.remove('hidden')
  modal.setAttribute('aria-hidden', 'false')
}

function closeQr() {
  const modal = $('#qr-modal')
  modal.classList.add('hidden')
  modal.setAttribute('aria-hidden', 'true')
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
  $('#service-card').setAttribute('data-state', STATE)
  $('#app').setAttribute('data-state', STATE)

  // ---- data ring + stats
  const usedF = fmtBytes(used)
  $('#stat-used-val').textContent = locNum(usedF.value, lang)
  $('#stat-used-unit').textContent = usedF.unit

  if (unlimited) {
    setRing('ring-data', null)
    $('#ring-data-pct').innerHTML = icon('infinity')
    $('#ring-data-pct').classList.add('is-infinity')
    $('#stat-total-val').innerHTML = icon('infinity')
    $('#stat-total-unit').textContent = ''
  } else {
    const frac = clamp(used / limit, 0, 1)
    setRing('ring-data', frac)
    const pct = Math.round(frac * 100)
    $('#ring-data-pct').textContent = locNum(pct, lang) + (lang === 'fa' ? '٪' : '%')
    $('#ring-data-pct').classList.remove('is-infinity')
    const totalF = fmtBytes(limit)
    $('#stat-total-val').textContent = locNum(totalF.value, lang)
    $('#stat-total-unit').textContent = totalF.unit
    const remF = fmtBytes(Math.max(0, limit - used))
    $('#stat-remaining-val').textContent = locNum(remF.value, lang)
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
  } else {
    const nowSec = Date.now() / 1000
    const remainingSec = Math.max(0, CTX.expire - nowSec)
    // We do not get the subscription start time from Rebecca, so infer a sane
    // total cycle from the remaining duration. This keeps the remaining-time
    // ring functional on first load instead of always rendering as 100%.
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

    const days =
      CTX.remainingDays > 0
        ? Math.round(CTX.remainingDays)
        : Math.max(0, Math.ceil(remainingSec / 86400))
    $('#ring-time-pct').textContent = locNum(days, lang)
    $('#ring-time-days').textContent = days === 1 ? t('day_unit') : t('days_unit')

    const expDate = new Date(CTX.expire * 1000)
    const dStr = expDate.toLocaleDateString(lang === 'fa' ? 'fa-IR' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
    $('#stat-expire-val').textContent = lang === 'fa' ? toFaDigits(dStr) : dStr
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
    if (dd > 0) parts.push(locNum(dd, lang) + (lang === 'fa' ? 'ر' : 'd'))
    parts.push(locNum(pad(hh), lang) + ':' + locNum(pad(mm), lang) + ':' + locNum(pad(ss), lang))
    $('#reset-countdown').textContent = parts.join(' ')
  }
  tick()
  resetTimer = setInterval(tick, 1000)
}

/* --------------------------------------------------------- render: configs */

function renderConfigs() {
  const list = $('#configs-list')
  const links = CTX.links
  $('#configs-count').textContent = locNum(links.length, lang)
  list.innerHTML = ''

  if (!links.length) {
    const empty = document.createElement('div')
    empty.className = 'muted text-sm py-4 text-center'
    empty.textContent = t('no_configs')
    list.appendChild(empty)
    return
  }

  links.forEach((link, i) => {
    const name = labelForConfig(link, i)
    const row = document.createElement('div')
    row.className = 'config-row'
    row.innerHTML = `
      <div class="config-meta">
        <span class="config-index">${locNum(i + 1, lang)}</span>
        <div class="config-name" title="${escapeAttr(link)}">${escapeHtml(name)}</div>
      </div>
      <div class="config-actions">
        <button class="icon-btn" data-act="qr" aria-label="QR">${icon('qr')}</button>
        <button class="icon-btn" data-act="copy" aria-label="Copy">${icon('copy')}</button>
      </div>`
    row.querySelector('[data-act=copy]').addEventListener('click', async () => {
      const ok = await copyText(link)
      toast(ok ? t('copied') : '✕')
    })
    row.querySelector('[data-act=qr]').addEventListener('click', () => {
      openQr(name, link)
    })
    list.appendChild(row)
  })
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

function osIconName(osId) {
  return {
    android: 'android',
    ios: 'apple',
    macos: 'apple',
    windows: 'windows',
    linux: 'linux',
  }[osId] || 'download'
}

function renderApps() {
  const wrap = $('#apps-list')
  wrap.innerHTML = ''
  const osList = (APPS && APPS.os) || []

  osList.forEach((group, gi) => {
    const section = document.createElement('div')
    section.className = 'os-group'
    section.innerHTML = `
      <button class="os-head" data-act="toggle" aria-expanded="${gi === 0}">
        <span class="os-name"><span class="os-icon">${icon(osIconName(group.id))}</span>${escapeHtml(group.name)}</span>
        <span class="os-chevron">${icon('chevron')}</span>
      </button>
      <div class="os-body${gi === 0 ? '' : ' hidden'}"></div>`
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

/* ------------------------------------------------------------- misc render */

function renderLinks() {
  const sup = $('#support-link')
  const usg = $('#usage-link')
  if (CTX.supportUrl) {
    sup.href = CTX.supportUrl
    sup.classList.remove('hidden')
  } else sup.classList.add('hidden')
  if (CTX.usageUrl) {
    usg.href = CTX.usageUrl
    usg.classList.remove('hidden')
  } else usg.classList.add('hidden')
}

/** Re-run renders that depend on language/number formatting. */
function renderDynamic() {
  if (!CTX) return
  renderCard()
  renderConfigs()
  // app import/download labels
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
function escapeAttr(s) {
  return escapeHtml(s)
}

/* ------------------------------------------------------------------- offline */

function wireOffline() {
  const banner = $('#offline-banner')
  const update = () => banner.classList.toggle('hidden', navigator.onLine)
  window.addEventListener('online', update)
  window.addEventListener('offline', update)
  update()
}

/* --------------------------------------------------------------- bootstrap */

function resolvePrefs() {
  const params = new URLSearchParams(location.search)

  // language: ?lang → stored → navigator → default en
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
  $('#sub-qr-btn').addEventListener('click', () => openQr(t('sub_link'), CTX.subUrl))

  // configs / apps section collapse
  $$('[data-collapse]').forEach((head) => {
    head.addEventListener('click', () => {
      const target = $('#' + head.getAttribute('data-collapse'))
      const expanded = head.getAttribute('aria-expanded') !== 'false'
      head.setAttribute('aria-expanded', String(!expanded))
      target.classList.toggle('hidden', expanded)
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

function init() {
  CTX = readContext()
  STATE = deriveState(CTX)
  document.title = CTX.username + ' · Vortex'

  fillIcons()
  resolvePrefs()
  document.documentElement.setAttribute('data-theme', theme)
  setTheme(theme)
  setLang(lang) // also applies i18n + first dynamic render

  renderApps()
  renderLinks()
  wireControls()
  wireOffline()

  requestAnimationFrame(() => {
    hideSplash()
    reveal()
  })
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init)
} else {
  init()
}
