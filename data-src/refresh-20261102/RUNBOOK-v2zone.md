# RUNBOOK-v2zone: standing amendments to BLOCK-hh-radar-v2zone-20261102 (read with the block)

The block is md5-pinned, so lasting changes to how a zone run works live here and in the tooling it names.
Each zone run reads this file next to the block. Newest first.

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
