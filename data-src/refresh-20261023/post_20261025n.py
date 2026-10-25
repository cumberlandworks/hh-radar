#!/usr/bin/env python3
"""fix21 data step (TJ 2026-10-25 13:05, with the Facebook link he had seen:
facebook.com/BlueCoastBurritoLR/videos/... "It's Taco Tuesday and family night ..."): "this is what I saw - maybe its
better to just leave it off - this is little rock."
 - Blue Coast Burrito Tuesday family night REMOVED from all 7 Nashville-area locations: the recent post is the Little Rock
   franchise; the only Nashville-area source is a Jan 2025 Instagram post, and the official site shows no family night.
   With no other deal, each is marked verified no happy hour (fast-casual counter service; none on its site or menu).
 - The Authentique: "Half-price crepes" + "50% off" said the discount twice -> "All crepes" + "50% off".
Input venues-20261025m.json -> output venues-20261025n.json."""
import json
d = json.load(open('venues-20261025m.json'))
log = []
for v in d['venues']:
    if v['name'].startswith('Blue Coast Burrito'):
        before = len(v['windows'])
        v['windows'] = [w for w in v['windows'] if not (w['kind'] == 'special' and w['days'] == ['TUE'])]
        assert before == 1 and not v['windows'], v['name']
        v['verified_no_hh'] = True
        v['notes'] = (v['notes'] + ' Tuesday family night left off (2026-10-25): the recent post TJ found is the Little Rock franchise; no Nashville-area source since Jan 2025.').strip()
        log.append(v['name'])
    if v['name'] == 'The Authentique':
        for w in v['windows']:
            for x in w['deals']:
                if x['desc'] == 'Half-price crepes': x['desc'] = 'All crepes'; log.append('Authentique crepes')
json.dump(d, open('venues-20261025n.json', 'w'), indent=1, ensure_ascii=False)
print(len(log), log)
