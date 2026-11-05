[best-model:routed src=skill]
# BRIEF-v2zone: research one batch of happy-hour leads (hh-radar v2)

You are researching Nashville bars and restaurants for a hobby web app that lists live happy hours.
You get a list of LEADS (name, neighborhood, maybe an address, the guide pages that mentioned them, maybe the
venue's own site). Guides are leads only: never copy a deal from a guide unless the rule in step 3 allows it.
Tools: WebSearch and WebFetch only. Today's date is given in your task; use it for every `seen`.

## For each lead
1. Find the venue's OWN happy-hour page, menu, or a recent post on its own social account (Instagram, Facebook,
   X). Copy the days, times, area (bar, patio, whole restaurant, or null) and deals from THAT source, with prices
   exactly as posted. Never round, never infer a price.
2. Record every source you used as `{"url", "kind": "venue" | "social" | "guide", "seen": "<today>",
   "confirmed": "<YYYY-MM-DD the guide shows as confirmed/verified/updated>" | null}`. `confirmed` is only for a
   guide's own date; it is null on venue and social sources.
3. Only if no venue or social source exists: a guide entry the guide itself marks as confirmed in 2026 qualifies
   for days and times. Its deals are written plainly, and the window's `notes` says exactly:
   `Deals as listed by <guide name>, confirmed <YYYY-MM-DD>. Check with the venue.`
   and the window gets `"research_notes": "<what you checked>"` and `"confidence": "low"`.
   A guide with no date, or a date before 2026, does not qualify: the lead goes to not_added.
   Cite the guide page that shows EVERY day of the happy hour (for Nashville Guru, its business page
   `nashvilleguru.com/businesses/<slug>`, which lists each day and "Happy hours last confirmed on MM/DD/YY"),
   never a single day page: a day page only proves that one day. (fix27 spot check: two misses came from this.)
4. Closed venues: if the venue's site is gone, or anything from 2026 says it closed or moved, list it as
   not_added with reason `closed / moved`.
5. Hours: the posted open hours from the venue's own site, as `{"MON": [["11:00","22:00"]], ...}` (24h, a day
   with no key is closed; a range past midnight ends at e.g. "02:00"; midnight itself is "00:00", never
   "24:00", and never write "25:00" or later (fix31)), with `hours_confidence` high/med/low and
   `hours_source` `"researched <today> (<high|med|low> confidence): <url>"`. If none are found, `"hours": {}`,
   `"hours_confidence": "low"`, `"hours_source": "none found <today>"`.
6. Lunch specials and other specials: add `lunch` / `special` windows only if the SAME venue source shows them.
   Don't go looking.
7. The address must be the venue's own posted address (street, city, 5-digit zip). Never guess coordinates and
   never return lat/lon.
8. `official_site` is never null (fix29, from fix28). If the venue's own site won't load (SSL error, timeout,
   parked), use the link to the venue's site that a hotel or district listing gives (e.g. the hotel's dining page,
   the district's directory entry), and say in `research_notes` that the site itself didn't load. If no listing
   links one either, use the venue's own social page URL.
9. "All day" (fix29, from fix28): when a guide or the venue says a happy hour runs "all day", the window starts
   at the venue's posted opening time for that day and ends at "close", and `notes` says so (e.g. "All day: from
   the 11:00 opening."). Food deals go in that window only if the source gives them for the whole day; food
   deals the source limits to certain hours (e.g. "food 3-6pm") go in their own window for exactly those hours.
10. No listed days (fix29, from fix28): when a special names no days ("weekends", "reverse happy hour 9pm to
   close"), take its days from the venue's posted open days ("weekends" = the open days among SAT and SUN), and
   `notes` says how the days were set (e.g. "Days not posted: set to the venue's open days, Tue-Sun.").
11. Chains (TJ, 2026-11-03): a chain's own happy-hour page that names Tennessee (or says "all locations") is a
   `venue` source for deals at this location. The window's `notes` says "chain-wide Tennessee pricing" (or
   "chain-wide pricing, all locations"), and `research_notes` gives the page.
