#!/usr/bin/env python3
"""fix31: the executor's fixes on research/geocoded-south.json after geocode_v2zone.py and apply_google_hours.py
(idempotent; re-run after a fresh geocode). Order: combine_south.py -> geocode_v2zone.py -> this ->
apply_google_hours.py -> merge_v2zone.py.
  - Two leads the researchers added from live sites closed in 2026 (Chrome pass + news): not added, closed / moved.
  - Nominatim missed "Green Hills Village Dr"; spelled "Drive" it hits 3821 by house number, and North Italia by
    its own named point. Points from those hits, never guessed.
  - Ramone's: Saturday 1-4pm is the Mercado's happy hour; Ramone's own posted hours start at 4pm (noted)."""
import json, os, subprocess
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(H, '..')
p = os.path.join(R, 'geocoded-south.json'); d = json.load(open(p))
CLOSED = {
    '12 South Taproom & Grill': ('https://www.newschannel5.com/news/12-south-taproom-set-to-close-the-latest-in-a-string-of-local-neighborhood-closures',
        'closed May 2026 (Google listing "Permanently closed"; news May 2026)'),
    'Burger Up': ('https://fox17.com/news/local/burger-up-closing-nashville-after-16-years-final-day-august-1',
        'closed Aug 1, 2026 (news June 2026)'),
}
keep = []
for v in d['added']:
    if v['name'] in CLOSED:
        u, why = CLOSED[v['name']]
        d['not_added'].append({'lead': v['lead'], 'reason': 'closed / moved', 'url': u,
                               'detail': 'fix31 executor: researched as open from its live site; ' + why})
    else:
        keep.append(v)
d['added'] = keep
PTS = {'Emmy Squared Pizza': (36.1092613, -86.8154796, '3821 Green Hills Village Drive, Nashville, TN 37215',
                              '3821, Green Hills Village Drive, Green Hills, Nashville'),
       'North Italia': (36.1077062, -86.8156029, 'North Italia, Nashville (POI; "2159 Green Hills Village Dr" had no hit)',
                        'North Italia, Green Hills Village Drive, Green Hills, Nashville')}
for v in d['added']:
    if v['name'] in PTS and not isinstance(v.get('lat'), (int, float)):
        la, lo, q, dn = PTS[v['name']]
        pt = json.loads(subprocess.run(['node', os.path.join(R, '..', 'v2zone_helper.js'), 'place'], capture_output=True, text=True,
            input=json.dumps({'items': [{'lat': la, 'lon': lo, 'addr_hood_text': 'Green Hills', 'text_hood': None}]})).stdout)[0]
        v['lat'], v['lon'] = la, lo
        v['geocode'] = {'query': q, 'display_name': dn, 'osm_hood': 'Green Hills', 'point_hood': pt['point_hood'],
                        'addr_hood': 'Green Hills', 'match': pt['point_zone'] == pt['addr_zone'], 'by': 'executor fix31 retry'}
    if v['name'].startswith("Ramone's"):
        for w in v['windows']:
            if w['days'] == ['SAT']:
                w['notes'] = ("Saturday 1-4pm is the Mercado's happy hour (the specials also apply on Ramone's rooftop); "
                              "Ramone's own posted hours start at 4pm, so check before you go.")
json.dump(d, open(p, 'w'), indent=1, ensure_ascii=False)
print('added %d, not added %d' % (len(d['added']), len(d['not_added'])))
