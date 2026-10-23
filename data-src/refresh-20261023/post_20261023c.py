#!/usr/bin/env python3
"""fix11 post-step: TJ's ruling 2026-10-23 ~18:10 CDT, "LinQ to Downtown/SoBro". 175 Lafayette Street is SoBro;
the hood script's nearest-centroid pick (Wedgewood-Houston) was wrong. Label only: lat/lon unchanged.
Input venues-20261023b.json -> output venues-20261023c.json (same 1-space JSON format)."""
import json
d = json.load(open('venues-20261023b.json'))
n = 0
for v in d['venues']:
    if v['id'] == 'ik-19732':
        assert v['name'] == 'LinQ Social Kitchen', v['name']
        v['hood'] = v['neighborhood'] = 'Downtown/SoBro'
        v['zone'] = 'downtown'
        n += 1
assert n == 1
json.dump(d, open('venues-20261023c.json', 'w'), indent=1, ensure_ascii=False)
