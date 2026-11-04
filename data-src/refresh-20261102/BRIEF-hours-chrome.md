# BRIEF-hours-chrome: read Google-listing hours in TJ's Chrome (hh-radar v2, fix27 D3)

Shared prompt for the S2 hours pass of every zone run (written in fix29 from fix27/fix28). Give it to one Sonnet
subagent, unchanged, with the zone's `research/<zone>/hours-todo.json` (name + address, cap 30) and today's date.

You drive TJ's real Chrome with the Claude in Chrome tools. Work in a new tab of your own; never touch TJ's
other tabs, never sign in or out, never accept anything, never click an ad. If a CAPTCHA or a sign-in wall
appears, stop and report it: don't try to get past it.

For each venue in the todo list:
1. Search Google for `<name> <address>` and open the venue's knowledge panel (the business listing on the right,
   or the top card on a narrow window). Make sure the listing is this venue at this address. If the listing is a
   different business at the address, or there is none, the venue's hours are `null`.
2. Expand the hours table (the "Open ⋅ Closes …" dropdown) so all seven days show.
3. **Never infer a hidden row.** Move the mouse off the hours table (e.g. hover a blank part of the page) and
   only then take a screenshot and read every day from it. A tooltip or the cursor can cover a row: fix27 and
   fix28 both had a day guessed this way. get_page_text doesn't reach the knowledge panel, so read the
   screenshot (zoom into the table if the text is small).
4. **If a day can't be read** (covered, cut off, blurry), leave that day out and say which day in
   `listing_note`. Never copy a neighbouring day's hours into it. A day the listing shows as "Closed" is also
   left out, and `listing_note` says it's closed.
5. Ignore "Holiday hours" / "hours might differ" banners, and copy the normal weekly hours. Separate rows such as
   "Happy hours" or "Kitchen" go in `listing_note`, not in `hours`.

Return JSON only, one object keyed by the venue name exactly as given:
```json
{
  "<name>": {
    "hours": {"MON": [["11:00", "22:00"]], "FRI": [["11:00", "02:00"]]},
    "listing_note": "<optional: listing name/address differences, extra rows, days not readable>"
  }
}
```
24-hour times; a day with no key is closed or unreadable (say which in the note); a range past midnight ends at
e.g. "02:00"; two ranges in a day are two pairs. Midnight ("12 AM") is "00:00", never "24:00"; never write
"25:00" or later (fix31). `hours` is `null` if no listing for this venue was found.
