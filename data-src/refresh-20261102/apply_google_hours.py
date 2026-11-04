#!/usr/bin/env python3
"""fix27 D3: fold the Chrome pass's Google-listing hours into a zone's research JSON, in place.

Usage: python3 apply_google_hours.py <research or geocoded JSON> <hours-google.json> --date YYYY-MM-DD

Only venues with no hours get them: hours_source "Google listing <date>", hours_confidence "med".
A listing that showed none (hours null) is left as it was (hours empty, confidence low).
Listing notes are printed for the report, never written to the data.
fix32: a `listing_status` other than "open" (Permanently/Temporarily closed, Relocated) is printed as CLOSURE, and
that venue gets no hours from the listing: the executor settles it in the closure check (not_added "closed / moved").
"""
import json, sys

path, hours_path = sys.argv[1], sys.argv[2]
date = sys.argv[sys.argv.index('--date') + 1]
data, got = json.load(open(path)), json.load(open(hours_path))
done = []
for v in data['added']:
    g = got.get(v['name']) or got.get(v.get('lead', ''))
    if g and (g.get('listing_status') or 'open').lower() != 'open':
        print('CLOSURE: %s: Google listing "%s"%s' % (v['name'], g['listing_status'], (' (%s)' % g['listing_note']) if g.get('listing_note') else ''))
        continue
    if v.get('hours') or not g or not g.get('hours'):
        continue
    v['hours'] = g['hours']
    v['hours_source'] = 'Google listing ' + date
    v['hours_confidence'] = 'med'
    done.append(v['name'] + (' [note: %s]' % g['listing_note'] if g.get('listing_note') else ''))
json.dump(data, open(path, 'w'), indent=1, ensure_ascii=False)
print('hours from Google listings: %d (%s)' % (len(done), ', '.join(done)))
missing = [v['name'] for v in data['added'] if not v.get('hours')]
print('still no hours: %d %s' % (len(missing), missing))
