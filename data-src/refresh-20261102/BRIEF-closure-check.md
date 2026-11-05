# BRIEF-closure-check: is each venue still open in 2026? (hh-radar v2, fix32)

Shared prompt for the closure check, a standing step between S3 (geocode) and S4 (merge) of every zone run, and
for backfills of zones already shipped. Give it to Sonnet subagents unchanged, with a list of venues
(name, address, zip, official_site) and today's date. Tools: WebSearch and WebFetch only. (The Google listing's
"Permanently closed" / "Temporarily closed" banner is read separately, by the Chrome agent in the S2 hours pass,
`BRIEF-hours-chrome.md` step 6.)

Why this exists (fix31): 12 South Taproom and Burger Up both closed in 2026 while their websites stayed live,
and both were researched as open. A live website is NOT evidence that a venue is open.

## For each venue
1. Search `"<name>" Nashville closed 2026` and `"<name>" Nashville closing`. Also try `"<name>" <street> closed`
   for common names. Read the top news hits (Tennessean, Nashville Business Journal, Nashville Scene, Axios
   Nashville, NewsChannel 5, WSMV, Fox 17, WKRN, Nashville Post, Eater, Whiskey Riff, Nashville Guru's closings
   lists) and any Reddit/r/nashville thread that names it.
2. Look for a move: "relocating", "new location", "moved to". A venue that moved to another address is
   `moved`, with the new address if given.
3. Look for dated 2026 activity: the venue's own social posts or site news dated 2026 (a menu dated 2026, an
   event in Oct/Nov 2026, a post this month), a 2026 news story that names it as open, or a guide entry
   confirmed in late 2026. Record the most recent one you find with its date.
4. Aggregator tags ("Closed" on Groupon, MapQuest, Yelp's "CLOSED" with no date, Restaurantji) are hints, not
   proof. Note them, then look for the dated source behind them.
5. Watch for a different business at the same address (new signage, a new name in 2026 reviews or news). That
   is evidence the venue closed or was replaced.
6. Be careful with names: a closure of a same-name venue in another city or another Nashville location is not
   this venue. Match the address.

## Status (use these exact strings)
- `closed`: a source dated 2026 (news, the venue's own post, a city record) says this location closed, or will
  close on a date that has passed.
- `closing`: a dated source says it will close on a date still ahead (give the date).
- `moved`: a dated source says this location moved to another address (give it).
- `temporarily_closed`: a dated source says it is closed for now (renovation, fire) with a reopening planned.
- `open`: dated 2026 activity (step 3) and no closure sign.
- `unclear`: no closure source, but no dated 2026 activity either; or only aggregator hints (step 4).

## Output: JSON only, one object keyed by the venue name exactly as given
```json
{
  "<name>": {
    "status": "open",
    "evidence": [{"url": "https://...", "date": "2026-10-12", "quote": "<a short quote, under 15 words>"}],
    "note": "<one or two plain sentences: what you searched, what you found, any aggregator hints>"
  }
}
```
Every `closed`, `closing`, `moved` and `temporarily_closed` needs at least one evidence item with a date.
Never mark a venue closed on an aggregator tag alone. Never guess: if you can't tell, it is `unclear`.

## How the executor uses the result (closure rule, TJ 2026-11-04; for the executor, not the researcher)
- **`unclear` plus a Google listing that shows open with no banner passes.** The venue stays added. It is not
  listed as a doubt in the report beyond the count.
- **A venue is removed (or not added) only on:** a dated closure source (`closed`, or `moved` / `closing` with
  a date that has passed), or the Google listing's "Permanently closed" or "Relocated" banner.
- **Temporarily closed** (Google's "Temporarily closed" banner, or `temporarily_closed` here; TJ, 2026-11-04) is never
  a removal, and what happens depends on whether the venue is already listed:
  - **Found while researching a new venue:** it is not added. It goes in `not-added-<zone>.md` and on
    `refresh-watchlist.md` with the date seen, and it is researched again once it reopens.
  - **Already on the radar:** keep the venue and its windows, and set its `temp_closed` range:
    `[{"from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "note": "...", "source": "https://..."}]`, both ends inclusive.
    `to` is the day before it reopens, since the card reads "Closed until <the day after `to`>". While the range holds,
    its NOW card is hidden, and its Day Grid row stays with a plain "Closed (temporary)" label.
- `unclear` with no Google listing found at all is listed in the report by name (as Ramone's and Antler Bar
  were in fix32), and stays.
