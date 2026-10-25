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
network call beyond its own files (the page, `logic.js`, `venues.json`, the icons, and on
desktop the referral QR image). The footer's referral, LinkedIn and GitHub links are plain
links: nothing is fetched until the reader taps one.

Coverage (refresh of 2026-10-23, v1.10; hours corrected in v1.11; 615chuTNey dropped as
permanently closed in v1.12; a browser pass of Google business listings and venue sites on
2026-10-25, v1.14; deal text cleaned and two unexplained specials dropped in v1.20; Blue Coast's
Tuesday family night dropped in v1.21): **159** inKind
partners in the Nashville metro per inKind's own map API, every one researched by hand: hours, happy
hour, lunch specials. **140 windows** (99 happy hour, 37 special, 4 lunch). **68** venues have a happy
hour, **85** were checked and have no window at all, and **6** have only a special or lunch window
(measured on the v1.21 data); none is "not checked yet". Hours: 41 venues
carry Google-listing hours and 3 their own site's (v1.14), 109 the 2026-10-23 research, 1
inKind's 2026-09-05 hours; 4 are marked unconfirmed (low confidence) and 5 have none on file.
One venue (Punk Wok) carries a temporary closure.
v2 (parked) would fold in non-inKind aggregator listings.

## Files

- `index.html` — the app (NOW view + DAY GRID), inline CSS + UI/rendering JS.
- `logic.js` — pure date/window-resolution + schema-validation functions, shared by
  `index.html`, `validate.js`, and `tests/windows.test.js` (one source of truth).
- `venues.json` — the data. Don't hand-edit; fix via `data-src/` + regenerate, or a
  documented manual edit noted in `CHANGELOG.md`.
- `validate.js` — Node schema/semantic validator (`node validate.js venues.json`).
- `tests/windows.test.js` — `node --test` suite for the window-resolution logic.
- `manifest.json`, `icon-192.png`, `icon-512.png`, `apple-touch-icon.png` — PWA install.
- `og-preview.png` — the 1200x627 link-preview image (Open Graph / LinkedIn), a real
  screenshot of the NOW view taken with `?now=2026-10-27T17:30` (re-taken in v1.20 for the new subtitle and card
  lines: light theme, storage cleared, referral bar dismissed, the v1.12 framing).
- `inkind-referral-qr.svg` — the QR for the inKind referral link, shown on desktop only.
- `venmo-qr.svg` — the QR for `TIP_URL` (v1.13), shown on desktop only.
- `data-src/` — provenance: the inKind recon pull, per-batch research JSON, and the
  generator scripts. Read-only history, not used at runtime. `data-src/refresh-20261023/`
  is the worked example of a full refresh (see *Refresh runbook*).

## Tip link (v1.10, set in v1.13)

