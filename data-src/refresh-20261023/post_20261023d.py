#!/usr/bin/env python3
"""fix11 post-step 2 (TJ, 2026-10-23 ~18:11 CDT: "i want to make sure thats taken into account for other places").
Audit of every multi-location brand plus every helper note that says hours were carried over:
  A. Hours the helper CARRIED OVER from inKind's 2026-09-05 data but the merge labelled "researched": the values are
     right, the label is not. Relabel the source as inKind 2026-09-05, confidence low.
  B. Hours COPIED FROM A SISTER LOCATION: revert to that venue's own inKind 2026-09-05 hours, confidence low.
Input venues-20261023c.json -> output venues-20261023d.json."""
import json
OLD = {v['id']: v for v in json.load(open('venues.json'))['venues']}   # repo venues.json as of v1.9 (2026-09-05 data)
INKIND = 'inKind map API 2026-09-05 (not re-confirmed 2026-10-23; inKind no longer publishes hours)'
CARRIED = {  # A: research notes say carried over from inKind, and the values equal inKind's
    'ik-14096': 'Flour Your Dreams Bakery & Cafe', 'ik-17393': "Salvo's Pizza - Mt. Juliet",
    'ik-9525': 'Sushi By Bou - Nashville', 'ik-2562': 'Bakersfield - Nashville', 'ik-8922': 'Gregorys Coffee - Opry Mills',
    'ik-11302': 'Just Love Coffee - Murfreesboro East', 'ik-11586': 'Blue Coast Burrito - Hendersonville',
    'ik-13745': 'Vintage Vine 100', 'ik-17392': "Salvo's Pizza - Franklin", 'ik-17394': "Salvo's Pizza - Smyrna",
    'ik-17961': 'Tantisimo'}
COPIED = {  # B: hours taken from another location of the same brand
    'ik-11678': ('The Pancake Pantry - Nashville', "the Hillsboro Village location's 6am-3pm"),
}
d = json.load(open('venues-20261023c.json'))
seen = set()
for v in d['venues']:
    if v['id'] in CARRIED:
        assert v['name'] == CARRIED[v['id']], v['name']
        assert v['hours'] == OLD[v['id']]['hours'], v['name'] + ': hours differ from inKind 2026-09-05'
        v['hours_source'] = INKIND
        v['hours_confidence'] = 'low'
        seen.add(v['id'])
    elif v['id'] in COPIED:
        name, what = COPIED[v['id']]
        assert v['name'] == name, v['name']
        v['hours'] = OLD[v['id']]['hours']
        v['hours_source'] = INKIND
        v['hours_confidence'] = 'low'
        v['hours_notes'] = ('Research applied %s to this location; reverted to this location\'s own inKind hours.' % what)
        seen.add(v['id'])
assert seen == set(CARRIED) | set(COPIED), set(CARRIED) | set(COPIED) - seen
json.dump(d, open('venues-20261023d.json', 'w'), indent=1, ensure_ascii=False)
print('relabelled', len(CARRIED), 'reverted', len(COPIED))
