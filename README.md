# Nashville inKind Happy Hour Radar

A phone-usable page that answers "it's 7pm — which inKind partners near me have a
happy hour now or in the next 2 hours?" Food discounts are the priority; drinks
secondary.

Static site, no backend, no build step: `index.html` + `venues.json` + `logic.js`.
Data is pulled from inKind and researched by hand, then **baked into venues.json and
committed** — the published page never calls inKind or any other site at runtime.
Your phone's clock and GPS are the only inputs; GPS coordinates never leave the device.

v1 covers: the 35 inKind partners in the Nashville metro that inKind's own map API
flags `happy_hour: true`, plus a researched sweep of the other ~101 unflagged inKind
metro rows (inKind's flag is discovery, not ground truth — see `CHANGELOG.md` for the
count actually added). v2 (parked) would fold in non-inKind aggregator listings.

## Files

- `index.html` — the app (NOW view + DAY GRID), inline CSS + UI/rendering JS.
- `logic.js` — pure date/window-resolution + schema-validation functions, shared by
  `index.html`, `validate.js`, and `tests/windows.test.js` (one source of truth).
- `venues.json` — the data. Don't hand-edit; fix via `data-src/` + regenerate, or a
  documented manual edit noted in `CHANGELOG.md`.
- `validate.js` — Node schema/semantic validator (`node validate.js venues.json`).
- `tests/windows.test.js` — `node --test` suite for the window-resolution logic.
- `manifest.json`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — PWA install.
- `data-src/` — provenance: the inKind recon pull, per-batch research JSON, and the
  generator script. Read-only history, not used at runtime.

## Schema (frozen for v1)

```
file: { schema_version: 1, generated: "YYYY-MM-DD", generator: str, coverage: str, venues: [venue] }
venue: {
  id: "ik-<int>", inkind_id: int, name: str, city: str, neighborhood: str, address: str, zip: str,
  lat: number, lon: number, tz: "America/Chicago",
  inkind: true, inkind_url: url, official_site: url|null, status: "open",
  hours: { MON..SUN?: [[ "HH:MM","HH:MM" ], ...] },   // from inKind; days absent = closed that day
  hours_source: str,
  windows: [window],                                   // [] = verified no happy hour (see verified_no_hh)
  verified_no_hh: bool, checked: "YYYY-MM-DD", disagreements: [str], notes: str }
window: {
  days: ["MON".."SUN"] (non-empty, unique, in week order),
  start: "HH:MM", end: "HH:MM" | "close",
  area: str|null, kind: "happy_hour" | "special",
  deals: [ { type: "food"|"drink", desc: str, price: str|null } ],   // may be []
  sources: [url] (non-empty), last_verified: "YYYY-MM-DD"|null,
  corroborated: bool, confidence: "high"|"med"|"low", notes: str }
```

## Semantics

- `days` = the calendar day the window STARTS, in venue tz (all v1 venues are
  `America/Chicago` — the app asserts this at load and shows an error banner rather
  than guessing if it's ever untrue).
- A window is ACTIVE at instant t if, for some day D in `days`, t ∈ [D start, D end).
  If `end <= start` (e.g. 22:00→02:00) the end is on D+1.
- `end: "close"` resolves to the LAST closing time in `hours[D]`; if that closing time
  is `<=` the window start (e.g. "00:00", "03:00") it is on D+1. If `hours[D]` is
  missing, the window is treated as ending at 23:59 on D and gets a data-warning badge.
- STARTING SOON = not active now and the window's next start is within 120 minutes.
- STALE = `last_verified` null OR older than 60 days from the phone clock's date.
  UNVERIFIED = `confidence == "low"`. Both render as a badge; neither hides a venue.
- FOOD-FIRST is render-time: a window "has food" iff any deal has `type: "food"`.
  Default UI: full-colour = has food; muted = drink-only or `deals: []`. The toggle
  flips to drink-forward — nothing is ever filtered out at the data level.
- `kind: "special"` windows render in the NOW view with a small "special" tag and in
  the DAY GRID with a hatched block. They count toward "live now".
- A window on a day the venue's own `hours` say it's closed is still evaluated (the
  window data wins) but gets a "Hours conflict" badge — never silently dropped.
- Debug override: `?now=YYYY-MM-DDTHH:MM` in the URL forces the clock to that literal
  America/Chicago wall-clock time. Ignored unless the param is present.

## Refresh runbook (do manually twice before ever automating)

1. Open a browser tab **on `app.inkind.com` itself** (cross-origin fetches are
   blocked — this must run same-origin, from a real tab, never from the published
   page at runtime) and pull `GET https://app.inkind.com/api/v5/map`.
2. Normalize whitespace in `city`/`zip` strings (they arrive dirty, e.g. `" Nashville"`).
3. Filter to `state == "TN"` and the metro cities used in v1 (Nashville, Franklin,
   Murfreesboro, Smyrna, Brentwood, Mt. Juliet, Hendersonville, Gallatin, Antioch,
   Spring Hill, Dickson, Lewisburg).
4. Diff names/ids against `venues.json`. Research ONLY new names (official site first,
   then Nashville Guru + one more source). Bump `last_verified`/`checked` on re-checks
   of existing rows.
5. A pull returning 0 venues is a **FETCH BREAK**, not a market exit — stop, do not
   write an empty roster over a good one.

## Development

```
node validate.js venues.json   # schema/semantic check, exits non-zero on failure
node --test                    # window-resolution logic tests
python3 -m http.server 8000    # serve locally, then open http://localhost:8000/
```
