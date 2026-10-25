#!/usr/bin/env python3
"""fix14 data step 4: TJ, 2026-10-25 02:48 CDT: "looking at both of those sites and images on google it doesn't appear
that either have a happy hour" (Chateau West, Legendary Wings) -> both verified no happy hour.
Input venues-20261025i.json -> output venues-20261025j.json."""
import json
d = json.load(open('venues-20261025i.json'))
n = 0
for v in d['venues']:
    if v['id'] in ('ik-20518', 'ik-18917'):
        assert v['name'] in ('Chateau West', 'Legendary Wings') and not v['windows']
        v['verified_no_hh'] = True
        v['notes'] = (v['notes'] + ' No happy hour on its site or in its Google photos (checked by TJ 2026-10-25).').strip()
        v['checked'] = '2026-10-25'; n += 1
assert n == 2
json.dump(d, open('venues-20261025j.json', 'w'), indent=1, ensure_ascii=False)
print('ok')
