#!/usr/bin/env python3
"""fix15 data step (thread ruling on the fix14 report, 2026-10-25):
 - Stale hours notes: where a venue's hours now come from the 2026-10-25 Google pass, any older `hours_notes` described
   the old source ("No hours found", "OpenTable used", ...) and is removed. Acme Feed & Seed keeps its note (written by the
   pass). Venues TJ checked by hand keep the notes written then.
 - `generated` -> 2026-10-25 (the footer's "Data generated" date).
Input venues-20261025j.json -> output venues-20261025k.json."""
import json
d = json.load(open('venues-20261025j.json'))
KEEP = {'ik-16087', 'ik-20518', 'ik-17393'}  # Acme (pass note), Chateau West, Salvo's Mt. Juliet (TJ-checked notes)
cleared = []
for v in d['venues']:
    if v.get('hours_source', '').startswith('Google business listing, checked 2026-10-25') and v.get('hours_notes') and v['id'] not in KEEP:
        cleared.append(v['name']); del v['hours_notes']
d['generated'] = '2026-10-25'
json.dump(d, open('venues-20261025k.json', 'w'), indent=1, ensure_ascii=False)
print(len(cleared), cleared)
