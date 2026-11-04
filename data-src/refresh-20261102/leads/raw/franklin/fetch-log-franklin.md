# Fetch log: Franklin & Brentwood leads (fix33, 2026-11-04)

Method: as fix27 C1, leads only (name, address, site, the guide page), no deal text. Pages were pulled with
`curl -sL` where the site allowed it and read in TJ's Chrome (Claude in Chrome) where it did not. Merged by hand
in `make_franklin_raw.py` (one row per location) → `../leads-raw-franklin.json` → `build_leads.js`, which
dedupes against inKind and zones by town/address. No email or personal info was sent.

## Sources, as read

| Source | Page | Read how | Venues on page | Lead mentions |
|---|---|---|---|---|
| FranklinIs (Franklin) | https://franklinis.com/a-toast-to-top-happy-hours-in-franklin-tennessee/ (published 2025-06-27) | curl | 22 | 22 |
| FranklinIs (The Factory) | https://franklinis.com/happy-hour-at-the-factory-at-franklin-where-to-sip-snack-and-unwind/ (2025-07-25) | curl | 6 | 6 |
| FranklinIs (Brentwood) | https://franklinis.com/cheers-to-the-best-happy-hours-in-brentwood-tennessee/ (2025-08-07) | curl | 11 | 11 |
| OpenTable | https://www.opentable.com/features/best-happy-hour-restaurants-franklin-tennessee-tn | Chrome (curl refused) | 134 | 12 in Franklin & Brentwood + 4 outer |
| Williamson Scene | https://www.williamsonscene.com/brentwood/top-10-happy-hours-in-brentwood/article_02f548f8-0203-11ed-9551-d7d7922094f3.html (summer 2022) | curl | 10 | 10 |
| baselocal | https://baselocal.com/?p=13964 | search-engine extracts only (see below) | ? | 7 |
| Happy Hopper (Franklin) | https://happyhopper.app/restaurant-directory/tennessee/franklin | Chrome (curl hit a Cloudflare challenge) | 137 | 24 |
| Happy Hopper (Brentwood) | https://happyhopper.app/restaurant-directory/tennessee/brentwood | Chrome | 19 | 4 |

Merged: **66 Franklin & Brentwood leads + 4 outer**. build_leads: 5 matched inKind by name/street
(Blue Sushi McEwen `ik-8589`, Vintage Vine 100 `ik-13745`, Saffire `ik-16088`, Karrington Rowe `ik-13244`,
Cajun Steamer `ik-13452`) → `inkind-overlap.json`; **61 → `leads-franklin.json`** (46 Franklin/Cool Springs,
15 Brentwood); 4 → `outer-skipped.json`. No new `inkind-possible` entries. Every other zone's lead file is
byte for byte what it was.

## Notes / failures
- **FranklinIs `?p=296470` (the link in the paste) is a 404**, in curl and in Chrome. The WordPress search API
  shows no post 296470 of any type. Its live happy-hour guides are posts 105303 (Franklin), 105365 (The Factory)
  and 105393 (Brentwood); all three were used. Post bodies are closed on the REST API (Kadence Security), so the
  HTML pages were parsed (`<h2>` per venue in two posts; the Factory post's venue headings by layout).
- **OpenTable** lists 134 restaurants "near Franklin", ranked by distance; 122 are in Davidson County (zones
  already done). Only its own area facets were taken: Franklin (9: Culinary Dropout, Perry's, North Italia,
  Blue Sushi, 1799, P.F. Chang's, Connors, Granite City, Brewhouse South) and Brentwood (3: Mere Bulles,
  Firebirds, Karrington Rowe). Its outer-suburb facets (Murfreesboro 2, Mount Juliet 1, Goodlettsville 1) went
  to outer-skipped. The 118 core-Nashville entries were not taken as leads for this run.
- **baselocal `?p=13964` now serves the BaseLocal homepage** (Next.js app, no article); no `/tn/franklin/a/…`
  path matched, the sitemap returns 502, and archive.org is blocked on this network. The 7 names come from the
  article's text as quoted by two web-search extracts: Dolan's Bar & Grill, The Skylight Bar, Benchmark Sports
  Pub, Vintage Vine 100, MAFIoZA's, Puckett's, M.L.Rose. The researchers confirm each from the venue.
- **Happy Hopper**: a card shows "View N Deals" when the app has deals for the venue; 113 of 137 Franklin cards
  and 15 of 19 Brentwood cards are bare directory entries ("Restaurant": Waffle House, Wendy's, coffee shops).
  Only the cards with deals were taken (24 + 4). Bare entries that another guide names are leads through that
  guide.
- **Williamson Scene** is from summer 2022 (the article ID's timestamp is July 2022). Esquina Cantina's
  address (710 Old Hickory Blvd #302) is Yard Birds Hot Chicken on Happy Hopper now; it stays a lead and the
  researcher settles it.
- **55 South** and **Firebirds** have Franklin and Brentwood locations; each location is its own lead.
  **Serrato's** is in FranklinIs's Brentwood post but sits at 3046 Columbia Ave, Franklin, so it is a Franklin lead.
