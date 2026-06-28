// QR code helper wrapping the vendored `qrcode-generator` library.
//
// qrcode-generator ships pure JS with no template directives, but the whole app
// bundle is base64-injected at runtime anyway (see scripts/build.mjs), so pongo2
// never parses any of this. We render crisp SVG (scales perfectly inside the
// brutalist black frame) rather than a raster data-URL.

import qrcode from 'qrcode-generator'

/**
 * Build an SVG string for `text`.
 * @param {string} text      payload to encode
 * @param {object} [opts]
 * @param {string} [opts.dark]   module (foreground) colour
 * @param {string} [opts.light]  background colour
 * @param {number} [opts.margin] quiet-zone in modules
 * @param {string} [opts.errorText] fallback message when the payload won't fit
 * @returns {string} standalone <svg> markup
 */
export function qrSvg(text, opts = {}) {
  const dark = opts.dark || '#000000'
  const light = opts.light || '#ffffff'
  const margin = opts.margin == null ? 2 : opts.margin

  // typeNumber 0 = auto-detect smallest fit; 'M' error correction is a good default.
  // Very long payloads exceed the largest QR version (40); qrcode-generator throws
  // in that case, so fall back to a legible error tile instead of crashing render.
  let qr
  try {
    qr = qrcode(0, 'M')
    qr.addData(String(text == null ? '' : text))
    qr.make()
  } catch (e) {
    return fallbackSvg(dark, light, opts.errorText || 'Too long for QR')
  }

  const count = qr.getModuleCount()
  const size = count + margin * 2

  let rects = ''
  for (let r = 0; r < count; r++) {
    for (let c = 0; c < count; c++) {
      if (qr.isDark(r, c)) {
        rects += `<rect x="${c + margin}" y="${r + margin}" width="1.02" height="1.02"/>`
      }
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" ` +
    `shape-rendering="crispEdges" width="100%" height="100%">` +
    `<rect width="${size}" height="${size}" fill="${light}"/>` +
    `<g fill="${dark}">${rects}</g>` +
    `</svg>`
  )
}

/** A simple notice tile shown when a payload exceeds QR capacity. */
function fallbackSvg(dark, light, message) {
  const safe = String(message).replace(/[&<>]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c],
  )
  // Word-wrap the message across up to three centred lines.
  const words = safe.split(/\s+/)
  const lines = []
  let line = ''
  for (const w of words) {
    if ((line + ' ' + w).trim().length > 18 && line) {
      lines.push(line)
      line = w
    } else {
      line = (line + ' ' + w).trim()
    }
  }
  if (line) lines.push(line)
  const shown = lines.slice(0, 3)
  const startY = 50 - (shown.length - 1) * 5
  const tspans = shown
    .map((l, i) => `<tspan x="50" y="${startY + i * 10}">${l}</tspan>`)
    .join('')
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">` +
    `<rect width="100" height="100" fill="${light}"/>` +
    `<text fill="${dark}" font-size="7" font-family="monospace" font-weight="700" ` +
    `text-anchor="middle">${tspans}</text>` +
    `</svg>`
  )
}