`index.html` carries one constant, `TIP_URL`, next to `APP_VERSION`. Since v1.13 it is set
to TJ's Venmo, `https://venmo.com/u/Tjwhite-` (TJ, 2026-10-23: "I don't mind using my
personal venmo"). The card it draws (`tipSectionHtml` in logic.js) sits between the
referral and Feedback in the referral's style: "Enjoying the radar?" (v1.14; "Like the
radar?" before) / "Tip on Venmo:
@Tjwhite-", the handle being the url's last path segment, linked in a new tab with
`rel="noopener"`. Since v1.17 it has no QR on any platform (TJ, 2026-10-25: "one QR code -
dont hide"); the referral card's is the page's only one. Set `TIP_URL = ''` and nothing
renders and nothing is in the DOM.

## Referral bar and card (v1.10, bar v1.14, tap-to-dismiss v1.15)

The inKind referral card ("New to inKind?") sits between Settings and the tip card. Since
v1.14 it is tinted with the amber tokens in both themes and its link is a "Get $25 off"
button (new tab, `rel="noopener"`); desktop keeps the QR beside it, captioned "Scan for $25
off" since v1.17. A thin bar above the
header ("New to inKind? $25 off your first $50+ meal →") only scrolls to that card and rings
it for a moment; it never opens inKind itself, so the card's disclosure is always seen
first. Its × (aria-label "Dismiss") hides it and writes `hhradar-refbar-dismissed`; since
v1.15 tapping the text does the same (`followRefBar`), so the bar is gone when the reader
scrolls back up. When storage is blocked the bar simply shows again next visit
(`refBarDismissed` / `dismissRefBar` in logic.js). No referral card, no bar.

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

## Schema (v2, since v1.10)

```
file: { schema_version: 2, generated: "YYYY-MM-DD", generator: str, coverage: str, venues: [venue] }
venue: {
  id: "ik-<int>", inkind_id: int, name: str, city: str, neighborhood: str, address: str, zip: str,
  lat: number, lon: number, tz: "America/Chicago",
  inkind: true, inkind_url: url, official_site: url|null, status: "open",
  hours: { MON..SUN?: [[ "HH:MM","HH:MM" ], ...] },   // days absent = closed that day; {} = none on file
  hours_source: str,                                   // where the hours came from, and when (see below)
  hours_confidence?: "high"|"med"|"low",               // optional (v2); "low" shows as "unconfirmed"
  hours_notes?: str,                                   // optional (v2); research notes on the hours
  lunch_checked?: bool,                                // optional (v2); lunch specials were looked for
  temp_closed?: [ { from: "YYYY-MM-DD", to: "YYYY-MM-DD", note: str, source: url } ],
                                                       // optional (v1.12); both dates inclusive, from <= to
  windows: [window],
  verified_no_hh: bool, checked: "YYYY-MM-DD", disagreements: [str], notes: str }
window: {
  days: ["MON".."SUN"] (non-empty, unique, in week order),
  start: "HH:MM", end: "HH:MM" | "close",
  area: str|null, kind: "happy_hour" | "special" | "lunch",
  deals: [ { type: "food"|"drink", desc: str, price: str|null } ],   // may be []
  sources: [url] (non-empty), last_verified: "YYYY-MM-DD"|null,
  corroborated: bool, confidence: "high"|"med"|"low", notes: str,
  research_notes?: str }                               // optional (v1.12); see Semantics
```

What changed from v1 (the validator, `validateVenues` in `logic.js`, enforces exactly this):

1. `schema_version` must be **2**.
2. `verified_no_hh` no longer has to equal `windows.length === 0`. The only error is
   `verified_no_hh: true` on a venue that has a `kind: "happy_hour"` window. So:
   `windows: []` + `verified_no_hh: true` = checked, no happy hour;
   `windows: []` + `verified_no_hh: false` = **happy hour not checked yet**;
   a venue with only a lunch or special window can be verified no-HH.
3. `kind` may also be `"lunch"`.

The optional venue fields (and, since v1.12, `temp_closed` and the window's
`research_notes`) are type-checked when present and fine when absent; the schema version
stays 2.
`hours_source` now names where the hours came from: the 2026-10-23 refresh writes
`researched YYYY-MM-DD (high|med|low confidence): <url> [<url>]`, `inKind map API
YYYY-MM-DD (...)` for the 11 venues that kept inKind's older hours, or `none found
YYYY-MM-DD`. (In v1 the hours always came from inKind; inKind stopped publishing them.)

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
- `kind: "lunch"` (v1.10) is handled exactly like `special` (NOW lists, counts, food-first
  ranking, grid rows; like specials it is not in the Surprise me pools, which promise a
  happy hour) except: its tag reads "lunch", its grid block is a dotted green block of its
  own, and it is never "all-day" (`isAllDay` stays gated on `special`).
- **All-day** (`isAllDay`): a `special` whose resolved span on a day it runs is 5 hours or
  more. v1.13 dropped the old "starts before 2pm" rule, so a short morning special (The
  Loading Dock, 7–9am) is a normal block that can start soon.
- **"Not checked yet" is never "no happy hour"** (v1.10). Anything that counts verified
  no-HH venues counts only `windows: []` + `verified_no_hh: true`. The Day Grid footer
  lists the others separately as "N not checked yet", each reading "Happy hour not
  confirmed yet".
- **Venue hours on every card** (v1.10, `hoursStatus` in logic.js): "Open · closes 9pm",
  "Closed 2:30–5pm · reopens 5pm" (closed now between two of today's ranges), "Opens 5pm",
  "Closed today", "Closed for the day", or "No hours on file". A range whose close is
  `<=` its open ends on D+1, the same rule as `end: "close"`, so a range that started
  yesterday and runs past midnight reads as open now. Ranges that touch are one stretch.
  The expanded card shows the whole week (`weekHours`; a split day is two ranges) and one
  line saying where the hours came from and the date, plus "unconfirmed" when
  `hours_confidence` is `"low"`. The hours line is about the clock, never a filter:
  a happy hour on a day the hours say closed still shows, with its "Hours conflict" badge.
- A window on a day the venue's own `hours` say it's closed is still evaluated (the
  window data wins) but gets a "Hours conflict" badge — never silently dropped.
- **Open hours on the Day Grid** (v1.11, `openBands` in logic.js): every row carries a
  quiet grey band behind its deal blocks for the venue's open ranges that day (built from
  the same merged ranges as `hoursStatus`), so open, close and a closed gap between lunch
  and dinner read at a glance. A range past midnight runs to its real close; bands clip to
  the grid's axis (11am–2am, or earlier for a morning deal since v1.12). `hours_confidence: "low"` bands are fainter with a dashed edge;
  no hours on file = no band. Blocks always sit on top, including any that fall outside
  the band.
- **Temporary closures** (v1.12, `temp_closed`). When today's date (America/Chicago) is inside
  a range, the card's hours line reads "Closed until Thu, Oct 29" (the day after `to`) plus
  the range's note, and wins over every other hours state. The venue's windows on those dates
  are not live, not starting soon, not on the map's live dots and not in either Surprise me
  pool, and its Day Grid row for such a date shows a plain "Closed (temporary)" label instead
  of bands and blocks. A grid weekday stands for its next date (today or later). The windows
  stay in the data. A range in the past never matches.
- **Outside posted hours** (v1.12, `outsideHoursDays`). A window interval on a day the venue
  IS open that is not wholly inside one of the merged open stretches `hoursStatus` uses
  (early start, a deal in a lunch–dinner gap, a close after the venue's) gets one
  "Outside posted hours" badge on its card. Never hidden. A window on a day the hours leave
  out entirely keeps "Hours conflict" instead.
- **Morning deals on the Day Grid** (v1.12, `gridAxisStart`). The axis starts at 11am unless
  a shown row has a window drawn as a normal block (v1.13 `gridBlockStarts`: not an all-day
  bar) starting earlier on the selected day; then it starts at that hour
  (rounded down, never before 6am). Bands, blocks, hour lines and the now line follow it. A
  phone labels every 2nd hour, every 3rd once the axis runs past 15 hours. Rows for a
  temporarily closed date do not move the axis.
- **Deal lines** (v1.12, `dealPriceLabel`): text, then the price as its own muted token, no
  dash. The price is left out when the text already says it (every number in it appears in
  the text; or, for a wordy price like "half price", the price itself does, ignoring case and
  spacing). A leading minus reads as a discount: "-$2" -> "$2 off".
- **Window lines** (v1.20 C2, `L.windowLine`). Every card, in every view, prints each deal
  window's kind, days, times and area on one line directly above that window's deals, in the
  deal text's colour and weight: "Happy hour · Mon–Fri 4–6pm · bar only", "Lunch special ·
  Tue–Fri 11am–2pm · dine-in only", "Special · Tue 5–8:30pm". It is the only place a card
  says when (the old green lunch line and grey schedule line are gone). Day lists read as
  ranges (`formatDays`: "Mon–Sat", "Mon, Wed–Fri", "Daily"; a pair stays "Sat, Sun").
- **"close"** (v1.20 C3, `L.windowTimeLabel`). A window that ends at "close" prints the venue's
  real close for its days ("5–8:30pm", "9pm–2am"); when its days close at different times, or no
  hours are on file, it says "11am until close" and never invents one. The Day Grid card, its
  block labels and the "other days" list use the same rule for their one day.
- **Day Grid card** (v1.20 C4). It describes the selected day: "Tue: open 11am–9pm" (or "Tue:
  closed"), not the live clock. Only NOW shows "Open · closes 9pm". "Opens…" is never red; red is
  kept for closed today, hours conflict and outside posted hours.
- **Source notes** (v1.20 C8, `L.sourceNoteLines`). The expanded card's "Source notes" shows one
  sentence built from the data: "Checked on <first source's host> · <last_verified>", plus
  "Sources disagree — check before you go" when the venue has `disagreements`. The research prose
  (`notes`, `research_notes`, `disagreements`) stays in the data and is not rendered. A window with
  `research_notes` still shows its reader-facing `notes` as a quiet line under the deals.
- **Badges** (v1.20 C9). inKind, Special, Lunch, Verify before you go (low confidence or not
  checked in 60 days; this replaced Unverified), and the red hours warnings. Each explains itself
  on hover or focus, and a one-line key sits under the NOW list and the Day Grid. "Deal info"
  (was "HH info") opens the window's best source.
- **Day Grid marks** (v1.20 C5/C6). A block prints its times inside it ("4:30–6:30") when they fit,
  otherwise nothing; every day's blocks look alike (only today has the now line). The legend under
  the grid names every mark with the grid's own swatches.
- **Location** (v1.20 C7). With no position, Drive / Walk and the Distance sort say "needs location"
  and are not shown as selected; choosing one shows the "Ask again" prompt, and the choice applies
  as soon as a position arrives.
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
- The address on a card opens a maps app — chosen once per phone. The first tap on any
  Directions control asks; the answer is stored in `hhradar-navapp` and changed later under
  Settings at the foot of the page. Before a choice is made it points at Apple Maps on Apple
  platforms and Google Maps elsewhere. The options are per-platform (v1.9): Android offers
  Waze / Google Maps / Default maps app, iOS offers Waze / Apple Maps / Google Maps, and a
  desktop browser offers Apple Maps / Google Maps / Waze web.
- **The Directions control launches the app directly, never through its web page (v1.9).**
  On a phone it is a `<button>` with no `href` and no `target`, and the tap calls
  `location.assign()` on an Android `intent://` url or an iOS `scheme://` url from the same
  page. This is not a style preference: an `https://waze.com/ul` "universal link" is a web
  page first and a hand-off second, so v1.8 opened a tab, loaded waze.com, then switched to
  the app — and backing out of that tab closed it and dropped the reader out of the radar.
  An intent that resolves brings the app forward *without unloading the page*, so the radar
  is still there, same scroll, same open card, on return. Android `intent://` carries its own
  `S.browser_fallback_url`; `geo:` and the iOS schemes do not and fail silently, so those arm
  a 1.2s timer (`NAV_FALLBACK_MS`) that offers a "Didn't open? Open in browser ↗" line if the
  page is still visible — i.e. if nothing ever came forward. Desktop keeps a plain `<a>`,
  because there is no app to launch.

## Refresh runbook (rewritten in v1.10 from what worked on 2026-10-23)

Worked example: `data-src/refresh-20261023/` (the TSV, the research brief, the four
research batches, the merge script, the hood script and the merge report).

1. In a real browser tab **on `app.inkind.com` itself** (cross-origin fetches are blocked,
   so this runs same-origin from a real tab, never from the published page), make one
   same-origin `GET /api/v5/map`. A pull returning **0 locations is a FETCH BREAK**, not a
   market exit: stop, and never write an empty roster over a good one.
2. In that page, build the TN rows as tab-separated text (the fields of
   `data-src/refresh-20261023/inkind-tn-20261023.tsv`; `zip` now comes from
   `location.zip_code`), take its SHA-256, put the text in the page body, read it back as
   page text, write the file, and compare the hashes. The browser tool truncates script
   return values and blocks base64, and page text turns tabs into spaces, so mark the tabs
   with a placeholder first and restore them after.
3. Diff ids against `venues.json` (new / gone / unchanged). inKind no longer publishes
   hours or happy-hour flags (2026-10-23: `operating_hours`, `happy_hour`, `lunch` and every
   meal flag absent from all 10,975 rows), so inKind is the **roster only** and EVERY venue
   is researched: follow `data-src/refresh-20261023/BRIEF-v2.md`.
4. Merge with the merge script (`merge_20261023.py` is the model), then give each new venue
   its hood **by hand from its street address** (v1.16: `post_20261025l.py` is the model —
   one of the 36 keys in `logic.js` `ZONES`, with `zone` = `zoneOf(hood)`). The hood script
   (`hood_new_20261023.js`, `nearestNeighborhood` + `zoneOf`) is only a fallback for a venue
   nobody has placed yet: nearest-centroid misfiled 7 of the core venues before v1.16, so
   check what it picks against the address. A new hood key needs a `ZONES` entry and a
   `NEIGHBORHOOD_CENTROIDS` entry. Then `node validate.js venues.json` and
   `node --test`. Data-coupled tests (map containment, coverage counts) will name anything
   the new roster moved; a dot that falls outside its own zone's drawn polygon goes in the
   named `MAP_SEAM_EXCEPTIONS` list in `tests/windows.test.js`, with a reason, rather than a
   redrawn polygon. A hood chip only appears once one of its venues has a happy hour
   (computed at load); there is no list of hidden hoods to maintain.
5. Cadence: monthly. Next due around **2026-11-23**. Still by hand; automate nothing yet.

## Development

```
node validate.js venues.json            # schema/semantic check, exits non-zero on failure
node validate.js venues.json --strict   # same, but also fails on lint warnings (see below)
node --test                             # window-resolution logic tests
python3 -m http.server 8000              # serve locally, then open http://localhost:8000/
```

`validate.js` also runs a WARN-level lint over every `deal.desc` (research prose or
source-hedging language leaking into menu text, an overlong parenthetical, or a
description over 140 chars) and, since v1.11, a closed-day lint ("<venue>: <kind> window on
<D> but hours say closed"; plus "hours may be incomplete" when the hours cover 2 or fewer
days and a window falls on another), since v1.12 an outside-hours lint ("<venue>: <kind>
window HH:MM–HH:MM outside posted hours on <days>", the same rule as the card badge), and
prints hits without failing the build — pass
`--strict` to make lint hits fail too. A hit isn't automatically wrong: most are
legitimately long menu-item descriptions (an ingredient list in parentheses); only
rewrite ones that are actually reviewer commentary (moving it to the window's
`notes` field instead).
