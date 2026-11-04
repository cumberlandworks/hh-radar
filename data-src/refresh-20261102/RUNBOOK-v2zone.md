# RUNBOOK-v2zone: standing amendments to BLOCK-hh-radar-v2zone-20261102 (read with the block)

The block is md5-pinned, so lasting changes to how a zone run works live here and in the tooling it names.
Each zone run reads this file next to the block. Newest first.

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
