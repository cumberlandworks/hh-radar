# RUNBOOK-v2zone: standing amendments to BLOCK-hh-radar-v2zone-20261102 (read with the block)

The block is md5-pinned, so lasting changes to how a zone run works live here and in the tooling it names.
Each zone run reads this file next to the block. Newest first.

## From fix35 (2026-11-04)
- **Week-specific posts (TJ: "Drop badge for this week"; replaces the `low` in BRIEF step 14 for them):** the window
  gets `"posted_week": {"from", "to"}` and `"confidence": "med"`. No badge inside the week, and the card says "Posted for
  the week of <from>–<to>". After `to`, the badge returns with "Posted schedule was for <from>–<to>". They stay on
  `refresh-watchlist.md`. A pre-2026 venue menu stays `low`.
- **Every Verify badge has a reason on the card:** a `low` window's reason is its reader `notes` (when it has
  `research_notes`), the guide line, or `verify_reason`, a short line that never says "today". A window whose `notes`
  are still research prose needs a `verify_reason`, or it falls back to "Last checked <date>".
- **`apply_corrections.py`:** `annotate: true` for edits that aren't a re-check (dates stay); `venue_set` for venue
  fields; `remove_window`; `temp_closed`. `sources`, `last_verified`, `corroborated`, `posted_week` and `verify_reason`
  are settable on a window.
- **Links:** `validate.js` now refuses any source, `official_site` or `inkind_url` that isn't http(s).
- **Chain:** the data steps are `venues-v2-07-franklin-corr2.json` and `-corr3.json` (v2.7.1), from `research/franklin/corrections-franklin-corr2.json` and `-corr3.json`.

