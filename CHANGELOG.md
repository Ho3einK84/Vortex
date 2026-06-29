# Changelog

All notable changes to Vortex are documented here.
This project adheres to [Semantic Versioning](https://semver.org/).

## v1.4.1

### Added
- The **Usage history** panel is now collapsible — tap its header to open/close it, and the open/closed state persists across reloads (same mechanism as the Configs and Apps sections). The date-range label stays visible in the header when collapsed.

## v1.4.0

### Added
- **Per-server usage breakdown** — the usage dashboard now shows a "By server" list of horizontal bars, ranking each node by traffic and its share of the total. Parsed from the `node_usages[]` already present in Rebecca's usage payload (no extra request).
- **Depletion forecast** — a one-line projection under the usage chart estimating when the data limit will be reached from recent daily usage, and flagging when the plan expires first. Shown only for active plans with a finite limit and remaining headroom.
- **Group configs by country** — a new toggle in the config toolbar groups configs under country headers (flag + name), detected from the config remark via flag emoji or country name. Unmatched configs fall under an "Other" group. Fully localized and RTL-aware.

### Changed
- The usage cache now also stores the per-server breakdown so it survives an offline reload alongside the daily history.
- Added a reusable `data-i18n-title` hook so icon-only tool buttons get a localized tooltip/`aria-label` that follows the language.

## v1.3.2

### Security
- Config link parsing now rejects `javascript:`, `data:` and `vbscript:` schemes, so a hostile config line can no longer smuggle a script-bearing URI into the page.

### Fixed
- Removed duplicate `installManifest()` and `checkConnection()` calls on boot — every page load was creating a second PWA manifest blob and running a second connection probe.
- QR titles opened via keyboard (Space on a focused config row) now match the focused config instead of always labelling it as the first one.
- Config remarks now use `dir="auto"`, fixing the display direction of mixed Persian/English names in RTL.

### Changed
- The server-provided `status_class` is now exposed as a `data-status-class` attribute on the status badge (previously read but unused), enabling panel-side status styling.

## v1.3.1

- **Usage dashboard now reads Rebecca's real payload** — the daily bars are parsed
  from `usages[].used_traffic` (with `uplink + downlink` as a fallback), fixing the
  empty in-card chart.
- Removed the footer **Usage** button that opened Rebecca's raw JSON endpoint in a
  new tab; the in-card chart is the canonical usage view.
- Larger, bolder traffic stat numbers; in Persian/RTL the unit (e.g. GB) now stays
  to the right of the value.
- Replaced the unlimited (∞) glyph with a cleaner standard bold infinity, and the
  Android icon with the official Android robot logo.

## v1.3.0

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

## v1.2.1

- Updated Android and Linux OS icons to more closely match the official logos.

## v1.2.0

- White-label branding via `brand_name` binding.
- Usage dashboard: 30-day bar chart from `usage_url` and animated 50/80/90% usage alerts.
- PWA-ready: dynamically registered manifest and inline service worker.
- Lazy-load the Apps section on first open/intersection.
- Persian Jalali date formatting and improved language detection.
- Keyboard shortcut `Ctrl/Cmd+Shift+C` to copy all configs.
- Focus trap and ARIA improvements for the QR modal.
- `online_count` support from Rebecca.
- Visual regression test scaffold (`npm run test:visual`).

## v1.1.0

- Fixed mobile responsiveness and Persian/RTL layout scaling so the page fits without zooming.
- Centered and contained QR modal content in both English and Persian.
- Added app-list scrolling for OS groups with more than three apps.
- Added Android, iOS/macOS, Windows, and Linux icons beside apps.
- Removed unwanted progress-ring outlines and rounded progress strokes.
- Improved the remaining-time ring calculation.
- Rebalanced the dark theme with a softer modern palette and strong contrast.
