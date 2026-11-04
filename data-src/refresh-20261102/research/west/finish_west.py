#!/usr/bin/env python3
"""fix32: the executor's fixes on research/geocoded-west.json after geocode_v2zone.py (idempotent; re-run after a
fresh geocode). Order: combine_west.py -> geocode_v2zone.py -> this -> apply_google_hours.py -> merge_v2zone.py.
  - AVO: "4 City Blvd #104" has no street hit, even spelled out ("4 City Boulevard"). Nominatim has AVO itself as
    a named point at oneC1TY ("AVO, 3, C1TY Avenue, oneC1TY Nashville, 37209"); the point is that hit, never guessed.
  - CLOSED: venues the closure check (BRIEF-closure-check.md + the Chrome banner) found closed or moved, moved to
    not_added "closed / moved" with the source. Filled in after the check.
"""
import json, os, subprocess
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(H, '..')
p = os.path.join(R, 'geocoded-west.json'); d = json.load(open(p))
CLOSED = {}
keep = []
for v in d['added']:
    if v['name'] in CLOSED:
        u, why = CLOSED[v['name']]
        d['not_added'].append({'lead': v['lead'], 'reason': 'closed / moved', 'url': u,
                               'detail': 'fix32 closure check: ' + why})
    else:
        keep.append(v)
d['added'] = keep
PTS = {'AVO': (36.152632, -86.820117, 'AVO, Nashville (POI; "4 City Blvd" and "4 City Boulevard" had no hit)',
               'AVO, 3, C1TY Avenue, oneC1TY Nashville, Nashville, Davidson County, Tennessee, 37209')}
for v in d['added']:
    if v['name'] in PTS and not isinstance(v.get('lat'), (int, float)):
        la, lo, q, dn = PTS[v['name']]
        pt = json.loads(subprocess.run(['node', os.path.join(R, '..', 'v2zone_helper.js'), 'place'], capture_output=True, text=True,
            input=json.dumps({'items': [{'lat': la, 'lon': lo, 'addr_hood_text': None, 'text_hood': v.get('neighborhood')}]})).stdout)[0]
        v['lat'], v['lon'] = la, lo
        v['geocode'] = {'query': q, 'display_name': dn, 'osm_hood': None, 'point_hood': pt['point_hood'],
                        'addr_hood': pt['addr_hood'], 'match': 'POI hit (point only)', 'by': 'executor fix32 retry'}
        print('%s -> %s (%s); text hood %s (%s)' % (v['name'], pt['point_hood'], pt['point_zone'], pt['addr_hood'], pt['addr_zone']))
json.dump(d, open(p, 'w'), indent=1, ensure_ascii=False)
print('added %d, not added %d' % (len(d['added']), len(d['not_added'])))
