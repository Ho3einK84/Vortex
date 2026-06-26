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
- **i18n** — English (Exo 2) and فارسی (Arad) with full RTL and localized Persian digits. Auto-selects FA when `navigator.language` starts with `fa`. Force with `?lang=fa` / `?theme=vortex-dark`.
- **Resilient** — offline banner, and graceful expired / limited / disabled / on-hold / empty states.
- **Polish** — instant loading splash, staggered reveal, full `prefers-reduced-motion` support.

---

## Quick start

```bash
npm ci          # install pinned deps
npm run build   # → dist/index.html  (self-contained, offline-ready)
npm run guard   # re-run the pongo2 directive guard on dist/index.html
npm run serve   # local preview with sample data → http://localhost:8787
```

`npm run serve` emulates Rebecca's pongo2 rendering with sample data so you can browse the page in a normal browser. Try states and locales:

```
http://localhost:8787/?state=expired      # active|limited|expired|disabled|on_hold|unlimited|forever
http://localhost:8787/?lang=fa&theme=vortex-dark
```

---

## Install into Rebecca

Drop the built file at the template path — Rebecca re-reads it on every request, so no restart is needed:

```bash
cp dist/index.html /var/lib/rebecca/templates/subscription/index.html
```

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

## License

MIT.
