# HH-RADAR RESEARCH BRIEF (batch agent) — read fully before starting

You are researching HAPPY HOUR details for a short list of Nashville-area restaurants that are
inKind partners. Output is DATA, not prose. Today is 2026-09-05 (America/Chicago).

## Per venue, in this order
1. VENUE'S OWN SITE (canonical): find the official website (web search "<name> Nashville"), then its
   happy hour / specials / menu page. Quote the happy-hour text verbatim (short).
2. NASHVILLE GURU (corroboration): https://nashvilleguru.com/businesses/<slug> — guess the slug from the
   name (lowercase, hyphens, no punctuation; e.g. "verna-cafe-bar", "germantown-cafe", "blue-sushi-sake-grill").
   If 404, web search "site:nashvilleguru.com <name>". Guru lines end with "(confirmed on MM/DD/YY)" — capture that date.
3. ONE MORE SOURCE: Yelp / Google Business / Instagram / Eater Nashville / Nashville Scene / Tripadvisor / Reddit.
   Capture URL + short quote + any date visible.
Use mcp__workspace__web_fetch and WebSearch only. Do NOT use curl/wget/python to fetch. If a fetch fails, say so
and move on. Do not spend more than ~6 fetches per venue.

## Rules
- ABSENT AND EMPTY ARE NOT THE SAME. If you checked the sources and found NO happy hour, return
  windows: [] with verified_no_hh: true and list what you checked. If you could not check (fetch failures),
  return windows: null with confidence "unknown".
- Record EVERY deal you see with type "food" or "drink" — never filter. Food is what TJ cares about most.
- Two independent sources agreeing on the window → corroborated: true. Disagreement → record BOTH readings in
  `disagreements`, pick NOTHING silently; set confidence "low".
- Times: 24h "HH:MM". Use "close" literally if a source says "until close". Days: MON..SUN arrays.
  Separate windows if days differ (e.g. weekday vs Sunday), or if there is a late-night window.
- Note oddities (bar-only, patio-only, all-day Mondays, reverse happy hour, industry night, brunch specials).
- last_verified for a window = the most recent date any source explicitly confirmed it; if the only evidence is
  today's live venue page, use "2026-09-05". If evidence is an undated aggregator, use the guru confirmed date
  or null.
- Your own scratch files go ONLY in /tmp/hh_<your-batch-name>/ — never elsewhere.

## Output
Write ONE JSON file to /sessions/laughing-nifty-galileo/mnt/outputs/hh-radar/research/<batch-name>.json
(use the bash tool to write it; that path is on the mounted outputs dir) AND paste the same JSON as your final
message. Shape:
{ "batch": "<name>", "researched_at": "2026-09-05", "venues": [
  { "id": <inkind id>, "name": "...", "official_site": "url or null",
    "windows": [ { "days": ["MON","TUE"], "start": "16:00", "end": "18:00", "area": "bar only|patio|whole restaurant|null",
        "deals": [ {"type":"food","desc":"half-off select appetizers","price":null}, {"type":"drink","desc":"$5 drafts","price":"$5"} ],
        "sources": ["url1","url2"], "last_verified": "YYYY-MM-DD or null", "corroborated": true, "confidence": "high|med|low",
        "notes": "..." } ] | [] | null,
    "verified_no_hh": false, "checked_sources": [ {"url":"...","ok":true,"quote":"...","confirmed_on":"YYYY-MM-DD or null"} ],
    "disagreements": [ "..." ], "notes": "..." } ] }
