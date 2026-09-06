# Changelog

## 2026-09-06 — BLOCK-hh-radar-fix2-20260906: v1.2 (card interaction, source button, isAllDay scope)

Per TJ's second-round feedback ("there should be an easy way to get to the link to the
happy hour info directly with another like an addional button next to the resturant -
instead of more it should just display the full thing. also if you click on the box
anywhere it should minimize it instead of clicking on the header.") and the reviewing
thread's own live measurements. C1-C5 implemented; see the block for full acceptance
criteria. Highlights:

- **Source button (C1):** every card now shows two always-visible action buttons beside
  the venue name — "HH info ↗" and "inKind ↗" — each a real `<a target="_blank">` with a
  ≥40×40px tap target. `logic.js#bestSourceUrl(venue, win)` picks the window's own source
  whose hostname matches the venue's official site (falling back to the first source, then
  the official site, then the inKind listing) so "HH info" opens the actual happy-hour page,
  not just the homepage. Both buttons (and the provenance "more" `<details>`) stop click
  propagation so tapping them never toggles the card.
- **Deals always in full (C2):** removed the "+N more" truncation entirely — every card
  lists its complete deal set, food-first, whether collapsed or expanded. Collapsed now
  means header + badges + the full deal list; expanded adds the window's area/schedule
  (`logic.js`-driven day/time line) and research provenance. Removed the now-redundant
  bottom "Official site / inKind" links (superseded by the always-visible C1 buttons) and
  the `max-height: 40vh` collapse cap (obsolete once collapsed cards show every deal — a
  15-deal card is simply as tall as it needs to be).
