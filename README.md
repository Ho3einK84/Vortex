# 🌀 Vortex

A bold, **Neo-Brutalist** subscription page template for the [Rebecca](https://github.com/Ho3einK84) panel. Vortex is a spiritual sibling of [Aurora](https://github.com/Ho3einK84/Aurora) — same feature scope and Rebecca integration — but with a completely different visual identity: thick black borders, hard offset shadows, punchy accents and chunky type.

Everything compiles to **one truly self-contained `dist/index.html`** with **zero external requests**: CSS, fonts, JavaScript, the QR generator and the app catalogue are all inlined. It renders fully where CDNs are blocked.

> Built with **UnoCSS** + **vanilla JS**. Fonts: **Exo 2** (EN) and **Arad** (FA). EN / فارسی with full RTL.

---

## Features

- **Service card** — dual progress rings (data usage + time remaining), traffic stats, expiry, and a live quota-reset countdown (daily / weekly / monthly / yearly). Handles unlimited data and never-expire.
- **Configs** — collapsible list with one-tap copy, per-config QR, copy-all, and a subscription-link QR.
- **Apps** — collapsible, OS-grouped client list (Android / iOS / Windows / macOS / Linux) with one-tap import deep links + download links, sourced from `src/apps.json`.
- **Themes** — two brutalist variants, `vortex-light` (paper) and `vortex-dark` (amoled). Preference persists (storage-optional).
- **i18n** — English (Exo 2) and فارسی (Arad) with full RTL, localized Persian digits and Jalali dates. Auto-selects FA when `navigator.language` starts with `fa`. Force with `?lang=fa` / `?theme=vortex-dark`.
- **White-label** — `brand_name` binding customizes the splash, header and page title.
- **Usage dashboard** — 30-day bar chart from `usage_url` plus 50/80/90% usage alerts.
- **PWA-ready** — dynamically registered manifest and inline service worker for installability.
- **Accessibility** — ARIA labels, focus trap in the QR modal, and `Ctrl/Cmd+Shift+C` to copy all configs.
- **Resilient** — offline banner, and graceful expired / limited / disabled / on-hold / empty states.
- **Polish** — instant loading splash, staggered reveal, full `prefers-reduced-motion` support.

---

## Installation on Rebecca

To deploy Vortex on the Rebecca panel, go to **Master Settings → Subscriptions**. The template loads from `{Custom templates directory}/{Subscription page template}`, defaulting to `/var/lib/rebecca/templates/subscription/index.html`.

Download the latest release:

```bash
wget -O /var/lib/rebecca/templates/subscription/index.html \
  https://github.com/Ho3einK84/Vortex/releases/latest/download/index.html
```

Make sure **Subscription page template** is set to `subscription/index.html` (the default). Alternatively, paste the file contents straight into the **Template Creator** tab. Rebecca reloads the template on every request, so no service restart is needed — just open any user's subscription URL to see the page.

## Updating

Run the same `wget` command again (or re-paste into **Template Creator**) — the new file is picked up on the next page load.

## Building locally

```bash
npm ci
npm run build      # → dist/index.html (single self-contained file)
```

The build compiles UnoCSS, inlines every asset (fonts, icons, `apps.json`, `app.js`), base64-injects the JS bundle and the QR generator, and guarantees the template's own `{{ }}` / `{% %}` bindings are the only directives in the output.

---

## How it stays pongo2-safe

Rebecca renders the page through **pongo2** at request time. Vortex guarantees the engine only ever sees the bindings it should:

1. **All** template directives (`{{ }}`, `{% %}`, `{# #}`) live in a single hidden **data-island** near the top of `<body>` (`#rb-data`). The app reads them via `dataset` / `textContent` and never trusts the types.
2. The inlined JavaScript (which legitimately contains `{{`, `${…}` etc.) is **base64-encoded and injected at runtime**, so pongo2 never parses it — avoiding the dreaded HTTP 502.
3. The build runs a **directive guard**: it fails if any inlined asset introduces a stray directive, or if the data-island contains anything other than the known bindings, or if any external resource is referenced.

### Rebecca template context

The data-island binds to:

```
user.username, user.status, user.status_class
user.data_limit (int64 bytes / falsy ⇒ unlimited)
user.data_limit_reset_strategy (no_reset · day · week · month · year)
user.used_traffic (int64 bytes)
user.expire (int64 unix / falsy ⇒ never expires)
links ([]string raw config URIs)
user.subscription_url
usage_url, support_url, token
remaining_days (int64, precomputed — no server-side now())
```

If `subscription_url` isn't absolute, it's derived from `location.origin + location.pathname`. All `now()`-based logic (countdowns, ring depletion) runs **client-side**.

---

## Customization

| What | Where |
| --- | --- |
| Brutalist tokens (`brutal`, `brutal-btn`, `brutal-cta`, …) | `uno.config.js` |
| Theme colours / component styles | `src/base.css` (`[data-theme='vortex-light' / 'vortex-dark']`) |
| Client app list + import deep links | `src/apps.json` |
| Translations / Persian digits | `src/i18n.js` |
| Inline SVG icons | `src/icons.js` |
| Markup + data-island bindings | `src/index.html` |

`apps.json` import URLs support these placeholders, substituted at runtime:
`{url}` (raw), `{url_enc}` (`encodeURIComponent`), `{url_b64}` (base64), `{name}` (username).

To swap fonts, replace the `*.woff2` files in `assets/fonts/` (Exo 2 latin / latin-ext subsets and the five Arad weights) — the build base64-inlines whatever is there.

---

## Project structure

```
vortex/
├── src/
│   ├── index.html        # template + Rebecca data-island bindings
│   ├── app.js            # state, i18n, themes, rings, countdown, configs, apps
│   ├── base.css          # theme tokens + brutalist component styles
│   ├── i18n.js           # EN / FA dictionaries + Persian digits
│   ├── qr.js             # qrcode-generator SVG wrapper
│   ├── icons.js          # inline SVG set
│   └── apps.json         # OS-grouped client catalogue
├── assets/fonts/         # Arad (FA) + Exo 2 (EN) woff2
├── uno.config.js         # brutalist shortcuts + theme rules
├── scripts/
│   ├── build.mjs         # compile Uno → inline everything → dist/index.html + guard
│   └── serve.mjs         # local preview with sample pongo2 data (dev only)
├── .github/workflows/build.yml
└── dist/index.html       # build output (committed)
```

---

## Changelog

### v1.3.1

- **Usage dashboard now reads Rebecca's real payload** — the daily bars are parsed
  from `usages[].used_traffic` (with `uplink + downlink` as a fallback), fixing the
  empty in-card chart.
- Removed the footer **Usage** button that opened Rebecca's raw JSON endpoint in a
  new tab; the in-card chart is the canonical usage view.
- Larger, bolder traffic stat numbers; in Persian/RTL the unit (e.g. GB) now stays
  to the right of the value.
- Replaced the unlimited (∞) glyph with a cleaner standard bold infinity, and the
  Android icon with the official Android robot logo.

### v1.3.0

**Fixes**

- Usage dashboard now works when Rebecca's `usage_url` answers with an HTML panel page: the fetch sends `Accept: application/json` + `credentials: same-origin`, detects the content-type, and scrapes an embedded `<script type="application/json">` block (or a `window.__USAGE__` blob) as a fallback. Empty history shows a "No usage data yet" message instead of vanishing.
- Apps section re-renders its import/download labels on language switch.
- Replaced the deprecated `unescape()` base64 idiom with a `TextEncoder`-based helper, and hardened `escapeAttr()` to entity-encode every unsafe attribute character.
- Service-worker and manifest blob URLs are now revoked after use; the SW only registers when the page isn't already controlled, preventing duplicate registrations.
- The remaining-time ring always computes from `expire` client-side, using `remaining_days` only as a fallback.
- Relaxed config URL validation to accept any scheme-prefixed URI.
- Blocking theme resolver in `<head>` eliminates the light/dark flash on load.
- Localized usage alerts and the Persian quota-reset day suffix; PWA/theme-color now track the active theme tokens.
- QR generator returns a legible fallback tile when a payload exceeds QR capacity.
- Copy-all / Sub-QR / Export / Select are disabled (and dimmed) when there are no configs.
- Accessible usage chart: per-bar `<title>` tooltips plus `role="img"` and an `aria-label`.
- Collapsed/expanded section state and an `init()` error boundary (friendly error banner instead of a blank page).

**New features**

- Config search/filter, protocol filter pills, `.txt` export, and bulk selection with "copy selected".
- Keyboard navigation across config rows (↑/↓ move, Enter copies, Space opens QR).
- Offline cache for usage data with a "Last updated" (and stale) indicator, plus auto-refresh every 5 minutes while the tab is visible.
- Animated count-up stat numbers, an urgent ring glow above 90%, a connection-quality indicator, and external-link icons on the Support/Usage buttons.
- Added Hiddify to iOS for unified cross-platform coverage.

### v1.2.1

- Updated Android and Linux OS icons to more closely match the official logos.

### v1.2.0

- White-label branding via `brand_name` binding.
- Usage dashboard: 30-day bar chart from `usage_url` and animated 50/80/90% usage alerts.
- PWA-ready: dynamically registered manifest and inline service worker.
- Lazy-load the Apps section on first open/intersection.
- Persian Jalali date formatting and improved language detection.
- Keyboard shortcut `Ctrl/Cmd+Shift+C` to copy all configs.
- Focus trap and ARIA improvements for the QR modal.
- `online_count` support from Rebecca.
- Visual regression test scaffold (`npm run test:visual`).

### v1.1.0

- Fixed mobile responsiveness and Persian/RTL layout scaling so the page fits without zooming.
- Centered and contained QR modal content in both English and Persian.
- Added app-list scrolling for OS groups with more than three apps.
- Added Android, iOS/macOS, Windows, and Linux icons beside apps.
- Removed unwanted progress-ring outlines and rounded progress strokes.
- Improved the remaining-time ring calculation.
- Rebalanced the dark theme with a softer modern palette and strong contrast.

---

## License

MIT.
