# Fetch log (2026-11-03)

Method: WebFetch summarized too coarsely (returned partial lists), so all pages were pulled with `curl -sL -A "Mozilla/5.0 (Macintosh)"` and parsed locally. All returned HTTP 200. WebSearch was used only to locate the Infatuation, StyleBlueprint and NASHtoday URLs. No email or personal info was sent.

Counts below are venues per page after name normalization (merged within a page). Merged unique leads: 204.

## Pages fetched
- https://nashtoday.6amcity.com/happy-hour-guide-nashville-tn : 43 venues
- https://nashvillego.com/happy-hours : 84 venues
- https://nashvillego.com/happy-hours/monday : 79 venues
- https://nashvillego.com/happy-hours/tuesday : 84 venues
- https://nashvillego.com/happy-hours/wednesday : 87 venues
- https://nashvillego.com/happy-hours/thursday : 87 venues
- https://nashvillego.com/happy-hours/friday : 83 venues
- https://nashvillego.com/happy-hours/saturday : 48 venues
- https://nashvillego.com/happy-hours/sunday : 42 venues
- https://nashvilleguru.com/best-nashville-happy-hours-and-specials/monday : 99 venues
- https://nashvilleguru.com/best-nashville-happy-hours-and-specials/tuesday : 103 venues
- https://nashvilleguru.com/best-nashville-happy-hours-and-specials/wednesday : 103 venues
- https://nashvilleguru.com/best-nashville-happy-hours-and-specials/thursday : 106 venues
- https://nashvilleguru.com/best-nashville-happy-hours-and-specials/friday : 96 venues
- https://nashvilleguru.com/best-nashville-happy-hours-and-specials/saturday : 56 venues
- https://nashvilleguru.com/best-nashville-happy-hours-and-specials/sunday : 55 venues
- https://styleblueprint.com/everyday/best-happy-hours/ : 94 venues
- https://www.theinfatuation.com/nashville/guides/best-happy-hours-nashville : 23 venues

## Per source (distinct merged leads touching that source)
- go: 91
- guru: 111
- inf: 23
- nt: 43
- sb: 94

## Notes / failures
- No page failed or was blocked.
- Nashville Guru: seven day pages under /best-nashville-happy-hours-and-specials/<day> (each page lists every venue for that day, with a per-entry 'Confirmed <date>'). The base page and /all-happy-hours-today are just today's list (Tuesday) and were not counted separately; the /all-<day>-happy-hours A-Z pages were not fetched since they re-sort the same lists. guides[] has one entry per day page the venue appears on, each with that page's confirmed date for the entry.
- Nashville Guru 'site' = the external 'happy hour menu' link on the entry when present (a menu/specials page on the venue's domain, not necessarily the homepage); the nashvilleguru.com/businesses link is not used.
- NashvilleGo (nashvillego.com): main page plus 7 day pages, grouped by neighborhood heading; no addresses, sites or confirmed dates shown. Venues listed under several neighborhood headings (e.g. M.L.Rose, Neighbors, Frothy Monkey) are one lead; neighborhood_text is the most frequent heading.
- The Infatuation: 23 venues in the page HTML (the JSON-LD ItemList only carries 20). Addresses from the page cards; sites from JSON-LD sameAs for 20 of them, none for Village Pub & Beer Garden, Sunda, Otto's. Groceries Etc. has no neighborhood token on its card; 'East Nashville' is taken from the guide's own description. The page shows no visible updated date (metadata dateModified 2026-09-15 not used), so confirmed is null.
- StyleBlueprint: URL https://styleblueprint.com/everyday/best-happy-hours/ (the /nashville/ variant is the same page). Page text says 'Updated May 2024' (month only, no day; metadata dateModified 2025-10-15), so confirmed is null. Neighborhood = the section heading as written; sites = the outbound link on the venue heading (utm params stripped).
- NASHtoday: the nashtoday.6amcity.com URL redirects to a 6amcity.com page; guides[].url keeps the nashtoday URL. The guide groups venues by theme, not neighborhood, so neighborhood_text is null unless another guide supplies it. No dates shown. Two non-venue caption lines ('Our favorite kind of boat...', "It's 'tini time.") were dropped.
- Site cleanups: dropped Instagram (Monday Night Preservation Co.), a CDN-hosted PDF (Blue Sushi Sake Grill), and a Denver page link (Dos Santos); PDF links on a venue domain reduced to the site root (Barcelona Wine Bar).
- Merge rule used: lowercase, strip punctuation/accents/parentheticals, '&'=and, drop leading 'The' and trailing 'Nashville'. Extra judged aliases: 12 South Taproom (& Grill), Amerigo (Italian Restaurant), Char (Restaurant), Common Ground (Bar & Eatery), Ellington's (Mid Way Bar & Grill), The Finch (American Grill), Harper's (Steakhouse), Hops + Crafts, Miel (Restaurant), M.L. Rose / M.L.Rose (all locations merged), Otto's (Bar), Pancho & Lefty's (Cantina), Pinewood (Social), Sperry's (Restaurant), Sunda (New Asian), Von Elrod's (Beer Hall & Kitchen). Garage Sale Bar (East) and Garage Sale Vintage (Downtown) kept separate.
- Multi-location names (Common Ground, Neighbors, M.L. Rose, Frothy Monkey, Five Points Pizza) are single records and may need splitting later.