12. Linked menus (TJ, 2026-11-03): if the deals are in a linked PDF or a separate menu page, open it. Never skip
   a linked menu. A PDF that WebFetch can't read is listed in `research_notes` as "PDF not readable: <url>", so
   the executor reads it on the Mac (pdf2txt.swift) or has the Chrome agent render it. Never leave a linked
   menu, PDF or link "not opened" (fix31: the merge refuses any research whose `notes` or `research_notes` say a
   menu, PDF or link was "not opened", "could not open" or similar, and the executor must open it and re-run).
   The one hand-off phrase is "PDF not readable: <url>"; the executor replaces it once the PDF is read.
13. Times but no deals (TJ, 2026-11-03): if the venue's own source gives the happy hour's days and times but no
   deals, deals from a guide entry the guide itself confirmed in 2026 may fill in. Add that guide as a source
   (with its `confirmed` date), keep the venue source for the times, and the window's `notes` says exactly
   `Deals as listed by <guide name>, confirmed <YYYY-MM-DD>. Check with the venue.` (the fix27 guide-deals
   note). The window's confidence stays as the venue source gives it for the times. With no such guide entry,
   the deals list stays empty and `notes` says "Deals not posted."
   A window whose venue posts days and times but no deals (and no 2026-confirmed guide fills in) is still
   added, with an empty deals list (TJ, 2026-11-03: the card shows "Deals not posted, ask at the bar").
14. Dated or stale sources (TJ, 2026-11-03, fix30; week posts changed 2026-11-04, fix35): a window taken from a
   week-specific post (e.g. "week of Nov 3-9", "this week's specials") gets `"confidence": "med"` and
   `"posted_week": {"from": "2026-11-03", "to": "2026-11-09"}`; the app says "Posted for the week of Nov 3–9" and asks
   the reader to verify once the week is over. A window whose deals come only from a venue menu dated before 2026
   (e.g. a "Spring 2025" PDF the site still links) gets `"confidence": "low"` (the app shows "Verify before you go"),
   and `notes` names the menu's date (e.g. "Deals from the venue's Spring 2025 menu, still linked from its site.").
   This holds even when the source is the venue's own.
15. Return JSON only, and no prose outside `notes` / `research_notes`.

## Output: one JSON object
```json
{
  "added": [
    {
      "lead": "<the lead name exactly as given>",
      "name": "<venue's own name for itself>",
      "city": "Nashville",
      "neighborhood": "<neighborhood text>",
      "address": "<street address>",
      "zip": "37203",
      "official_site": "https://...",
      "status": "open",
      "hours": {},
      "hours_confidence": "high",
      "hours_source": "researched 2026-11-03 (high confidence): https://...",
      "windows": [
        {
          "days": ["MON", "TUE", "WED", "THU", "FRI"],
          "start": "16:00",
          "end": "18:00",
          "area": "bar",
          "kind": "happy_hour",
          "deals": [{"type": "drink", "desc": "$6 house wine", "price": 6}],
          "sources": [{"url": "https://...", "kind": "venue", "seen": "2026-11-03", "confirmed": null}],
          "last_verified": "2026-11-03",
          "corroborated": false,
          "confidence": "high",
          "notes": "<optional short reader note, e.g. 'Bar and patio only.'>",
          "research_notes": "<what you saw, where>"
        }
      ]
    }
  ],
  "not_added": [
    {"lead": "<lead name>", "reason": "<one of the reasons below>", "url": "<best URL seen, or null>"}
  ]
}
```
Rules for the fields:
- `days` in week order MON..SUN, no repeats. `start` "HH:MM" 24h; `end` "HH:MM" or "close". Midnight is
  "00:00" (fix31); never "24:00", never "25:00" or later.
- `kind`: `happy_hour`, `special` or `lunch`. A venue goes in `added` only with at least one `happy_hour` window.
- `deals[].type` is `food` or `drink`; `desc` is short and as posted ("$5 draft beers", "Half-price oysters");
  `price` is a number when the deal is one plain price, else null.
- `confidence`: high = the venue's own page or menu this year; med = its social post, a venue page with no
  date, or a week-specific post with `posted_week`; low = the 2026-confirmed guide case, or deals only from a pre-2026
  venue menu (step 14).
- If two of your sources disagree on days or times, use the venue's own, and say so in `research_notes`.

## not_added reasons (use these exact strings)
- `closed / moved`
- `no happy hour found` (no venue or social source shows one, and no 2026-confirmed guide entry)
- `guide not confirmed in 2026` (only a guide shows it, undated or older)
- `venue says no happy hour`
- `not a bar or restaurant`
- `outside Nashville core zones` (the venue's own address puts it in an outer suburb)
