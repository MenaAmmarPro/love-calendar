# Our Days — Love for Mena

A shared calendar for two: hearts, countdowns and milestones. Part of the
**Love for Mena** collection.

**Live:** https://menaammarpro.github.io/love-calendar/

## What it does

- **Month grid** (Monday-first): today highlighted, event dots by category
  (date ♥ / trip ✈ / gift ✦ / reminder •), hearts on days you mark as ours —
  plus an automatic heart every 1 January (the since-forever day)
- **Day panel:** pick a day → see its plans, toggle the heart, add an event
  (title, date, type, note) or remove one
- **Today cards:** today's date, live days-together counter, next event with
  a countdown ("in 12 days" / "tomorrow" / "today")
- **Upcoming list:** the next 12 events, each clickable → jumps the calendar
  to that day
- **Year heatmap:** all 12 months × 31 days at a glance, hearts and plans
  colour-coded, today outlined
- **Export:** `.ics` for Google/Apple calendars, JSON backup, and JSON restore
- Everything stays on the device — no tracking, no network calls
- Installable PWA with offline support

## How it works

Events and hearts live in localStorage under `mena-calendar`
(`{events:[{id,date,title,category,note}], hearts:[date]}`). All date maths is
string/UTC-based so no DST surprises. Sync between devices is planned to ride
on the same auth as the chat backend (`love-api` `/chat/*`).

## Files

- `index.html` — the page
- `css/theme.css` — shared love-theme (copied from `_love-theme/`)
- `css/app.css` — grid, day panel, chips, heatmap styles
- `js/theme-main.js`, `js/effects.js` — shared behaviour/effects
- `js/app.js` — calendar engine, CRUD, exports
- `manifest.webmanifest`, `sw.js` — PWA
- `assets/` — favicon and icons

## Run locally

```powershell
py -m http.server 8000
```

Then visit http://localhost:8000.

## Deploy

Static site, deployed with GitHub Pages from `main`.

## License

Creative Commons BY-NC-ND 4.0 — see [`LICENSE`](LICENSE).
© 2026 Ammar (MenaAmmarPro). Made with care for Mena.
