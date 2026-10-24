# Changelog

## 2026-10-23 — BLOCK-hh-radar-fix13-20261023: v1.13 (Venmo tip link + grid polish)

TJ, 2026-10-23, verbatim:

> ~19:29 CDT: "what's next on the schedule including donation options including venmo ."

> ~19:32: "I don't mind using my personal venmo. I have transactions turned off anyway"

> ~19:35: a screenshot of his Venmo "Venmo me" screen: "Tj White", "@Tjwhite-".

The grid items (C2–C4) are the fix12 report's items 3, 4 and its empty-state note, proposed to TJ at ~19:33;
he added nothing else.

### Data
Unchanged. `venues.json` is the v1.12 file byte for byte (159 venues, 138 windows).

### Changes
- **C1 — Venmo tip.** `TIP_URL = 'https://venmo.com/u/Tjwhite-'` (the trailing hyphen is part of the username;
  the page uses the `/u/` profile url, not the `venmo.com/code?user_id=` url TJ's in-app QR encodes). A card
  between the referral and Feedback, in the referral's style: "Like the radar?" / "Tip on Venmo: @Tjwhite-",
  the handle linking to `TIP_URL` in a new tab with `rel="noopener"`. It is built by `tipSectionHtml` in
  logic.js (so it is testable) and replaces v1.10's "Support this project ↗" footer line. On desktop (platform
  `other`) `venmo-qr.svg` sits beside it at 120px, alt "QR code for TJ's Venmo". A phone gets the link only and
  never fetches the QR (measured: no `venmo-qr` resource entry at 375px). `TIP_URL = ''` still renders nothing
  (now tested). **QR check:** made at build time with segno 1.6.6 (QR version 3, error level Q, 29 modules + a
  4-module white quiet zone, the same 37-unit SVG shape as `inkind-referral-qr.svg`); not shipped, no runtime
  library. Chromium's `BarcodeDetector` on the committed file reads exactly `https://venmo.com/u/Tjwhite-`
  (and the referral QR still reads `https://app.inkind.com/refer/XRI8MWHF`).
- **C2 — `isAllDay`.** The "starts before 14:00" rule is gone; a `special` is all-day only when a resolved span on
  a day it runs is 5 hours or more. Windows whose classification changed (all-day -> normal block), out of 46
  specials:
  - The Loading Dock, Mon–Fri 7–9am (now a full hatched block, and it can be "starting soon").
  - JBJ's Nashville, Sat–Sun 10am–2pm.
  Every other special that starts before 2pm runs 5 hours or more and stays all-day (Two Hands' 8am specials,
  Acme, Cajun Steamer, 312 Pizza, 51 North and the rest).