- **Whole card toggles (C3):** the entire card is the toggle — click/tap anywhere, plus
  keyboard Enter/Space (`role="button"`, `aria-expanded`, `tabindex="0"`). In the Day Grid,
  the inline card always renders expanded (no separate per-card collapse there); tapping it
  anywhere closes the whole inline panel, tapping the row again reopens it. Fixed a real bug
  found while wiring this up: `.grid-expanded` was a DOM *sibling* of `.grid-row`, not a
  descendant (`.grid-row` is a fixed-height flex timeline row that can't contain it), so
  `closest('.grid-row')` from inside an open grid card silently failed to find its venue.
  Wrapped both in a `.grid-row-group` so the click delegation resolves correctly.
- **isAllDay scope fix (C4), the reported regression:** `isAllDay` now gates BOTH of its
  rules (span ≥ 5h, or start < 14:00) on `kind === 'special'`. Previously the span rule
  applied to any window regardless of kind, so a long but perfectly real `happy_hour`
  window (Blue Sushi 11:00-18:30, 7.5h) was misclassified as "all-day" and excluded from
  "starting soon" / the NOW-view empty state's "next" pick. `?now=...T03:30` now correctly
  names "Blue Sushi - 5th & Broadway at 11am (Tuesday)" instead of Saint Anejo's later
  2pm slot.
- **v1.2 (C5):** footer bumped from `v1.1`.

**Verified live in a local static-server preview** (375px viewport, `?now=` overrides):
JINYA's card renders all 15 deals with no "+N more" anywhere in the DOM; clicking deal
text toggles `aria-expanded` and clicking either action button does not; the Day Grid
still fits the viewport with no horizontal scroll after the `.grid-row-group` change;
`node --test tests/windows.test.js` — 24/24 passing; `node validate.js` — 0 errors, same
pre-existing lint warnings as v1.1 (legitimate long menu parentheticals, unrelated to this
block).

**Bug found while confirming the live deploy, not in the block:** the first post-push
check of https://cumberlandworks.github.io/hh-radar/ hit `L.bestSourceUrl is not a
function` and a fatal-error screen — reproduced in a brand-new browser tab too, so not a
one-off. Cause (confirmed with `curl -I`): GitHub Pages serves both `index.html` and
`logic.js` with `cache-control: max-age=600`, and `<script src="logic.js">` had no
cache-busting query string. A browser that had fetched the old `logic.js` any time in the
prior 10 minutes kept using it even after fetching the new `index.html`, producing a
mixed v1.1-logic/v1.2-markup page — worse than the plain staleness the v1.1 footer-version
change was meant to make visible, because this block's index.html now calls a function
(`bestSourceUrl`) that only exists in the new `logic.js`, so the mismatch is a hard crash,
not just an old-looking page. Fixed by versioning the script tag
(`logic.js?v=1.2`, bumped alongside `APP_VERSION`), which forces a fresh fetch on any
version bump regardless of the old copy's remaining cache lifetime. Re-verified clean
after the fix; confirmed on the live site once its own cache window passed.

## 2026-09-05 — BLOCK-hh-radar-fix1-20260905: v1.1 (grid usability, NOW-view ranking, data hygiene)

Per TJ's first-look feedback ("there needs to be better sorting on the day grid and
a better way to scroll the day vs going all the way to the bottom") and the
reviewing thread's own measurements. All seven change groups (C1-C7) implemented;
see the block for full acceptance criteria. Highlights:

- **Day Grid (C1/C2):** rewritten to fit the viewport width with no horizontal
  scroll (blocks positioned by CSS %, not fixed px); day tabs + hour header now
  genuinely sticky while scrolling (see bug note below); rows are pruned to only
  those with a window on the selected day, with a "N venues have nothing on
  &lt;DAY&gt;" footer note; added a Time/Distance/Name sort control; tapping a row
  opens an inline card for that day's window(s).
- **NOW view (C3):** split into three ranked sections — Live now (soonest-to-end
  first), Starting soon (soonest-to-start first), All-day specials — and cards
  collapse to 3 deals + "+N more" by default (the Bar Mar card was ~1300px tall
  on a phone; now well under 40% of viewport height collapsed). Tap a card to
  expand the full deal list, links, and research notes.
- **Semantics (C4):** added `logic.js#isAllDay` — a window with a resolved span
  ≥5h, or a `kind: special` window starting before 14:00, is "all-day" and no
  longer allowed to win the NOW-view empty-state "next happy hour" pick or count
  as "starting soon" (`startsWithin`/`nextStart*` take `{excludeAllDay:true}`).
  Fixed the reported bug (`?now=...T03:30` no longer names an all-day mimosa
  deal as "next").
- **Data hygiene (C5):** rewrote 6 deal descriptions that had research
  commentary/provenance leaked into the menu text (moved to the window's own
  `notes`, which in most cases already had the full story); added a WARN-level
  lint for this pattern to `validateVenues`/`validate.js --strict` (37 residual
  hits are legitimate long menu-item parentheticals, not commentary — see
  README). Merged 51 North Taproom's two duplicated TUE/WED/FRI and SAT/SUN
  window-pairs into one each (9 windows → 7). "Hours conflict" badge now reads
  "No hours on file" for the two venues (Bar Mar, Butterfly) with no `hours`
  data at all.
- **Neighborhood (C6):** replaced the free-text heuristic on the 101
  auto-added venues with a nearest-centroid lookup over a 19-point Nashville-
  metro hand table (`logic.js#nearestNeighborhood`), marking those rows
  `neighborhood_source: "centroid"`. The original 35 inKind venues' hand-set
  neighborhoods are untouched. Fixes Bar Mar showing as "12 South" (now "The
  Gulch") and several venues showing as the bare metro name "Nashville".
- **Small (C7):** footer now shows `v1.1` (`app_version`) so a stale phone
  install is visible at a glance; still no service worker (confirmed), so this
  is a plain cache-bust, not a network-first SW change.

**Bug found during implementation, not in the block:** `html, body { overflow-x:
hidden }` (present since v1, meant to guard against the old grid's forced
horizontal overflow) silently breaks `position: sticky` for every descendant in
this WebKit-based environment — the app header and Now/Day-Grid tabs were never
actually sticking in v1, this just went unnoticed because nothing had scrolled
far enough to show it. Removed now that C1's rewritten grid no longer forces any
horizontal overflow. The same issue existed one level deeper (`#grid-wrap`'s
`overflow: hidden`, added to clip the rounded corners, broke the hour-header's
stickiness) — fixed by moving the sticky hour-header outside that clipping
container in the DOM.

**Discrepancy vs. the block's own C2 acceptance example, reported not silently
"fixed":** the block's accept line assumes the TUE grid tab (Time sort) opens
with a Blue Sushi 11:00 row first. In the actual data, several venues (Two
Hands' mimosa carafe, others) have an all-day-flagged window starting at 08:00
on Tuesdays, which legitimately sorts earlier under the literal C2 rule ("by
start time ascending") — the C2 spec doesn't say to exclude all-day windows
from the Day Grid's own row ranking (only C3/C4's NOW-view logic does that).
Excluding them from the grid ranking isn't a clean fix either: the span-based
half of `isAllDay` (≥5h) also flags several genuinely time-bound long happy
hours (Blue Sushi's own 11:00-6:30pm window is 7.5h), so filtering them out of
the grid's "earliest start" would demote Blue Sushi too, past a 2pm start.
Implemented C2 literally (no all-day filtering in the grid sort); flagging
this rather than silently overriding the spec in either direction.

## 2026-09-05 — STEP 0 interview (verbatim) + build

Per `BLOCK-hh-radar-build-20260905`, asked in one round before any file was written:

**Repo creation mechanism** (not in the original block — `gh` CLI and a stored GitHub
API token weren't available in this environment, only working SSH push access):
> "install what you need instead of using the browser"

Applied: downloaded the official `gh` CLI release binary from GitHub directly (no
Homebrew available), ran `gh auth login --web` device flow, TJ authorized it in a
browser. Used from then on to create the repo and enable Pages.

**A. Repo name/visibility/account** — hh-radar / public / cumberlandworks (Recommended)
**B. Backbar/Connie's branding** — "Yes — keep as inKind (Recommended)" — badged
"verify inKind credit on first visit"
**C. Verna's two overlapping windows** — "Yes, ship both (Recommended)"
**D. `special`-kind windows in NOW view** — "Yes, show with a "special" tag (Recommended)"
**E. Distance sort radius** — "Show everything, sorted by distance (Recommended)"
**F. Colour language / dark mode** — "Yes, use that (Recommended)" (full=food,
muted=drink-only; dark mode follows system)
**G. Add venues before v1 ships** — selected "Add venues before v1 ships" (declining
the block's own default of "No — v2"), then on follow-up:
> "all the ones possible - also as a suggestion my command center uses what is called
> a sidecar - a python script that runs locally on a schedule that can look at a
> sitemap and record details - it uses it for find jobs on carer pages, but it may be
> helpful here as well. for both the inkind site and for other sites it needs to
> gather the data, nashvilleguru or whatever- it does run in a way that make it not
> seem like a bot to make sure it doesn't get shut down."
**H. `?now=` debug override** — left unselected in the "remove it" option → default
kept (stays in the shipped page).

**Deviation from the block, said out loud:** G expands v1 scope well beyond the
locked "v1 = the 35 inKind venues only, do not gold-plate v1" decision — TJ's call to
make, and G's answer overrides it for this build. **Did not** build the suggested
bot-camouflage sidecar scraper: (1) a direct `curl` to inKind's map API from this
environment hung/timed out — same-origin browser fetch (the method the original
recon already used and validated) is what actually works, not a disguise problem to
solve; (2) for the other ~101 unflagged metro rows (65 distinct brands after
dedup), each brand was researched the same way as the original 35 — official site
first, then Nashville Guru + one more independent source, via ordinary web
fetches/searches, no special evasion. See the workflow run for the research pass and
counts actually added below.

**Research pass on the 65 unflagged brands (101 individual locations):** ran research
+ adversarial-verify agents per brand (official site → Nashville Guru → one more
source; a second pass agent re-checked each non-empty finding's cited sources before
it shipped). See `data-src/unflagged-research-results.json` for the raw per-brand
output. Brands found with no recurring happy hour/special were recorded with
`verified_no_hh: true`, `windows: []` — same as the original "Bad Idea" precedent, not
silently omitted.

**Neighborhood field for the auto-added batch** is a best-effort heuristic guess (not
hand-verified per venue like the original 35's `NEIGHBORHOOD` table) — cosmetic only,
does not affect window logic.

**Files added/changed:** `index.html`, `logic.js`, `validate.js`,
`tests/windows.test.js`, `manifest.json`, `icon-192.png`, `icon-512.png`,
`apple-touch-icon.png`, `README.md`, this file, `data-src/` (provenance from the
thinking thread + this session's unflagged-brand research).

## 2026-09-05 — BLOCK-hh-radar-build-20260905: v1 shipped

Live at https://cumberlandworks.github.io/hh-radar/. All acceptance criteria in the
block met (validator, tests, premises P1-P6, mobile viewport, console-error-free,
same-origin-only network). Full report delivered to TJ in the build session's
closing message.
