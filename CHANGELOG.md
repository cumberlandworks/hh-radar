# Changelog

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