## From fix32, made lasting in fix33 (2026-11-04)
- **Versions:** fix33 is v2.6 (P2's previous file was `venues-v2-06-west-corr.json`). Franklin is the last of
  the 7 core zones; with it `coverage.v2_zones_done` holds all 7 and the coverage line drops "so far" (S7).
- **Closure rule (TJ, 2026-11-04; replaces fix32's "Unclear stays added and is listed"):**
  - "unclear" (no closure source, no dated 2026 activity) **plus a Google listing that shows open with no
    banner passes**. It stays added and is counted, not listed, in the report.
  - **Remove (or don't add) only on a dated closure source, or Google "Permanently closed" or "Relocated".**
  - **Temporarily closed (TJ, 2026-11-04)** (Google's banner, or a `temporarily_closed` result) is never a removal:
    - **Found while researching a new venue:** not added. It goes in `not-added-<zone>.md` and on
      `refresh-watchlist.md` with the date seen, and is researched again once it reopens.
    - **Already on the radar:** keep the venue and its windows, and set its `temp_closed` range, the field Punk Wok
      used: `[{"from", "to", "note", "source"}]`. Dates are YYYY-MM-DD, both ends inclusive; `source` must be a URL.
      `to` is the day before it reopens, since the card reads "Closed until <the day after `to`>". Put the venue on
      the watchlist too, so the range gets re-checked.
    - **What the range does (tested 2026-11-04, count changed in fix35):** the NOW card and Surprise me pick are hidden,
      at any time of day. The Day Grid row stays, with a plain "Closed (temporary)" label, and the grid note's
      "venues with happy hours" count and the Where button leave it out for that date.
    - **No posted reopening date (TJ, fix33 follow-up; built in fix35):** leave `to` out. The card says "Temporarily
      closed" with no date. The validator then requires `seen`, the YYYY-MM-DD date on the source.
    - **Tooling (fix35):** `apply_corrections.py` has a `temp_closed` action, so this is no longer a manual edit:
      `{"id": ..., "temp_closed": {"from", "to"?, "note", "source", "seen"?}, "why"}`.
  - An "unclear" venue with no Google listing of its own is still named in the report, and stays.
  - The same text is in `BRIEF-closure-check.md`, section "How the executor uses the result".
- **Removals reach the zone's not-added file (tooling):** `apply_corrections.py` appends every `remove` to
  `not-added-<zone>.md` (the venue's own zone), under "## Removed after the merge (correction files)", with the
  reason, date, URL and `why`. It skips a venue id already there, so re-running a chain doesn't duplicate.
  Since `merge_v2zone.py` rewrites that file, run the chain in order (merge, then `apply_corrections.py`).
  The GreenHouse Bar (fix32) was backfilled into `not-added-south.md`.
- **Franklin's leads (a zone with no Nashville guide coverage):** built in fix33 from Franklin & Brentwood
  guides into `leads/raw/leads-raw-franklin.json` (hand-merged by `leads/raw/franklin/make_franklin_raw.py`;
  method and per-source counts in `leads/raw/franklin/fetch-log-franklin.md`). `build_leads.js` reads it after
  `leads-raw.json` without merging the two by name (55 South, Sportsman's and others have Nashville and Franklin
  locations). A lead with `outer_city` goes straight to `outer-skipped.json`. `hood_zone.js` maps the guide
  text "Franklin", "Cool Springs" and "Brentwood". Re-running `build_leads.js` leaves the other zones' lead
  files byte for byte as they were.
- **Researchers' own "closed / moved" calls get the same check (fix33):** put them in the S3b web list and the S2
  Chrome todo too (`researcher_said`). In fix33 one rested on a story about another location (MAFIAoZA's 12South)
  and two were only "Temporarily closed" (Kokomo, Granite City); the not-added detail now names what was found.
- **S2 over 30 venues:** split the todo into Chrome passes of 30 at most (`hours-todo-1/2.json`, run one after
  the other), with every `need_hours` venue in the first.
- **Briefs say "Nashville":** `BRIEF-v2zone.md` (city "Nashville", "outside Nashville core zones") and
  `BRIEF-closure-check.md` (searches "<name> Nashville closed") are Nashville-worded. For Franklin the S1 and
  S3b task lines said the zone is Franklin & Brentwood, the city is the venue's own, and the closure search
  uses the town. The briefs stay unchanged, as the block asks.

## From fix31, made lasting in fix32 (2026-11-04)
- **Versions:** fix32 is v2.5 (P2's previous file was `venues-v2-05-south.json`).
- **Closure check (S3b, a standing step between S3 and S4):** a live website is not proof a venue is open (fix31:
  12 South Taproom and Burger Up closed in 2026 with their sites still up).
  - One Sonnet subagent (WebSearch/WebFetch) runs `BRIEF-closure-check.md`, unchanged, on every venue the run
    would add (`research/<zone>/closure-todo.json`).
  - The Google banner is read in the S2 Chrome pass: `BRIEF-hours-chrome.md` step 6 records `listing_status`
    ("Permanently closed", "Temporarily closed", "Relocated" or "open") for every venue the run would add.
  - Since fix32 the S2 todo holds every venue the run would add, with `need_hours` marking the ones that need hours.
    `apply_google_hours.py` prints any non-open status as CLOSURE and takes no hours from it.
  - **Confirmed closed** = a dated 2026 closure source, or Google "Permanently closed". The venue goes to
    not_added "closed / moved" with that source, via the zone's `finish_<zone>.py` CLOSED map.
  - **Unclear** (no closure source, no dated 2026 activity) stays added and is listed in the report.
- **Closure backfill (fix32, once):** the same check ran on all 111 non-inKind venues from Downtown, Gulch, East,
  North and South (3 Sonnet agents; then the Chrome banner on every "unclear" one).
  - Files: `research/closure-backfill/` (batches, `web-results.json`, the Chrome files).
  - Confirmed closures leave through the zone run's `-corr` file. The report lists each with its source.
- **All-day rule (TJ, 2026-11-04):** when the venue itself calls an everyday menu "all day" (The GreenHouse Bar's
  "Happy All Day", Playdate's "$8 all day"), it is recorded as an all-day special (`kind: "special"`), not a happy
  hour, with a note.
  - The validator rule stands: a non-inKind venue still needs a happy hour to be listed. So a non-inKind venue
    whose only "happy hour" is such a menu is not added ("all-day menu, no happy hour"), as The GreenHouse Bar was
    in fix32.
  - A venue that posts real happy-hour times that merely start at or before its posted opening keeps its happy
    hour (Prime + Proper, Tailor). It goes on `refresh-watchlist.md` under "Hours mismatch".
  - Researchers: a researched "all day" happy hour (brief step 9) is still recorded as researched. The executor
    applies this rule in the combine step.
- **Tooling:**
  - `merge_v2zone.py` `research_warnings()` WARNS (never refuses) on notes that mention "image", "no extractable
    text" or "no text layer". The executor opens each, records what it shows and rewords the note.
  - `geocode_v2zone.py` retries a NO HIT with the street's final suffix spelled out (Dr → Drive, Ave → Avenue,
    Pk → Pike, St → Street, …; a trailing N/S/E/W is kept). Only the last suffix word changes, so "St Clair St"
    keeps its first "St".
  - `apply_corrections.py` can set a window's `kind` and `remove` a venue (needs `reason` and `url`). It updates
    the coverage text's non-inKind count, and it accepts inKind windows' plain-URL sources.
- **inkind-possible.json has no zone field:** match its `lead` names against the zone's leads file, not a zone
  string. fix32 first missed Nicky's Coal Fired this way. The merge's street rule caught it as a duplicate of
  `ik-5323`, as designed.

## From fix30, made lasting in fix31 (2026-11-04)
- **Versions:** fix31 is v2.4 (P2's previous file was `venues-v2-04-north-corr.json`, by the `-corr` rule).
  South venues an earlier run already placed in South (M.L. Rose Neighborhood Pub - Melrose) count as already
  listed.
- **Linked menus are opened, or the merge refuses (tooling):** `merge_v2zone.py` now exits before writing
  anything if the run's research has a `notes`/`research_notes`/`hours_notes` that says a menu, PDF or link was
  "not opened", "could not open/read", "not readable" or similar (`research_problems()`; a venue site that
  "didn't load", brief step 8, is not matched). Open each one (`pdf2txt.swift`, a `sips` render, or the Chrome
  Sonnet agent), record what it shows in the combine step, reword the note to what was read, then re-run. The
  brief's step 12 says the same to the researchers.
- **PDF layout (new rule):** when a PDF's extracted text is ambiguous (columns, tables, a day list beside a deal
  list, prices not on their item's line), render the page and read the image before recording days or deals:
  `sips -s format png --resampleHeightWidthMax 2000 <file>.pdf --out <file>.png` (page 1; for other pages, split
  with `pdf2txt.swift`'s page count and render each, or open in Preview). fix30's Sedona Thursday-only window was
  a text-only misread of a "Weekly Specials" column.
- **Midnight is "00:00" (brief step 5 and the field rules; `BRIEF-hours-chrome.md`):** never 24:00, never 25:00
  or later. `merge_v2zone.py` refuses any 24:00-or-later time in the run's own research (window start/end and
  hours), so normalize in the combine step. The 13 24:00 ends already in venues.json stay as they are.
- **App:** the Day Grid note's counts take their verb from `countVerb()` in logic.js ("1 has them other days",
  "1 has no happy hour at all"), with a test (v2.4).
- **Refresh watchlist:** `refresh-watchlist.md` (this folder) lists every window from a week-specific post or a
  pre-2026 menu, with the week or the menu's date. Each zone run appends its own; the monthly refresh checks
  those first.

## From fix29, made lasting in fix30 (2026-11-03)
- **Versions:** fix30 is v2.3 (P2's previous file was `venues-v2-03-east-corr.json`: a `-corr` file is the
  last of its NN, so it is the one P2 compares).
- **Already listed from an earlier zone:** a venue an earlier run placed in this zone by its own point (fix29 put
  Folk, Turkey and The Wolf, Cherries and Plane Jane in North) counts as already listed in this zone, not as a
  duplicate. Report them under their own heading; they are part of this zone's empty-deals pass below.
- **Empty-deals pass before the merge is final (S4b):** after the merge, take every non-inKind `happy_hour`
  window in this zone with an empty deals list (the run's own and any already listed) and run brief steps 11-13
  on it (one Sonnet subagent, WebSearch/WebFetch; linked PDFs read on the Mac with `pdf2txt.swift`, image-only
  ones by the Chrome agent). Apply the result with `apply_corrections.py` to make `venues-v2-<NN>-<zone>-corr.json`,
  which is installed as venues.json. With no corrections, skip the `-corr` file. The zone ships with deals filled
  wherever a source exists.
- **Times but no deals stay (TJ's call, 2026-11-03):** a venue-sourced happy hour with no posted deals is kept;
  the card says "Deals not posted, ask at the bar". Not a reason for `not_added`.
- **Dated or stale sources (TJ, 2026-11-03; brief step 14):** a window from a week-specific post, or with deals
  only from a pre-2026 venue menu, is `confidence: "low"` (the card shows "Verify before you go"), and its notes
  name the post's week or the menu's date. The S5 checker flags any such window still above low. Applied in
  fix30 to Noble's Kitchen & Beer Hall (East, week of Nov 3-9) and Lyra (East, Spring 2025 menu).
- **Previews:** serve from the session scratchpad. Don't add entries to `~/Documents/Claude/.claude/launch.json`
  (fix30 removed the three `hh-radar*` ones; that file is otherwise left byte for byte).

## From fix28, made lasting in fix29 (2026-11-03)
- **Shared prompts.** S1 gives each researcher `BRIEF-v2zone.md` unchanged. S2 gives the Chrome subagent
  `BRIEF-hours-chrome.md` unchanged (never infer a hidden row; mouse off the table, then read a screenshot; leave
  an unreadable day empty).
- **BRIEF-v2zone.md steps 8–10:** `official_site` is never null (a hotel or district listing's link if the
  venue's own site won't load); "all day" = the venue's posted opening time, stated in notes, with food deals kept
  only for the hours the source gives them; a special with no listed days gets the venue's open days, stated in
  notes.
- **Lead dedupe against inKind** (`build_leads.js`): a name match, or the merge rule (same street with a similar
  name) when the lead has an address. A lead with no address whose name holds an inKind name (or the reverse) is
  flagged in `leads/inkind-possible.json`; the researcher still researches it and the merge's street rule
  decides. Check that list for the zone before S1 and report its entries under "inKind cross-check".
- **Map seams** (`merge_v2zone.py`): a new venue whose point is outside its zone's map polygon is a warning, not
  a failure. It is printed and listed in `not-added-<zone>.md` under "Map seam warnings". Settle each before
  `node --test` (a `MAP_SEAM_EXCEPTIONS` line in `tests/windows.test.js` with the address reason, or a corrected
  point) and report it.
- **S5, three rounds at most:** round 1 is 10 random new windows. Below 9 of 10: fix the misses (in
  `research/geocoded-<zone>.json`, then re-run the merge so the files reproduce) and run round 2 on 10 different
  windows. If round 2 is also below 9: fix and run round 3 on 10 more. If round 3 is still below 9, **don't
  commit or push**: write the report with the three rounds and stop.
- **Versions:** one minor per zone run (fix28 v2.1, fix29 v2.2, fix30 v2.3, …). `version.txt`, `APP_VERSION` in
  index.html, `venues.json?v=` and `logic.js?v=`, and the version-pin test move together.
- **P2's previous file** is the last `venues-v2-<NN-1>-*.json` by suffix (fix29: `venues-v2-02-gulch.json`).
- **S4's "subagent JSON"** is `research/geocoded-<zone>.json` (research + hours + geocode). Mirror the whole
  `refresh-20261102/` folder (minus `__pycache__`) to the repo's `data-src/`.
