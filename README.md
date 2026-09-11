# Nashville inKind Happy Hour Radar

A phone-usable page that answers "it's 7pm — which inKind partners near me have a
happy hour now or in the next 2 hours?" Food discounts are the priority; drinks
secondary.

Static site, no backend, no build step: `index.html` + `venues.json` + `logic.js`.
Data is pulled from inKind and researched by hand, then **baked into venues.json and
committed** — the published page never calls inKind or any other site at runtime.
Your phone's clock and GPS are the only inputs; GPS coordinates never leave the device.

One deliberate exception since v1.5: tapping **Send** in the feedback box POSTs your
note to a Google Form (see *Feedback inbox* below). Nothing else on the page ever makes a
network call beyond its own three files.

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

## Feedback inbox (v1.5, rewritten for strangers in v1.6)

The page's "Feedback" box (bottom of the page, plus a link in the header) is a published
Google Form used as a dumb inbox. Anyone can send a note — no Google account, no GitHub
account, no sign-in of any kind. Notes are held in `localStorage` until the user taps
**Send**, which POSTs each one to the Form's `formResponse` endpoint with
`fetch(url, { method: 'POST', mode: 'no-cors', body: FormData })`.

v1.6 rewrote the box for a reader who has never heard of this project: **Send** is the one
obvious action (it adds whatever is typed and then sends, so there is no separate "add"
step), **Save for later** is the secondary, and "Prefer a form? Open it" is a text link
rather than a third button. The v1.5 "me / someone told me" toggle is gone — it encoded the
maintainer's relay case and meant nothing to anyone else — and with it the `relayed:` flag
on the context line. Three optional chips (👍 Liked it · 💡 Idea · 🐛 Problem) prefix the
note with `[liked]` / `[idea]` / `[problem]` so the inbox sorts itself; the tagging rule is
`composeNote()` in `logic.js`, which is where the tests can reach it.

- Form (public, no sign-in, no email collection):
  `https://docs.google.com/forms/d/e/1FAIpQLSd8agMFwn3sKsTHR3q5jn9oUyn72UTeHBBZDFWd9zmTlBe83Q/viewform`
- Fields, hard-coded in `index.html`: `entry.1197018871` Note · `entry.1201373577` From ·
  `entry.432176984` Context. **These ids change if the Form is edited** — re-read them from
  the live viewform's `FB_PUBLIC_LOAD_DATA_` after any edit, or Send quietly stops landing
  rows (the `no-cors` response is opaque, so the page cannot detect the failure — which is
  also why "Sent — thank you." is a statement about the request leaving the device, not
  about Google accepting it).
- Responses land in the private Sheet **"hh-radar feedback inbox"**
  `https://docs.google.com/spreadsheets/d/1k1sabNdi95VKwQoLj8E6VAEoqeALABE3CgblgnpsykQ/edit`
  (tab "Form Responses 1"; columns Timestamp · Note · From · Context).
  **The Sheet's Timestamp column is UTC, not Central** — it reads about five hours ahead of
  the note's own clock. Every note's Context line carries the local time it was written
  (`... · noted YYYY-MM-DD HH:MM local`), so use that when the two disagree. Code cannot
  change a Sheet's time zone; the fix is manual and belongs to the Sheet's owner:
  File → Settings → Time zone → (GMT-06:00) Central Time → Save.
  The Sheet stays **private — no link-sharing**. The read path is the Drive connector, from
  the thinking thread; there is deliberately no CSV-export tooling in this repo. A Code
  session that needs the notes gets them pasted in.
- Each note carries an auto-generated context line: app version, view (NOW, or GRID + day),
  zone filter, sort, Food/Drink mode, any `?now=` override, the last card the user expanded,
  viewport width, standalone (home-screen) yes/no and a coarse browser family. **Never a
  location** — `state.geo` is not read by the feedback code at all. The box says all of this
  in plain words under "What gets sent with a note", and shows the live line underneath it.

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
- Debug override: `?pos=LAT,LON` forces the reader's position to that point (v1.8), so a
  drive-time verdict can be checked from a known corner of the map without standing there.
  Same contract as `?now`: ignored unless present, **never written to localStorage**, never
  sent anywhere, and it blocks the real Geolocation API from overwriting it for that page
  view. The NOW view prints a red "debug position … — not your real location" line whenever
  it is in force, so a screenshot can never be mistaken for a real one.
- Drive time is a **straight-line estimate computed on the phone** (v1.8): crow-flight miles
  x 1.35 for urban detour, then 18/24/32 mph by distance band, plus five minutes to get out
  the door and five to park. No routing API, no backend, no position leaving the device —
  which is exactly why every line reads "≈" and why the address on a card is a link into the
  reader's own maps app, where the real ETA lives. Walk mode is 3 mph over a 1.25 detour.
  The band table is floored so the estimate can never *fall* as the distance grows (see
  `driveEstimateMin` in logic.js).
- The address on a card opens **Waze, Apple Maps or Google Maps** — chosen once per phone.
  The first tap on any Directions link asks; the answer is stored in `hhradar-navapp` and
  changed later under Settings at the foot of the page. Before a choice is made the link
  points at Apple Maps on Apple platforms and Google Maps elsewhere.

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
node validate.js venues.json            # schema/semantic check, exits non-zero on failure
node validate.js venues.json --strict   # same, but also fails on lint warnings (see below)
node --test                             # window-resolution logic tests
python3 -m http.server 8000              # serve locally, then open http://localhost:8000/
```

`validate.js` also runs a WARN-level lint over every `deal.desc` (research prose or
source-hedging language leaking into menu text, an overlong parenthetical, or a
description over 140 chars) and prints hits without failing the build — pass
`--strict` to make lint hits fail too. A hit isn't automatically wrong: most are
legitimately long menu-item descriptions (an ingredient list in parentheses); only
rewrite ones that are actually reviewer commentary (moving it to the window's
`notes` field instead).