- **C3 — Day Grid axis.** `gridAxisStart` is fed by the new `gridBlockStarts`: only windows drawn as normal blocks
  (not all-day bars, not temp-closed rows). With all zones shown: **Mon 7am, Tue 7am, Wed 7am, Thu 7am, Fri 7am
  (The Loading Dock), Sat 9am, Sun 9am (Playdate's 9am–close happy hour, Fri–Sun).** Two Hands' all-day 8am
  specials no longer pull the weekend back to 8am. Sunday is 9am, not the 10am JBJ's 10–2 special would give,
  because Playdate starts earlier.
- **C4 — NOW empty state.** `nextStartAcrossVenues` skips an occurrence whose start date is inside the venue's
  `temp_closed` range (`nextStart`'s new `skipTempClosed`). Mon Oct 26 at 10pm, Punk Wok's next start is now
  Thu Oct 29 11am, not its closed Wed Oct 28 11am.
- **C5:** v1.13 in the footer and on the `logic.js` / `venues.json` cache-bust queries. `og-preview.png` was **not**
  re-taken: a fresh capture at `?now=2026-10-27T17:30` (the v1.12 framing) matches the committed image with no
  pixel more than 32 levels apart (2,269 of 752,400 pixels differ faintly, anti-aliasing), Live now 55,
  All-day specials 11. Neither changed window runs on Tuesday at 5:30pm.

### Tests and lint
`node --test`: 159/159 (152 + 7 new: isAllDay on the real data, gridBlockStarts, the Punk Wok empty state, the
undated-clock guard, tipSectionHtml empty, tipSectionHtml per platform, TIP_URL + venmo-qr.svg in the repo).
The one test that pinned the old 14:00 rule now pins its removal. `node validate.js venues.json`: OK, 159
venues, 138 windows, 29 lint warnings (unchanged).

## 2026-10-23 — BLOCK-hh-radar-fix12-20261023: v1.12 (cleaner deal lines, outside-hours flag, morning deals, closures, lunch text)

TJ, 2026-10-23, verbatim:

> ~18:45 CDT, with a Google screenshot of 615chuTNey marked "Permanently closed" and a NOW-view screenshot of Dog Haus:
> "the formatting seems redundant and doesn't look great. - also I think that the Punk Wok is closing next month."

> ~18:55: "Flag deals outside hours,Show morning deals"

> ~19:07, with a screenshot of Jashan's expanded lunch card and Punk Wok's grid row: "The lunch options on some of these
> aren't clear."

### Findings (the thinking thread's)
- **Redundant price.** 415 of 484 deals carried a `price`; in 76 every number in `price` was already in `desc`
  ("$2 off draft beer & wine" + "-$2"), and "-$2" printed as "— -$2".
- **615chuTNey is permanently closed** (Google, TJ's screenshot; OpenTable on research day; r/nashville "615Chutney
  Closed?"). Still on inKind's map; dropped from the radar.
- **Punk Wok is staying open; the Oct 25 closure was reversed on Oct 23.** It announced on Oct 20 it would close for
  good on Oct 25; on Oct 23 the owner said it stays open after a deal with the landlord, takes "a short break after
  the weekend" and reopens Thu Oct 29 (WSMV, 2026-10-23 3:50 PM CDT; Nashville Scene). So it is not closing next
  month: it is closed Mon Oct 26 to Wed Oct 28.

### Data
`venues.json` is `refresh-20261023/venues-20261023f.json` byte for byte (md5 `60f049abdd60aa727e119d58a4355a33`,
159 venues, 138 windows). Made from the fix11 file by `post_20261023e.py` (615chuTNey removed; Punk Wok gains
`temp_closed: [{from: "2026-10-26", to: "2026-10-28", note, source}]` and a notes sentence; `coverage` updated),
then `post_20261023f.py` (the 4 lunch windows, Jashan, Ocean Prime, Punk Wok and Single Tree BBQ, get short
reader-facing deal text and `notes`; their old research wording moves to a new optional window field
`research_notes`; Single Tree's unexplained "$10 lunch" deal becomes a note). Measured diff against v1.11: exactly
that, nothing else. Both scripts and both files are in `data-src/refresh-20261023/`.

### Changes
- **C1:** the data above; `venues.json?v=1.12`, `logic.js?v=1.12`. The validator type-checks the new optional
  `temp_closed` (array of `{from, to}` "YYYY-MM-DD", `from <= to`, `note` string, `source` URL) and window
  `research_notes` (string). Schema stays 2. README Schema/Semantics updated.
- **C2 — deal lines.** New pure `dealPriceLabel(deal)` in logic.js: null when every number in `price` appears in
  `desc` (compared by value, so "$11.00" matches "$11"), or when a price with no number ("half price", "2-for-1",
  "free") appears in `desc` ignoring case and spacing; otherwise the price, with a leading minus read as "off"
  ("-$2" -> "$2 off"). The price renders as its own muted token after the text, no dash: "Smashburger  $7". No dash
  separators in deal lines at all. The Surprise card uses the same rule. **Counts: 413 deals carry a price; before,
  413 showed one; after, 334 do (79 dropped as repeats).** No surviving price starts with a minus, so the "off"
  rewrite fires on none of today's data (every "-$N" deal already said "$N off" in its text).
- **C3 — temporary closures.** `hoursStatus` returns `temp-closed` (with `until`, the day after `to`, and the note)
  when today's America/Chicago date is inside a range; the card reads "Closed until Thu, Oct 29 · Short break;
  reopens Thu Oct 29". The venue's windows on those dates are not live, not starting soon, not on the map's live
  dots and not in either Surprise me pool; its Day Grid row for such a date (a grid weekday = its next date) shows a
  plain "Closed (temporary)" label instead of bands and blocks. Past ranges are ignored. Tests: Punk Wok at
  `?now=2026-10-28T12:00` closed, `2026-10-29T12:00` and `2026-10-25T12:00` normal.
- **C4 — deals outside posted hours.** New pure `outsideHoursDays(venue, win)` uses the same merged open stretches as
  `hoursStatus`/`openBands`: a window interval on a day the venue IS open that is partly or wholly outside them gets
  one "Outside posted hours" badge per card (NOW and grid inline card; the tooltip names the days). Never hidden. The
  whole-day case keeps "Hours conflict". validate.js lints it (WARN). Flagged, exactly the 8 the fix11 report named
  (10 windows):
  ```
  ! 51 North Taproom: happy_hour window 11:00–23:00 outside posted hours on MON
  ! 51 North Taproom: special window 11:00–23:00 outside posted hours on WED
  ! 51 North Taproom: special window 11:00–23:00 outside posted hours on THU
  ! Brugada Kitchen & Bar: happy_hour window 16:00–18:00 outside posted hours on TUE/WED/THU
  ! JBJ's Nashville: special window 10:00–14:00 outside posted hours on SUN
  ! Present Tense: happy_hour window 16:00–17:30 outside posted hours on SUN
  ! The Detroit Cowboy: happy_hour window 15:00–close outside posted hours on MON/TUE/WED/THU/FRI/SAT
  ! The Southern Steak & Oyster: happy_hour window 15:00–17:00 outside posted hours on MON/TUE/WED/THU/FRI/SAT/SUN
  ! Verna Café & Bar: happy_hour window 15:00–18:00 outside posted hours on MON/THU/FRI/SAT/SUN
  ! ZuZu: happy_hour window 16:00–18:00 outside posted hours on TUE/WED/THU/FRI
  ```
- **C5 — morning deals on the Day Grid.** New pure `gridAxisStart(starts)`: 11am, unless a shown row has a window
  starting earlier on the selected day; then that hour, rounded down, never before 6am. Header ticks, hour lines,
  bands, blocks and the now line follow the axis. On a phone the header labels every 3rd hour once the axis runs
  past 15 hours (every 2nd before), so labels never touch. Rows on a temporarily closed date do not move the axis.
  With today's data the axis starts at 7am Mon–Fri (The Loading Dock's 7–9am "Grumpy Hour") and 8am Sat/Sun (Two
  Hands' 8am specials, every day), unless a zone filter hides those venues.
- **C6:** `og-preview.png` re-taken at the fix11 minute and framing (`?now=2026-10-27T17:30`, 1440x752 CSS at DPR
  0.833 = 1200x627): 51 North's card now reads "$2 off draft beer, house wine & well liquor" with no "— -$2". Same
  URL and tags.
- **C8 — lunch and window text a stranger can read.** A lunch card says what it is in one line under the name
  ("Lunch special · Mon–Sat 11am–2:30pm · dine-in only", area only when set), and its expanded card drops the now
  duplicate schedule line. New pure `formatDays(days)`: "Mon–Sat", "Mon, Wed–Fri", "Daily", pairs stay pairs ("Sat,
  Sun"); it replaces every "Mon/Tue/Wed/..." string. A window with `research_notes` shows its `notes` as a quiet
  plain line, no ⚠; every other window's `notes`, which is research prose, moves off the card into a closed "Source
  notes" disclosure in the expanded card, no ⚠. The venue's `disagreements` (also research prose, and the other half
  of the old ⚠ block) go into the same disclosure. Confidence badges unchanged. A deal with no price shows no price
  token (Punk Wok's bento).
- **C7:** v1.12 in the footer.

### Tests and lint
`node --test`: 152/152 (139 + 13 new: dealPriceLabel x4 including the measured 413/334 counts, formatDays,
temp closures x4 including the validator, outsideHoursDays x3 including the measured lint list, gridAxisStart).
Two measured tests moved with the data: the map exemption is now the two Bellevue venues (615chuTNey was the
third), and SUN onDay 39 -> 38, TUE otherDays 14 -> 13. `node validate.js venues.json`: OK, 159 venues, 138
windows, 29 lint warnings (16 deal-text, 3 closed-day, 10 outside-hours).

## 2026-10-23 — BLOCK-hh-radar-fix11-20261023: v1.11 (hours corrected for 21 venues + open hours on the Day Grid + closed-day lint)

TJ, 2026-10-23, verbatim:

> ~18:05 CDT, his picks: "Hours fix only (Recommended),Closed-day lint,Better LinkedIn preview,LinQ to Downtown/SoBro,
> I see that MrJ's has issues - is that in the fix?"

> ~18:09: "before I paste that Mr J's has two locations with different hours. make sure those are accounted for."

> ~18:11, with a Day Grid screenshot: "ok - i want to make sure thats taken into account for other places. - i think it
> would also be helpful to have a visual on the day grid when they open in close as well."

### The data fixes (the thinking thread's; hours only, no deal changed)
`venues.json` is `refresh-20261023/venues-20261023d.json` byte for byte (md5
`db7da350d475c62d2f57d79efd98b1a0`, 160 venues). Against v1.10 it differs in exactly **21
venues**, in `hours`/`hours_source`/`hours_confidence`/`hours_notes` and LinQ's
hood/neighborhood/zone only; every venue's `windows` is unchanged. The scripts, reports and
intermediate files are in `data-src/refresh-20261023/` (`merge_20261023b.py`,
`merge-report-20261023b.json`, `venues-20261023b.json`, `post_20261023c.py`,
`venues-20261023c.json`, `post_20261023d.py`, `venues-20261023d.json`).

1. **Half-week hours** (the v1.10 report's item 3). One research helper kept only the FRI/SAT
   half of "Sun-Thu ...; Fri-Sat ..." for 8 venues. `merge_20261023b.py` fills Sun-Thu from the
   helper's own source quote for **Chauhan Ale & Masala House, Two Hands - Nashville, Nicky's
   Coal Fired Pizza, Slim & Husky's - Nashville/Buchanan Arts District, Mr. J's Original -
   Nashville**; and reverts **Philippe Chow - Nashville, Van Leeuwen Ice Cream - Edgehill
   Village, Prince St. Pizza - Nashville** to inKind's 2026-09-05 hours (low).
2. **LinQ Social Kitchen** (ik-19732) relabelled Downtown/SoBro, zone downtown
   (`post_20261023c.py`). Label only.
3. **Chain-location audit** (`post_20261023d.py`, TJ 18:11). Every multi-location brand and
   every helper note saying hours were carried over was checked:
   - 11 venues whose hours ARE inKind's 2026-09-05 values but were labelled "researched" are
     relabelled to the inKind source, confidence low: **Flour Your Dreams Bakery & Cafe,
     Salvo's Pizza - Mt. Juliet, Salvo's Pizza - Franklin, Salvo's Pizza - Smyrna, Sushi By
     Bou - Nashville, Bakersfield - Nashville, Gregorys Coffee - Opry Mills, Just Love Coffee -
     Murfreesboro East, Blue Coast Burrito - Hendersonville, Vintage Vine 100, Tantisimo**.
     (All 11 were already `hours_confidence: "low"`; only `hours_source` changes.)
   - **The Pancake Pantry - Nashville** (220 Molloy St) had been given the Hillsboro Village
     location's 6am-3pm; reverted to its own inKind hours (6am-2pm), low (was high).
   - Both Mr. J's locations carry their own hours, checked again against mrjsoriginal.com at
     ~18:10 (Nashville Sun-Thu 9-8, Fri-Sat 9-8:30; Franklin Mon-Thu 7:30-8:30, Fri-Sat
     7:30-9, Sun 7:30-8). Mr. J's Franklin's "Dinner Specials" items come from the Nashville
     page (Franklin's would not load) and stay at low confidence: no change.

Hours sources now: 126 researched, 26 inKind 2026-09-05 (unconfirmed), 8 none found.

### Changes
- **C1:** the data above; `venues.json?v=1.11`, `logic.js?v=1.11`.
- **C2:** LinQ's map-seam exception (tests) now names its new hood: Downtown/SoBro by hood,
  still East of the drawn river, so it is still outside its own (now Downtown) polygon and
  the "exception still true" test still holds. No polygon redraw.
- **C3 — open hours on the Day Grid.** Every grid row draws the venue's open ranges for the
  selected day as a quiet grey band behind its deal blocks, full row height: when it opens,
  when it closes, and the gap when it closes between lunch and dinner (two bands). New pure
  `openBands(venue, day, axisStart, axisEnd)` in logic.js shares one merge
  (`mergedRangesAround`) with `hoursStatus`, so the card line and the band cannot disagree. A
  range past midnight runs to its real close; bands clip to the 11am-2am axis (a place open
  since 7:30am starts flush at the left edge). The band is neutral ink at low alpha
  (`--hours-band*` tokens, both themes), a colour no block uses; `hours_confidence: "low"`
  bands are fainter with a dashed top/bottom edge; no hours on file = no band. Deal blocks
  are unchanged and on top. A one-line legend sits under the grid footer counts: "Grey band:
  when the venue is open · Dashed: hours not confirmed".
- **C4 — closed-day lint** in `validate.js` (WARN, non-failing; fails under `--strict`): "<venue>:
  <kind> window on <D> but hours say closed" for every window day the venue's hours leave
  out (venues with no hours on file are skipped), plus "hours on file for only <days> but a
  window on <days> (hours may be incomplete)" when the hours cover 2 or fewer days. On the
  corrected data it prints exactly three, where the sources disagree:
  - Fortuna Italian Steakhouse: happy_hour window on MON but hours say closed
  - The Side Piece Nashville: happy_hour window on TUE but hours say closed
  - ZuZu: happy_hour window on MON but hours say closed

  (Run on the v1.10 file it flags 6 of the 8 half-week venues and their "may be incomplete"
  line; Van Leeuwen and Prince St. have no window on a missing day.)
- **C5 — og-preview.png re-taken** (1200x627, 114,273 bytes, light theme, NOW view, no
  `?pos`, localStorage cleared) at **`?now=2026-10-27T17:30`** (Tue): "LIVE NOW (55)", the map
  with live counts, 51 North Taproom and Bag Lady's Fry Joint in full, and the top of a third
  card. Captured at a 1440x752 CSS viewport scaled to 1200x627: no minute from 16:00 to 17:30
  on any weekday fits more than one card at v1.10's 960px framing (JINYA's 15-deal card leads
  16:00-16:59, 360 Bistro's 17:00-17:29). Same meta tags and URL.
- **C6:** v1.11. 10 new tests (139 total): `openBands` (split day, clip, past midnight,
  back-to-back merge, closed/no hours, real Mr. J's Nashville FRI, real Chauhan agreeing with
  `hoursStatus`) and the closed-day lint (incl. the shipped data's three).

## 2026-10-23 — BLOCK-hh-radar-fix10-20261023: v1.10 (refreshed data + venue hours + lunch + referral, ready for a public post)

TJ, 2026-10-23, verbatim:

> ~17:15 CDT: "I also want to add hours open / close - if they are closed for lunch for each
> venue . - and if they have a lunch  special - I also want to add an inkind referal link / qr
> code and a buy me a coffee link"

> On the tip link: "leave a slot for buy me a coffee , I haven't signed up yet"

> On the refresh: "Re-verify all 69 HH venues (Recommended)"

> ~17:32 CDT: "Waze to radar seems to be working"

> ~17:42 CDT: "fix10 picks: 1. A: screenshot preview; 2. A: Built by TJ White + LinkedIn +
> GitHub; 3. A: referral with disclosure; 4. B: no note"

Why now: TJ plans to post the radar on LinkedIn on Mon 2026-10-26 or Tue 2026-10-27, so
strangers will open it.

### v1.9 open question: CLOSED
The v1.9 entry left one thing for TJ to confirm on a real phone: the app actually coming
forward and "back" returning to the radar. TJ, ~17:32 CDT on his Android: "Waze to radar
seems to be working." Confirmed; nothing left open from v1.9.

### inKind's map API changed (measured by the thinking thread, 17:17 CDT)
One same-origin `GET /api/v5/map` from a real app.inkind.com tab: HTTP 200, **10,975**
locations, **191** in TN. The rows no longer carry `operating_hours`, `happy_hour`, `lunch` or
any meal flag (absent from all 10,975 rows), and `zip` moved to `location.zip_code`. inKind
is now the **roster source only**; hours and deals come from research.

### Roster diff (metro cities + Nolensville): 160 venues
- **27 new:** Tiff's Treats - Nashville Bellevue, Tiff's Treats - Nashville Franklin, Tiff's Treats - Nashville Gulch, Tiff's Treats - Nashville Mt. Juliet, Tiff's Treats - Nashville Murfreesboro, Tiff's Treats - Nashville Nolensville, Single Tree BBQ, Fishmonger - Neuhoff, Fishmonger - Wedgewood-Houston, Chateau West, Jimmy Buffett's Margaritaville - Nashville, Music Row Bar & Grill, Pearl Diver, The Loading Dock, Jar 10, NoWhere Special, ZuZu, Kane Brown's, The Grilled Cheeserie, The Grilled Cheeserie - Café Cheeserie, Pins Mechanical Co. - Nashville, Anatolia Turkish, Bungalow 10 Dining, Jashan, LinQ Social Kitchen, Noir Kitchen & Cocktails, Sindoore.
- **3 gone:** Boqueria - Nashville, SunLife Organics - 12 South, SunLife Organics - The Gulch.
- Every other id, name and address is identical.

### The refreshed data (C1)
All 160 venues were re-researched by four helpers under `data-src/refresh-20261023/BRIEF-v2.md`
and merged by the thinking thread (`merge_20261023.py`; new venues' hoods from
`hood_new_20261023.js`). `venues.json` is that file byte-for-byte (md5
`79052ad64fe7cd917ae3056df95fdad8`). **139 windows** (88 happy_hour, 46 special, 5 lunch);
**61** venues with a happy hour, **76** verified no HH; windows stale on 2026-11-05: 44 (was
all 115). Hours researched for 141 venues; 11 keep inKind's 2026-09-05 hours
(`hours_confidence: "low"`); 8 have none. The block put "HH not yet checked" at 5; measured
against the file it is **10** venues with `windows: []` + `verified_no_hh: false` (plus 13
special/lunch-only venues that are not marked verified either). The provenance is in
`data-src/refresh-20261023/`, unedited.

### Changes
- **C1 — schema 2.** `validateVenues` changed in exactly three rules: `schema_version` must
  be 2; `verified_no_hh: true` is an error only next to a `happy_hour` window (`windows: []`
  + `false` = "happy hour not checked yet"; a lunch- or special-only venue can be verified
  no-HH); `kind` may be `"lunch"`. The new optional fields `hours_confidence`
  (high|med|low), `hours_notes` (string) and `lunch_checked` (boolean) are type-checked when
  present. README "Schema" and "Semantics" document it.
- **C2 — hours on every card.** New pure `hoursStatus(venue, now)` and `weekHours(venue)` in
  logic.js. Every NOW card and grid inline card carries one line: "Open · closes 9pm",
  "Closed 2:30–5pm · reopens 5pm", "Opens 5pm", "Closed today", "Closed for the day" or "No
  hours on file". Past-midnight closes end on D+1 (yesterday's late range counts as open);
  touching ranges are one stretch. The expanded card shows the week (split days as two
  ranges) and "Hours from <site> · <date>", plus "unconfirmed" when `hours_confidence` is
  low (`hoursSourceInfo`). The "Hours conflict" badge is untouched; nothing is hidden.
- **C3 — `kind: "lunch"`.** Handled exactly like `special` everywhere `special` is (NOW lists,
  counts, food-first muting, grid rows and time-sort rank), except: the tag reads "Lunch",
  the grid block is dotted green with a dashed border (both themes, `--lunch*` tokens), and
  it is never all-day. Like specials, lunch is not in the Surprise me pools. The Day Grid
  footer's "have no happy hour at all" now counts only verified venues;
  `dayCoverageCounts` gains `unchecked` / `uncheckedList`, shown as "N not checked yet",
  each listed as "Happy hour not confirmed yet".
- **C4 — referral (TJ pick 3A).** A "New to inKind?" section above Feedback: "$25 off your
  first $50+ meal with my referral link. I get a credit too. Terms apply." linking
  `https://app.inkind.com/refer/XRI8MWHF` (new tab, `rel="noopener"`). Offer wording from
  TJ's inKind app referral screen, 2026-10-23. `inkind-referral-qr.svg` is committed with
  its C2PA `<metadata>` block and `xmlns:c2pa` stripped (all 432 rects unchanged) and shown
  at 120px beside the text on desktop only; a phone gets the link only, and the image is
  not in the DOM or fetched there. **Re-decoded in this session** (Chromium's
  `BarcodeDetector` on the committed file): it reads exactly
  `https://app.inkind.com/refer/XRI8MWHF`.
- **C5 — tip slot.** `TIP_URL = ''` in index.html. Empty = nothing renders. Set = "Support
  this project ↗" in the footer. No platform is named. README "Tip link" says where.
- **C6 — credit line (TJ pick 2A).** Footer, last line: "Built by TJ White · LinkedIn ·
  Source on GitHub" (LinkedIn and GitHub are new-tab `noopener` links; the name is plain).
- **C7 — link preview (TJ pick 1A).** Open Graph + `twitter:card summary_large_image` tags,
  with no venue count in any of them. `og-preview.png` is 1200x627, 138 KB: a real headless
  Chrome capture of the NOW view, light theme, `?now=2026-10-27T16:45`, no `?pos`, with
  localStorage cleared first, taken at a 960x502 CSS viewport and 1.25 device-pixel ratio
  so the text stays legible at LinkedIn's size. `?now` shows no debug line (only `?pos`
  does). Geolocation was left unanswered for the capture, so neither a position nor a
  "Location off" line appears.
- **C8 — refresh runbook** rewritten from what actually worked on 2026-10-23, with
  `data-src/refresh-20261023/` as the worked example. Cadence monthly, next due ~2026-11-23,
  still by hand.
- **C9 — v1.10.** `APP_VERSION`, `logic.js?v=1.10` and `venues.json?v=1.10` (the venues
  query had been left at `?v=1.7` since v1.7; it changes now because the data did).

### Data-coupled tests the new roster moved (no venue data edited)
- **LinQ Social Kitchen** (new) got hood Wedgewood-Houston from `nearestNeighborhood`, but
  its point sits east of the drawn Cumberland seam, inside the East polygon. Kept as a
  single named exception in the map containment tests (`MAP_SEAM_EXCEPTIONS`), with a test
  that fails once it is no longer needed; its dot renders on the East side of the line.
- **Bellevue venues off the map edge: 2 → 3** (Tiff's Treats - Nashville Bellevue is new).
- **Day coverage, measured:** SUN 39 on the day / 40 other days / 71 none / 10 not checked;
  TUE 65 / 14 / 71 / 10.

### Data notes for the thinking thread (reported, not edited)
- **Chauhan Ale & Masala House** has hours for FRI and SAT only, but its happy hour runs
  Mon–Thu + Sun 16:30–17:30, so every one of its happy-hour cards shows "Closed today" plus
  "Hours conflict". Its notes say the time is "listed under Sun-Thu hours"; those
  Sun–Thu hours look like they were dropped in the merge.
- The block's own example, "Closed 2:30-5pm" at Chauhan 15:00, is Jashan's gap (14:30–17:00);
  Chauhan's Friday gap is 14:00–16:30.

### Tests
`node --test`: **129 / 129** (107 old, of which 4 data-coupled ones were updated as above,
+ 22 new: the v2 validator rules including "not checked yet", lunch kind, `hoursStatus`
incl. a split day, past-midnight closes, the week wrap and minute boundaries, `weekHours`,
`hoursSourceInfo`, the coverage split). `node validate.js venues.json`: OK (160 venues, 139
windows; 16 lint warnings, which do not fail).

## 2026-09-11 — BLOCK-hh-radar-fix9-20260911: v1.9 (open the nav app directly, never via its web page)

TJ, 2026-09-11 ~05:05 CDT, verbatim:

> "it navigates to the waze web page before opening up the app so when I try to go back it
> closes the page completely and I have to reopen from the link."

And ~05:10 CDT, verbatim:

> "i have an android, but this should work on either."

**Correction of record: TJ's phone is Android (Chrome), not an iPhone.** Every earlier block
that said "TJ's iPhone" was an author's assumption TJ never made. Both platforms are handled
here; Android is the one that was actually measured.

### The bug
v1.8's Directions control was an `<a target="_blank">` pointing at an HTTPS universal/app
link (`https://waze.com/ul?...`). A universal link is a **web page first and a hand-off
second**. Chrome opens a new tab (a Custom Tab from the home-screen shell), loads waze.com,
and only then switches to the app — so the tab TJ backs out of has one entry of history,
closes, and takes the radar with it. iOS Safari does the same thing. The vehicle was the
problem, not the destination.

### The fix (C1)
- **`navUrl(app, venue, platform)` now returns `{app, web, builtinFallback}`** instead of one
  string, and the platform is detected once from the UA (`detectPlatform` → `android` | `ios`
  | `other`).
- **Android — Chrome `intent://` urls**, which open the app if it is installed and otherwise
  go straight to the fallback, with no intermediate page and no orphan tab:
  `intent://?ll=…&navigate=yes#Intent;scheme=waze;package=com.waze;S.browser_fallback_url=…;end`
  for Waze, the equivalent against `com.google.android.apps.maps` for Google Maps, and
  `geo:lat,lon?q=lat,lon(Name)` for "Default maps app", which hands Android's own chooser the
  point.
- **iOS — bare schemes** from the same page: `waze://`, `maps://`, `comgooglemaps://`.
- **Launched with `location.assign()` from the tap handler, not a link.** An intent that
  resolves brings the app forward *without unloading the page*: the radar is still there,
  same scroll, same open card, when the reader comes back.
- **The Directions control is a `<button>` on phones** — no `href`, no `target`. The `target`
  was the orphan tab. Desktop keeps an `<a target="_blank">`, because there is no app to
  launch there.
- **An honest fallback where the platform gives none.** `intent://` carries its own
  `S.browser_fallback_url`; `geo:` and the iOS schemes do not — they fail *silently*. Those
  arm a 1.2s timer and, if the page is still visible (i.e. nothing came forward), insert a
  "Didn't open? Open in browser ↗" line to the https url. Cleared on `visibilitychange` and
  `pagehide`.
- **Per-platform chooser**: Android `Waze · Google Maps · Default maps app`, iOS
  `Waze · Apple Maps · Google Maps`, desktop `Apple Maps · Google Maps · Waze web`. The note
  gains "Opens the app directly. If it isn't installed you'll get a browser link instead."
  The Settings pills follow the same per-platform list. A preference saved under v1.8
  (`waze` in TJ's case) stays valid on every platform.

### One thing the block missed, found by reading the code it was changing
The block specified the Directions control only. But the **chooser's own buttons had exactly
the same bug**: they were `<a target="_blank">` to the HTTPS link, with the comment "this
anchor IS the navigation". So the *first* tap — the one that answers "which app?" — would
still have gone through waze.com and still stranded the reader in an orphan tab. Fixing the
Directions control alone would have left the bug live for every new reader and for TJ
himself the moment he changed apps in Settings. The chooser picks are now buttons on phones
too, and answering the question launches the app directly (`openNav` on the answering tap).

### Two smaller corrections to the block
- The block puts the fallback timer on **iOS only**. But Android's `geo:` — which the block
  itself introduces as "Default maps app" — has **no** `S.browser_fallback_url` and fails
  silently, so an Android reader on that option would get a dead button. The timer is keyed
  off `builtinFallback`, not off the platform.
- The block's `/iphone|ipad|ipod/i` detection misses **iPadOS 13+**, which reports a desktop
  "Macintosh" UA by default. Such an iPad is classified `other` and gets the desktop `<a>` —
  which still works (maps.apple.com hands off), just without the direct launch. Left as the
  block specified rather than sniffing touch points; noted rather than silently "fixed".

### Verified
- `node --test` — **107/107 passing** (95 before; 12 new covering `detectPlatform`, exact
  intent/scheme strings per platform, the encoded `S.browser_fallback_url` round-tripping back
  to the web url, `navApps()` per platform, the phone control carrying no `target` and no
  `href`, the desktop control still being an `<a>`, and the fallback timer showing the line
  when the page stays visible and not when cancelled first — fake timers, no DOM).
- `node validate.js` — OK, 136 venues / 115 windows, 0 errors (2 pre-existing lint warnings,
  unchanged).
- **Measured in Android Chrome emulation** (Pixel 8 UA, 375x812): platform detected
  `android`; all **51** Directions controls render as `<button>`, **0** carry `target`, **0**
  carry `href`. A tap with Waze saved calls `navUrl('waze', venue, 'android')` →
  `intent://?ll=36.161037,-86.779103&navigate=yes#Intent;scheme=waze;package=com.waze;S.browser_fallback_url=https%3A%2F%2Fwaze.com%2Ful%3Fll%3D36.161037%2C-86.779103%26navigate%3Dyes;end`
  and then `location.assign()` — **no new tab, no waze.com page, page never left the radar**.
  The answering tap on the chooser both stores `waze` and launches. Desktop UA still renders
  `<a target="_blank" href="https://waze.com/ul?...">`. No console errors.
- **What could not be measured here:** emulation cannot install Waze, so the app actually
  coming forward — and the "back" behaviour that is the whole point — is for TJ to confirm on
  the phone. The Browser pane also reports `visibilityState: 'hidden'` at all times, so the
  fallback line's screenshot was taken with that one value stubbed to `'visible'` (what a real
  phone reports when nothing opened); the code path is otherwise untouched.

## 2026-09-11 — BLOCK-hh-radar-fix8-20260911: v1.8 ("will I make it?" + tap-to-navigate)

TJ, 2026-09-11 ~04:35 CDT, verbatim:

> "if there is a way to know the location it could estimate the time it would take to get
> there - basically to know will I miss it or do I still have time - also a way to click on
> the address to bring up a maps app on the phone easily."

And ~04:38 CDT, verbatim:

> "I use waze on my phone no google maps"

Both answered on the phone, with the scope guard intact: **no backend, no routing API, no
runtime libraries.** The reader's position never leaves the device — the estimate is computed
locally from a straight-line distance and says so, and the address link hands the reader to a
maps app that knows the traffic.

- **A verdict line on every NOW card, once a position is known (C2).**
  "≈ 11 min drive · you'd make it (ends 6pm)" / "cuts it close" / "you'd miss it" / on a
  starting-soon card, "≈ 16 min drive · you'd arrive 4:46pm, starts 5pm". `make` means at
  least 20 minutes on the ground; `close` is any arrival before the end; `miss` is arriving
  at or after it. No position, no line — and one note at the top of NOW instead of noise on
  54 cards.
- **`miss` cards are dimmed, not removed, and sort to the bottom of Live now.** The venue is
  still a real happy hour and the reader may know a faster road than the app does.
- **A Drive | Walk toggle beside Food/Drink**, persisted in `hhradar-travel`.
- **The address is a link into the phone's maps app (C1).** Present on every card in every
  view — NOW, the Day Grid's inline card, and the Surprise card — at a 44px touch target,
  with `event.stopPropagation()` so tapping it never also toggles the card open.
- **Which maps app is asked once, not guessed.** The first tap on a Directions link opens a
  three-way chooser (Waze · Apple Maps · Google Maps); the answer is stored in
  `hhradar-navapp` and every address link on the page is rewritten to it. It is changeable
  afterwards under a new **Settings** disclosure beside Feedback. Before a choice exists the
  link points at Apple Maps on Apple platforms and Google Maps elsewhere — but TJ will pick
  Waze on his first tap and never see the chooser again.
- **Surprise me will not offer a bar you cannot reach.** With a position, `miss` candidates
  are filtered out of the **Now** pool (`surprisePools(..., {reachable})`). Measured: 25
  consecutive rolls at 17:30 produced zero unreachable picks.
- **`?pos=LAT,LON` debug override** alongside `?now`, with the same contract — ignored unless
  present, never persisted, never sent — plus a red banner on screen while it is in force.

### Two things the block got wrong, both found by measuring

1. **The drive-time formula is not monotonic.** The block specifies flat speed bands keyed on
   road miles: 18 mph to 3, 24 mph to 8, 32 mph beyond. At 5.9 straight-line miles the 24 mph
   band charges 30 minutes; at 6.0 miles the 32 mph band charges **25**. Driving further
   would have shortened the estimate by five minutes. `driveEstimateMin` therefore floors each
   band at what the band below it charged at its own ceiling — the block's arithmetic is
   untouched inside a band, and the clamp only binds just past a boundary (6.0–7.9 mi all read
   30 min). A monotonicity test sweeps 0–40 miles in 0.05-mile steps.
2. **The C2 acceptance criterion cannot be met at 16:30.** The block asks for "at least one
   `make` and one `miss`" in the 16:30 NOW view with `?pos=36.15,-86.78`. Measured across all
   seven days: **16:30 yields zero `miss` cards on every one of them.** The happy hours live at
   16:30 that are far away (Franklin, Murfreesboro) run long — JoJo's Fish House in
   Murfreesboro is 31.6 mi and a 90-minute drive, but its window has 150 minutes left, so it
   is a comfortable `make`. The only short windows at that hour end at 17:00 and belong to
   downtown bars ten minutes away. The earliest hour that shows all three verdicts is
   **17:30**, on every day of the week. Both views are in the shipped evidence.

Everything else in the block landed as written.

## 2026-09-11 — BLOCK-hh-radar-fix7-20260911: v1.7 (Surprise me = Now | Later)

TJ, 2026-09-11 ~04:18 CDT, verbatim:

> "I tested the roll again feature - doesn't change anything."

And the design, ~04:25 CDT, verbatim:

> "I'm thinking surprise me could be a now or a later option. If its pushing the next live
> event that's not really a surprise."

**He was right and the spec was the bug.** v1.5's `pickSurprise` walked a tier ladder — live
now, else starting within 2h, else "tonight's earliest" — and the last tier was defined as the
ties at the *single* earliest start. Measured at the hour TJ tested (04:20, nothing live,
nothing starting for six hours) that tier held **two** candidates, the two Blue Sushi rows at
11:00, so Roll again flipped between two near-identical cards or appeared to do nothing at all.
A fallback with one candidate cannot roll. v1.5 was built exactly to spec; the spec was wrong.

- **The ladder is gone. The card has a Now | Later switch (C1).**
  - **Now** = live this minute, or starting within 2h. **Later** = a uniform draw across
    *everything else still to come in the service day* — not the next one up, which is the
    part TJ called out as "not really a surprise."
  - The switch opens on **Now** when anything is on, otherwise on **Later**, and says why:
    "nothing on right now — here's a later pick." The empty half is disabled but still
    rendered, with its count in the aria-label — a control that vanishes is how v1.5 read as
    broken in the first place.
  - **Service day = bar time, not calendar time**: it runs to 03:00 the next calendar day, so
    01:00 Saturday still belongs to Friday night. Every horizon is measured in
    minutes-from-now, which sidesteps the week-boundary wrap that `inIntervalWrapped` exists
    to paper over.
  - **Two fallbacks.** On the **Day Grid**, Later is the *selected day's* full set
    ("Sunday — 12pm–9pm") — how a friend plans Saturday from a Tuesday couch; selecting today
    is not an override and falls back to the clock. When the service day is past its last
    start, Later rolls over to **tomorrow's** full set ("tomorrow — Sat 3pm–6pm").
  - **Rollover drops venues that are open as you read the card.** Not in the block, added
    after measuring: this dataset has no happy hour starting after 18:30 except Fri/Sat, so
    *any weekday afternoon* lands on the rollover, and at 16:30 Tuesday **41 of the 53**
    tomorrow candidates were live at that moment. Offering "come back tomorrow" for a bar
    that is open right now is the same non-surprise TJ complained about wearing a different
    hat. If the drop empties the pool the unfiltered set is kept — a repeat beats a blank card.
  - **Roll again always moves**: `pickSurprise` takes `exclude` (the current pick's key) and
    draws from the pool minus that one. At a pool of exactly one the button is replaced by
    "That's the only option in this pool" — the honest version of a button that does nothing.
    `poolSize` stays the count *before* the exclusion, so "one of N candidates" keeps meaning
    what it says.
  - **Specials no longer enter either pool.** "Surprise me" promises a happy hour, and an
    all-day special is not an event. This is a small narrowing from v1.5, which let a live
    special win the top tier (7 of its 48 live candidates at 16:30 Tuesday).
  - Food-first still applies *within* whichever pool is armed, unchanged.
  - New pure logic: `surprisePools(venues, now, {day})` → `{now, later, laterLabel,
    laterScope, laterDay, serviceDay, horizonMinutes}`, plus `candidateKey`, `serviceDayOf`
    and `minutesUntilServiceEnd`. 17 tests, including the block's (a)–(f) measured against
    the real `venues.json`.

- **The card now lives in whichever view is on screen**, the Day Grid included — the day
  override is unreachable otherwise. `surpriseHtml(host)` returns '' for the inactive view and
  `showTab` drops the stale copy, so exactly one card is ever in the DOM and its controls moved
  from ids to classes.

- **The when-label is derived from the pick's own day, not the pool that produced it.** Caught
  in the browser: a Sunday pick made on the grid relabelled itself "tomorrow — Wed" after a tab
  switch, because the pools move underneath a pick that stays put.

- **Cache-bust `?v=` → 1.7** on `logic.js` and `venues.json`. index.html gained a call into
  `L.surprisePools`, so a stale cached `logic.js` beside a fresh `index.html` is the v1.2
  hard crash, not a stale-looking page.

**Measured, live, at the dead hour TJ tested** (`?now=2026-09-11T04:20`, all zones): the card
opens on Later, Now disabled, "one of 36 candidates" — six rolls, six venues, five distinct
start times: Dog Haus East Nashville (3pm), The Detroit Cowboy (4pm), Saint Anejo (2pm),
Common Ground Berry Hill (3pm), Blue Sushi McEwen (11am), Virago (5pm). Where v1.5 alternated
between two Blue Sushi rows forever.

## 2026-09-11 — BLOCK-hh-radar-fix6-20260911: v1.6 (feedback box rewritten for strangers, fix5 loose ends)

TJ, 2026-09-11, verbatim:

> "me / someone told me doesn't make sense for someone else to read - lets button this up and
> get any other fixes in that are needed."

And, ~04:14 CDT, on the wording:

> "they may want to give feedback that they liked something"

- **Feedback box, written for a stranger (C1).** The reader is now a friend of TJ's who has
  never heard of this project, so every word had to make sense cold.
  - The **"me / someone told me" toggle is gone.** It encoded the maintainer's relay case —
    friends submit directly — and with it goes the `relayed:` flag on the context line.
  - Copy: summary is **"Feedback"** (was "Feedback / ideas"); the lead line is
    "Like something? Want something? Found something broken? Tell us — no account needed.
    Notes stay on this phone until you send them." The textarea placeholder is
    "What did you like, wish for, or run into?" and the name field is
    "Your name (optional)" (was "From (optional)"). Praise, ideas and problems are invited
    equally — the v1.5 copy ("Anything odd, missing or wrong?") only asked for complaints.
  - **One obvious action.** **Send** is primary and does the whole job: anything typed is
    added as a note first, then every pending note goes. **Save for later** is the secondary
    (adds without sending). "Prefer a form? Open it" is a small text link, not a third
    button. v1.5's separate, permanently-disabled-looking **Send all** is gone — in a
    screenshot it read as broken, which is exactly what TJ saw.
  - **Optional mood chips** — 👍 Liked it · 💡 Idea · 🐛 Problem — single-select, not
    required, tapping the chosen one clears it. They prefix the note with
    `[liked]`/`[idea]`/`[problem]` so the inbox sorts itself with no Form schema change.
    They fit one 44px row at 375/390/430 (measured), so they stayed. The tagging rule is
    `composeNote()` in `logic.js` — pure, and there so the tests can reach it (3 new tests).
  - After Send: **"Sent — thank you."** with a 3-second **Undo** that cancels the clear, not
    the POST ("Put back in the list — but they were already sent, so Send would file them
    twice"). Offline: **"Kept on this phone — try again when you're online."**
  - **"What gets sent with a note"** is a real disclosure sitting directly under the buttons
    (`.fb-status:empty` collapses the row and its flex gap, so nothing floats at the bottom
    any more), and it now says it in plain words: "the app version, which screen and day you
    were on, your zone filter, the last place you tapped, and your screen size. **Never your
    location.**" The live context line is shown underneath it.
  - Textarea and name field stay at 16px (iOS zoom floor); every target in the box measures
    >= 44px.
- **Grid footer punctuation (C2).** The separator really was disappearing, but not for the
  reason the block assumed — there was no missing space in the source. Two things together:
  `details.cov-pop > summary` was `display: inline-block`, an atomic box too wide to break at
  390px, **and** Chrome wraps a `<details>`'s children in a `::details-content` **box that
  exists even when closed**. A block box inside an inline element splits the line, so the
  sentence was force-broken after "…other days" and the following space collapsed at the
  start of the new line — rendering as `other days· 67`. Fixed by making the summary
  `display: inline` (its 44px hit box now comes from 15px of vertical padding, which on an
  inline box grows the target without growing the line) and dropping `::details-content`
  when closed. The two separators also carry an NBSP before the `·` so neither can orphan.
  The footer is one flowing sentence again: 3 lines → 2 at 390px.
- **"In n zones:" prefix (C2).** Already shipped in v1.5 and rendering correctly —
  re-measured live before touching anything. No change. See the fix6 report.
- **Sheet timestamps are UTC (C2).** Code cannot change a Sheet's time zone. README now says
  so, points at the local time carried in every note's context line, and gives the manual
  fix (File → Settings → Time zone → Central → Save).
- **Header "Feedback" link (C2).** Already existed in v1.5 (`#hdr-fb`, top right) and already
  opened the box, scrolled it into view and focused the textarea. Verified, not rebuilt.
- **Mobile, measured again at 375/390/430 (C3).** Sub-44px targets: **7 → 0.** The zone-row
  "All"/"None" pills were 40px wide (no count badge to pad them), the zone-summary pill was
  42px tall so its stretched caret measured 44×42, and the footer's README link was a 48×14
  target. Footer type 11.5px → 12px. Inside the feedback box, 11/11.5px text → 12px.
  No horizontal overflow at any of the three widths (`scrollWidth` == viewport).
  **Still under 12px, deliberately, and listed rather than changed:** the grid hour ticks
  (10px), the grid row venue name (11px), the zone pill count badge (11px) and the hood-strip
  zone label (11px). Each is a measured v1.5 decision — the row label comment records that
  two 44px targets plus >= 12 characters of venue name do not fit at 375px above 11px — and
  raising them would undo that trade, which is a redesign C3 did not ask for.
- **v1.6** in the footer, `APP_VERSION`, and the `?v=` cache-bust on both `logic.js` and
  `venues.json`. Tests 64 → 67; validator unchanged at 136 venues / 115 windows.

## 2026-09-10 — BLOCK-hh-radar-fix5-20260910: v1.5 (feedback for anyone, mobile pass, "Surprise me", grid footer wording)

Two sources this round. TJ's asks are PRIMARY; the friend's are SECONDARY and rank second
wherever they conflict (nothing did).

PRIMARY — TJ, 2026-09-10, verbatim:

> "I had thought of a couple of things while I was using it, but I forgot before I got back
> here - so I think it would be helpful to have a feedback at the bottom of the page if
> that's possible that you can read."

> "I think it would be nice to be able to optimize for mobile as well- I ran into a couple of
> issues viewing my self from my phone. - also should figure out the absolute best way to
> provide feedback for me and anyone that uses it."

SECONDARY — a friend of TJ's, relayed by text 2026-09-10, verbatim (the first outside user):

> "I like the github pages haha. I like the amount of filtering and selection available. And
> the links to the official page. You could add a feature that "randomly selects" a place
> and a recommendation. Could target people that can't make decisions. There's a "xx have
> nothing available on X-day", but I wasn't able to get it to change to say that something
> was available? Might just be I'm on mobile and would get a different view in full screen"

- **Feedback box, for anyone, no account (C1).** A `<details>` at the bottom of the page
  (plus a "Feedback" link in the header) holding a textarea, a remembered `From` field, a
  me / someone-told-me toggle for relayed notes, **Add note** and **Send all**. Every
  keystroke goes to `localStorage`, so a note typed on a phone survives closing the tab;
  Add note stamps it with local time and an auto context line. Send all POSTs each pending
  note to a published Google Form's `formResponse` endpoint —
  `fetch(url, {method:'POST', mode:'no-cors', body: FormData})` — and rows land in a private
  Sheet the thinking thread reads through the Drive connector. **This is the one runtime
  call the page makes to anything but its own files, and only on the user's tap** — recorded
  in the README as a deliberate exception to "bake, don't fetch". The response is opaque
  (status 0) by design, so the confirmation says "sent (probably — the page cannot see
  Google's answer)"; a throw (offline) keeps the notes and says "kept on this phone". A
  secondary "Open the form instead" button carries the same note as a prefilled Form URL for
  the case where the POST is blocked. No GitHub anywhere in the user path.
  The context line carries: version · view (NOW or GRID + day) · zone filter · sort ·
  Food/Drink · any `?now=` · last expanded card · viewport width · standalone yes/no ·
  browser family. **Never location** — the feedback code does not read `state.geo`.
  The three `entry.*` field ids were re-read from the live viewform's `FB_PUBLIC_LOAD_DATA_`
  before being hard-coded, and matched the ids the block supplied exactly.
- **Mobile pass (C2).** Measured at 375/390/430 portrait and 844×390 landscape, before →
  after (full table in the fix5 report):
  - Sticky chrome at 390×844: **316.3px / 37.5% → 205.4px / 24.3%.** The v1.4 zone row wrapped
    to five lines on a phone (184px on its own); below 600px it is now a single
    "Zones: All · edit" line with the Map button, expanding on tap into the full pill row.
    375 → 25.3%, 430 → 22.0%.
  - Landscape 844×390: **208.3px / 53.4% → 107px / 27.4%.** The title and the tabs share one
    line, and a new `display: contents` `.controls` wrapper puts the Food/Drink row and the
    zone line side by side — two rows of chrome instead of four. `display: contents` means
    the wrapper changes nothing at any other width.
  - Tap targets < 44×44 CSS px at 390: **146 → 0** (and 0 at 375, 430 and landscape). The
    chip carets were 7.8×10; grid row links were 36×35; day tabs, sort pills, the tabs and
    the Food/Drink pills were all 30–35px tall. Grid rows are 45px on phones, not 44: the
    1px bottom border is inside the box, so a 44px row makes its full-height links 43 tall.
  - Grid row label: **9 → 15 characters** before the ellipsis at 390 (12 at 375, 19 at 430).
    Needed 55% of the row, 11px type, 6px of left padding and no inter-item gap; the binding
    case is 375, not 390. Hour ticks every 2 hours, 0 overlapping pairs at every width;
    blocks stay ≥ 6px; the now-line still renders.
  - Safe-area insets (`env(safe-area-inset-*)`) on the header, both control rows, `main`,
    the feedback wrapper and the footer, on top of the `viewport-fit=cover` v1.4 already had.
  - `100dvh` on `body` with a `100vh` fallback. Nothing in the page assumed full height
    before, so there was no iOS-100vh bug to fix — this is a guard, not a repair.
  - Every field is 16px so iOS does not zoom the page on focus; `touch-action: manipulation`
    on every control; user scaling left ON (accessibility).
  - Cache: `<meta http-equiv="Cache-Control" content="no-cache">` plus `?v=1.5` on BOTH
    `logic.js` and `venues.json`, so a home-screen launch picks up an update instead of
    re-using the shell iOS is holding. Bump both whenever `APP_VERSION` changes.
  - No horizontal scroll at 375, 390, 430 or landscape (`scrollWidth === clientWidth`, and
    zero elements outside the viewport box).
- **"Surprise me" (C3, the friend's idea).** A dice button in the NOW toolbar rolls one hero
  card: uniform random among windows LIVE NOW inside the current zone filter, with the food
  pool taking the whole draw whenever it is non-empty (drink-first mirrors it). Falls back to
  STARTING SOON, then to the single earliest start still to come — labelled "tonight's
  earliest". `pickSurprise(candidates, rng, opts)` is pure with an injected rng; nine tests
  cover food preference across the whole rng range, both fallbacks, the earliest-start
  narrowing, determinism, and rng values of 1/NaN/undefined. Measured: at
  `?now=2026-09-08T16:30`, ten rolls returned ten food deals out of 39 candidates; at
  `?now=2026-09-09T03:30` the card reads "nothing live or starting soon — tonight's earliest".
- **Grid footer wording (C4, the friend's confusion, reproduced).** "N venues have nothing on
  DAY" folded the 67 venues that have NO happy hour on any day into the same number as the
  ones that simply have theirs on another day — so on every day the number looked enormous
  and the app read as if nothing was ever on. It now reads
  "**58 venues** with happy hours on Tuesday · 11 have them other days · 67 have no happy
  hour at all", computed inside the zone filter (prefixed "In N zones:" when filtered), with
  "have them other days" opening a list of those venues and the next day each one is on. The
  three numbers partition the filtered roster — asserted for all seven days, with SUN
  (34/35/67) and TUE (58/11/67) pinned to measured values — and the footer prints a warning
  badge if its own count ever disagrees with the rows drawn.
- **Small (C5).** The Gulch map label moved from 36.1440,-86.8060 to 36.1415,-86.8075:
  clearance from the Downtown block **11.1 → 15.8 view units** by the model, 2.5 → 4.7 units
  horizontally and 9.7 → 14.4 vertically as rendered. `zoneLabelBox` had a real modelling
  bug behind that — it sized each block from the NAME line alone, but the count line is often
  wider ("Gulch" 32.2 units vs "15 today" 39.0), so the v1.4 overlap test could not see the
  crowding at all; it now takes the wider of the two, and a new test enforces ≥ 12 units of
  clearance on every pair. North of Downtown the East/Germantown seam now sits on the RIVER
  polyline vertex-for-vertex instead of ~0.0008 lon east of it (1.22 view units, ~1.3 CSS px
  at the 390 render), so the river stroke is the boundary rather than a line drawn just
  inside Germantown; `downtown` carries the moved triple point too, no venue changes zone,
  and a test pins all three polygons to the river vertices.
  Outer-suburb count badges needed no change — v1.4 already renders `hoodPillHtml` for the
  suburb rows, so those chips have shown their count whenever it is > 0 since v1.4
  (measured on the Day Grid: Smyrna 1, Murfreesboro 2, Mt. Juliet 1, Hendersonville 1).
- **localStorage helper (P5).** fix1 established the try/catch-per-call-site idiom but never
  named a helper; by v1.4 it was copied at six sites and the feedback box writes on every
  keystroke. `lsGet` / `lsSet` / `lsGetJson` now carry it, guarding reads as well as writes
  (Safari private mode throws on `getItem`, not just `setItem`), and all six old sites use them.
- Tests: 47 → 64. `node validate.js venues.json` unchanged (136 venues, 115 windows).

## 2026-09-06 — BLOCK-hh-radar-fix4-20260906: v1.4 (map redone, zone controls tidied, links on grid rows)

Per TJ's fourth-round feedback, verbatim:

> "feedback not great on the map and functionality and just general on how the additions
> look. Also the Links never landed for the restaurants so you don't need to drill into the
> item. to get it."

- **Links on every grid row (C1).** Each `.grid-rowlabel` now carries the same two targets
  the NOW card has — "ℹ︎" → `bestSourceUrl(venue, win)` and "K" → `venue.inkind_url` — as
  36px-wide, full-row-height anchors that `stopPropagation()`, so tapping one opens the link
  and never toggles the row. The venue name ellipsizes into whatever is left; the decorative
  🍸 that was repeated on every row was dropped to buy that space, and rows grew 34px → 36px
  to make the tap targets square. Below 600px the row label widens 34% → 46% so two 36px
  targets and a readable name still fit. Measured: 34 rows / 68 anchors on the SUN grid at
  1280 (`.grid-inner a` = 2 × rows), tapping a link leaves the row closed, tapping the name
  still opens it. All 136 venues have an `inkind_url` and every window resolves a source, so
  the 2-per-row ratio holds for the whole dataset, not just the sampled day.
- **Zone row is one steady line (C2).** The v1.3 bug was structural: hood sub-chips rendered
  inside the zone's own flex-column wrapper, so expanding a zone stretched that zone's pill
  and shoved its neighbours onto a second row. The hood strip is now a **sibling** of the
  zone row, never a descendant of a pill, and only one zone is expanded at a time
  (`state.expandedZone`, replacing `state.expandedZones`). Pills are `flex: 0 0 auto`; the
  row is `nowrap` at ≥900px and wraps below. All / None / Map moved into the same row at the
  right end. Measured at 1280: eight pills + All/None on one line (all tops = 142px), and
  expanding West leaves every other pill's x and width **byte-identical**. At 375: pills wrap
  to four lines with the same widths as at 1280 (no stretch) and `scrollWidth` stays 375.
- **The map, redone (C3).** `voronoiCells` no longer renders anything — it and its three
  tests stay as the geometric cross-check on the hood centroids — and the map is now six
  hand-authored `ZONE_POLYGONS`, one per core zone, over a `RIVER` polyline and three
  `INTERSTATES` hints. Zone fill 0.55 alpha selected / 0.12 deselected with a 1.5px border in
  the zone hue; labels are short names ("Germantown", not "Germantown & North" — 108px of an
  320px canvas) with a live/today count beneath, at hand-set anchors rather than centroids;
  venue dots 3px, live dots 4.5px in the warm accent with a dark halo; the user's position as
  a blue dot when granted. Tapping a polygon toggles that zone exactly like its pill.
- **Suburbs off the map (C4).** The ten solid-orange tiles are gone. Franklin & Brentwood and
  the eight outer hoods are two labelled rows of the same pill component under the map,
  hue-tinted only when selected, with the count badge dropped (and the pill dimmed) at 0.
- **One pill component (C5).** Zone pills, hood chips, day tabs, Time/Distance/Name and
  Food/Drink now share `.pill` — same radius, height (30px), font and selected treatment —
  replacing the three separate styles v1.3 had. Content column 720 → 840px at ≥1200px (with
  `.layout` raised to 1240px to match), so the grid's hour columns breathe. The duplicated
  "Location unavailable…" line above the map is gone; it renders once, at the top of the NOW
  view. Section headings are untouched (no zone-dot legend had been added).
- **v1.4 (C6).**

**Polygon vertex source.** Vertices are `[lat, lon]`, authored from the venue coordinates in
`venues.json` (see `data-src/` and the per-zone extents below) and snapped outward to the
obvious edges: the **Cumberland River** for Downtown/Germantown vs East, **I-40** for the
Gulch/Midtown vs Germantown line (lat ≈ 36.165), **I-65/I-440** for the southern edge of the
core, and **Charlotte Ave / Richland Creek** (lon ≈ -86.815) for the west divide. Measured
per-zone venue extents used to place them: downtown lat 36.1522–36.1642 / lon -86.7813–
-86.7675; gulch 36.1370–36.1638 / -86.8049–-86.7745; north 36.1660–36.2016 / -86.8084–
-86.7730; east 36.1521–36.2311 / -86.7598–-86.6947; south 36.1045–36.1429 / -86.8145–
-86.7675; west (excluding Bellevue) 36.0974–36.1625 / -86.8880–-86.8195. The six polygons
tile the extent with **zero overlap and zero gap** (sampled at 900×900: 315.14 km² covered of
a 315.13 km² extent) and the `RIVER` is drawn as the Downtown/East seam itself rather than as
a second line beside it — which puts it within ~450 m of the true channel through downtown,
close enough to orient by and one edge instead of two.

**The Downtown/Gulch seam, and why it is notched.** The hood labels in `venues.json` came
from a nearest-centroid heuristic, and along this seam they interleave: going south-west,
Legendary Wings/The Urban Perk (36.1559,-86.7736, *Downtown*), The Herban Perk & Pantry
(36.1551,-86.7745, *Gulch*), koshō (36.1539,-86.7758, *Gulch*), City Winery
(36.1522,-86.7764, *Downtown*) — D, G, G, D along one diagonal, with Legendary Wings and
Herban Perk only ~110 m apart. **No straight boundary can separate them.** The Downtown
polygon therefore carries a notch (vertices `[36.1531,-86.7778] → [36.1537,-86.7724] →
[36.1573,-86.7757]`) that the Gulch polygon mirrors vertex-for-vertex, keeping koshō and
Herban Perk in the Gulch while City Winery and Legendary Wings stay Downtown. Margins at the
tightest points are ~0.0008° (~70 m), which the containment test pins.

**Premises verified (measured).**
- **P1 — two-thirds right, and the headline number is wrong.** Live footer read
  `v1.3 · 136 venues · 115 windows` ✓ and `.grid-inner a` = **0** ✓. But the West zone chip
  measured **466px** when expanded, not 1233px — 1233px is the width of the `.hood-chips`
  *container*, not the chip. And the mechanism is stated wrong: `.hood-chips` does **not**
  render inside the chip (`document.querySelector('.chip .hood-subchips')` → null). What
  actually happens is that `.hood-subchips` renders inside `.zone-chip-wrap`, a
  `flex-direction: column` **sibling** wrapper, whose default `align-items: stretch` widens
  the chip to the wrapper. The symptom the block describes is real — the expanded West pill
  pushed "Franklin & Brentwood" and "Outer suburbs" to a second row (pill tops 177 → 242) —
  the diagnosis just names the wrong element.
- **P2 — fully confirmed.** 11 `path.cell-fill`, every one at `fill-opacity` 0.35; no
  river/road lines (0 `polyline`/`line`); 98 venue dots; 11 labels; 10 suburb tiles;
  viewBox `0 0 320.0 268.1`.
- **P3 — confirmed.** `voronoiCells` (3 tests) and `nearestNeighborhood` (1 test) were green
  on main, 38/38 passing, and are still green: 47/47 after this block's 9 new tests.
- **P4 — false as stated.** The block expected only Bellevue outside lat 36.09–36.22 /
  lon -86.90–-86.70. **Four** core venues fall outside it: the two Bellevue ones (615chuTNey
  36.0732,-86.9187; Fortuna Italian Steakhouse 36.0453,-86.9545) **and two East Nashville
  ones the block did not anticipate** — E+ROSE - East Nashville at **36.2311** (north of
  maxLat) and Gregorys Coffee - Opry Mills at **-86.6947** (east of maxLon). That makes the
  stated extent self-contradictory: C3 demands every core venue sit inside its own zone
  polygon *and* every vertex sit inside the extent, which no East polygon could satisfy. The
  extent was widened to **lat 36.09–36.24 / lon -86.90–-86.69**, which leaves exactly the two
  Bellevue venues outside — the two the block already expected to be off-map. A test
  (`MAP_EXEMPT_HOODS`) pins that exemption at exactly two so it cannot silently grow.

**Adaptations and things the block got wrong, called out rather than silently fixed.**
- **The viewBox is 320×283, not "~320×260".** That is just the arithmetic of the widened
  extent: 0.15° of latitude over 0.21° × cos(36.165°) of longitude. `projectToView` derives it
  rather than hardcoding it, and a test asserts the extent corners map to the viewBox corners.
- **"Venue dots 3px / LIVE dots 4.5px" read as diameters**, so `r` is 1.5 and 2.25. Read as
  radii they would be 6px and 9px wide on a 320px canvas — with 96 dots inside a ~2km cluster
  that is a blob, not a map.
- **The map needed its own theme tokens.** The block describes the map over "a bare dark
  rectangle" and dots "white at 0.6", which is a dark-mode description of a page that also
  ships a light theme. Added `--map-bg` / `--map-dot` / `--map-river` / `--map-road` /
  `--map-label` / `--map-label-dim` in both schemes, honouring the intent (a low-contrast
  neutral dot on its own ground) rather than the literal white.
- **`.grid-inner a` = 2 × rows holds with rows collapsed**, which is how the criterion was
  measured. Opening a row adds that inline card's own two text buttons, so an open row makes
  it 2 × rows + 2 — expected, not a regression.
- **Six regions cannot be equal-weight at true scale.** Downtown holds 25 of 136 venues in
  ~1.5 km² while West holds 8 across a third of the canvas. The design intent asks for true
  scale, so the polygons keep it and the count sits under each label instead; the alternative
  was distorting the geography to equalise the tap targets.

## 2026-09-06 — BLOCK-hh-radar-fix3-20260906: v1.3 (zone/neighborhood filter, map, wide layout)

Per TJ's third-round feedback ("I would like to select and deselect neighborhoods. both
from a map of Nashville that has colored sections and a list at the top I can see it
having multiple in the space above and the map should be on the side. visible on both now
and day grid") and his follow-up ZONE MODEL ruling ("29 neighborhoods seems excessive. I
have a slight suggestion neighborhoods within zones if that's possible east/west/north/
south/Gulch/Germantown - open to the best way to break it down"). C1-C6 implemented per
the block's ZONE MODEL as the top-level control (8 zones, 21 hoods one tap deeper).

- **Canonical hood + zone keys (C1):** every venue now carries `hood` (one of 21 canonical
  keys) and `zone` (one of 8, derived via `logic.js#zoneOf` so the data file and the zone
  table can never disagree — `validateVenues` checks `zone === zoneOf(hood)`). Migration
  script: `data-src/assign_hood_zone.js`, run once against `venues.json`. Measured
  per-zone counts: downtown 25, gulch 27, north 13, east 12, south 11, west 10,
  franklin 18, outer 20 (136 total) — close to the block's own reviewer-tally estimates
  (25/27/13/12/11/8/19/21); the small deltas are expected from an eyeballed estimate vs.
  the precise C1 mapping rule, not a scope disagreement.
- **Filter model (C2):** `applyHoodFilter`/`ZONES`/`zoneOf`/`hoodKeys` in logic.js;
  `state.hoodSelected` (default: all) drives NOW, DAY GRID, the empty-state "next:" line,
  and the "N venues have nothing on `<day>`" footer identically. Persisted to
  `localStorage` (`hhradar-hoods`) via `serializeHoodSelection`/`deserializeHoodSelection`
  — an empty selection is a real "None" state, not reset to all; unknown saved keys are
  dropped silently.
- **Chips (C3):** one chip per ZONE (8, always visible, wrapping row, no horizontal
  scroll at 375px), each with a swatch/label/rolled-up count and a caret that reveals
  that zone's hood sub-chips. A zone chip is filled when all its hoods are selected,
  "indeterminate"-styled when some are, and toggles all its hoods at once; sub-chips
  toggle one hood. Counts are contextual (NOW: live-now; GRID: rows on the selected day).
- **Map (C4):** inline SVG Voronoi partition (`logic.js#voronoiCells`, Sutherland-Hodgman
  half-plane clipping, ~equirectangular projection) of the 11 "core" hoods (the
  downtown/gulch/north/east/south/west zones), colored by zone hue with hood tints;
  venue dots on top, brighter for live-now venues on the NOW tab. The 10 franklin/outer
  hoods render as a row of suburb tiles below the map instead of a cell — see the note
  below on why that split is by zone membership, not the stated bbox. Every cell/tile
  toggles the same `hoodSelected` set as the chips.
- **Layout (C5):** `.layout` is a flex row ≥900px (320px sticky sidebar holding the map +
  suburb tiles, then a content column, container capped at 1180px) and a flex column
  below 900px (chips, then a "Map" button that opens the same map as an inline panel —
  not a modal — under the chips). Replaces the old flat 640px-centered column and its
  blank left half at wide viewports.
- **v1.3 (C6).**

**Premises verified (measured):** live footer read v1.2 (P1); 29 distinct `neighborhood`
strings, no `hood` key yet (P1); `NEIGHBORHOOD_CENTROIDS` is 19 `{lat,lon,name}` entries
(P2, confirmed); body/container max-width was 640px at every viewport (P3, confirmed —
now replaced by `.layout`/`.sidebar`/`.content`); P4 ("reuse the same try/catch helper")
was half-right — localStorage access is an inline try/catch *pattern* repeated at each
call site (priority, grid-sort), not an extracted helper function; the new `hhradar-hoods`
key follows the same inline pattern rather than inventing a helper that didn't exist.

**Adaptations and things the block got wrong, called out rather than silently fixed:**
- **Dickson/Lewisburg never actually reachable by C1's literal rule.** The two venues at
  the block's named outlier coordinates ("Just Love Coffee - Dickson", "The Coffee House
  Lewisburg") already have a `neighborhood` field that exactly equals an *existing*
  centroid name ("Bellevue" and "Franklin/Cool Springs" respectively — an artifact of the
  original nearestNeighborhood fallback, which had no better option before these two
  towns had their own keys). C1's mapping rule checks "neighborhood equals a centroid
  name" before "anything unmapped → nearestNeighborhood + WARN", so applied literally,
  hood="Dickson"/"Lewisburg" would never be assigned to any venue at all. Added an
  explicit override by venue id (`ik-11286`, `ik-19233`) checked first — matching what
  the block clearly intended (it named these two exact coordinates) — documented in
  `data-src/assign_hood_zone.js`.
- **The core/suburb map split is by zone membership, not the stated bbox.** C4's bbox
  (lat 36.03-36.26) does not actually exclude Brentwood's centroid (36.0331) — it falls
  ~0.003° inside the box despite "Franklin & Brentwood" being one of the two zones the
  ZONE MODEL clearly intends as suburbs (paired with Franklin/Cool Springs, itself at lat
  35.93, well outside). Using raw bbox-containment would have split one zone's hoods
  across map-cell and suburb-tile treatment, breaking C4's own "every cell/tile toggles
  the matching chip" parity. Core = the 11 hoods in the downtown/gulch/north/east/south/
  west zones; suburb = the 10 hoods in franklin/outer. This is a `CORE_ZONE_KEYS`
  constant in logic.js, not a bbox test.
- **Thin-hood/thick-zone cell borders were simplified to uniform thin borders.**
  Computing true zone-boundary strokes needs polygon-union math across each zone's
  hoods, well beyond `voronoiCells`' ~60-line scope (and its Sutherland-Hodgman output
  doesn't retain which neighbor bounds which edge). Zone identity is conveyed by hue +
  per-hood tint alone; the river hint (explicitly optional in C4) is also omitted.
- **All/None live in the chip toolbar, not only inside the wide sidebar.** C5 describes
  the sidebar as containing "the map + suburb tiles + All/None"; putting the controls
  only there would hide them below the chips on narrow layouts unless the map drawer is
  open. Kept one instance, in the toolbar above the chips, visible at every viewport size.
- **'Downtown' (bare, no parenthetical) wasn't literally in C1's alias table** (only
  "Downtown (Fifth + Broadway)", "SoBro", and "SoBro / Pie Town" were). Its one venue
  (Brugada Kitchen & Bar) went through the nearestNeighborhood+WARN fallback rather than
  a silent alias addition — it resolves to Downtown/SoBro anyway (see the one lint
  warning `assign_hood_zone.js` prints).
- **Empty-state message improved, not in the block:** when the hood filter (not the
  clock) is why NOW shows nothing, the empty state now says so ("No happy hours match
  your selected neighborhoods...") instead of the pre-existing "No happy hours found in
  this dataset" line, which would have been actively misleading once a hood filter could
  cause a legitimate empty result.

**hood-vs-geometric-cell disagreement list (C4 cross-check, 4 of 98 core-hood venues):**
Chauhan Ale & Masala House (hand-set The Gulch, geometric cell Downtown/SoBro), City
Winery - Nashville (hand-set Downtown/SoBro, geometric cell The Gulch), JINYA Ramen Bar -
Nashville (hand-set The Gulch, geometric cell Downtown/SoBro), The Detroit Cowboy
(hand-set The Gulch, geometric cell Downtown/SoBro). All four sit exactly on the
Gulch/Downtown boundary, which real Nashvillians treat as blurry too; hand-set values were
left unchanged per the block's own instruction. Separately, the geometric cell agreed with
the existing haversine-based `nearestNeighborhood` for all 98/98 core-hood venues (0
disagreements) — the equirectangular projection isn't introducing distortion at this scale.

**Verified:** `node --test` 38/38 passing (14 new: hoodKeys/zoneOf/isCoreHood, applyHoodFilter
toggle/all/none, selection (de)serialize round-trip/unknown-key/empty-is-none/corrupt-input,
voronoiCells centroid-inside-own-cell/tiles-the-bbox-within-0.1%/every-real-core-venue-inside-
some-cell). `node validate.js` — 0 errors, same pre-existing lint warnings as v1.2, plus the
one new "Downtown" hood-fallback WARN from the migration script (expected, see above).
Verified live in a local static-server preview (375px and 1280px, `?now=` overrides):
chip/map/tile selection stays in sync in both directions; deselecting The Gulch on the map
removes JINYA, Chauhan, and Detroit Cowboy (and 7 more Gulch venues) from LIVE NOW and their
grid rows alike; the day-grid footer note recomputes off the filtered count (106 after
deselecting West + Outer suburbs, not the full 136); the sidebar stays sticky through a
2000px scroll at 1280px with no blank left half; no horizontal scroll at 375px with the map
drawer open; zero console errors in either layout.

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
