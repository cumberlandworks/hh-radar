# hh-radar — open items for TJ (2026-09-05, one batch, nothing blocks the build)

## Decisions (yours)
1. **Connie's Upscale Dive → "The Backbar at Verna".** Same address/operator; inKind still
   names Connie's. Recorded as Backbar's HH (Thu–Mon 5–7pm, all day Monday). Confirm inKind
   credit is honored there on first visit; if not, mark `inkind:false` on that row.
2. **Verna has two overlapping windows** (café 3–6pm Thu–Mon from site footer + Guru; evening
   bar 5–7pm from the evening menu). Both kept. Fine to ship both, or collapse after a visit.
3. **`kind: "special"` windows** (312 Pizza Monday 25%-off pizza from 4pm / Thursday $10
   cheese pizzas; Cajun Steamer's daily drink specials) count as "live now" with a tag.
   Say if you'd rather they not appear in NOW.

## Verify-on-first-visit (can't be settled from a chair; all badged low/unverified in the UI)
- Dog Haus **Franklin**: HH exists, times unpublished — copied East Nashville's (Mon–Sat 3–7, Sun 12–7).
- Moto: site lists Mon/Wed/Thu/Fri 5–6pm but is closed Mondays; recorded Wed–Fri. Ask about Tuesday.
- The Amsterdamian: same menu page rendered "Tue–Fri" once and "Mo–Fri" once. Recorded Mon–Fri.
- Two Ten Jack: Mon–Thu 4–6 (do615) vs Mon–Fri (aggregator). Recorded Mon–Thu.
- Nacho Daddy: afternoon HH Mon–Thu (do615) vs Mon–Fri (Yelp Q&A). Recorded Mon–Thu. Late HH Fri/Sat 10pm–2am.
- City Winery: official site says HH Mon–Thu 4–6, but inKind's hours have no Monday. Kept, flagged.
- Present Tense: HH 4–5:30 Thu–Sun published, deals not; site is ©2023.
- 360 Bistro: HH page only exposes "$8 wines by the glass"; rest hidden behind a broken "Load more".
- Chauhan: only a thin "4:30–5:30 bar, $6 drinks" claim — low.
- Brugada: HH claims are aggregator-only — low.
- Love & Exile: only source is a Dec-2025 Do615 listing (weekend $5–7 food is the interesting part).
- Germantown Cafe Saturday 7:30–9pm window has no deal detail (Guru says $7 cocktails/$7 wine/$4 beer/$7–25 food).

## Data notes worth knowing
- inKind's `happy_hour` flag is DISCOVERY, not truth: Guru lists HH at at least one inKind metro row
  the flag missed (Philippe Chow, 5–7pm, $9 bites, Guru-confirmed 06/25/26). The 101 unflagged metro
  rows were NOT researched in v1 (per the founding block's phasing). If you want a sweep of the
  unflagged rows against Guru before the build, say so — it is the same pipeline.
- Food-first winners on today's data: JINYA (10 food items $3–9), Boqueria (9), Park Cafe (7),
  Fortuna (7, bar only), Tantisimo (4, $7–10), Cajun Steamer (4), Common Ground (4), Blue Sushi (all day Sunday).
