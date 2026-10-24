#!/usr/bin/env python3
"""fix12 post-step (2026-10-23 ~18:50 CDT).
1. 615chuTNey (ik-14555) DROPPED: Google lists it "Permanently closed" (TJ's screenshot, 18:45 CDT); OpenTable said the
   same on research day; r/nashville thread "615Chutney Closed?". inKind's map still lists it; the radar does not.
2. Punk Wok (ik-*, name 'Punk Wok'): gains temp_closed. It announced on Oct 20 that it would close for good on Oct 25,
   then on Oct 23 said it is staying open, taking "a short break after the weekend" and reopening Thu Oct 29 (WSMV,
   2026-10-23 3:50 PM CDT).
Input venues-20261023d.json -> output venues-20261023e.json."""
import json
d = json.load(open('venues-20261023d.json'))
before = len(d['venues'])
drop = [v for v in d['venues'] if v['id'] == 'ik-14555']
assert len(drop) == 1 and drop[0]['name'] == '615chuTNey'
d['venues'] = [v for v in d['venues'] if v['id'] != 'ik-14555']
pw = [v for v in d['venues'] if v['name'] == 'Punk Wok']
assert len(pw) == 1
pw[0]['temp_closed'] = [{'from': '2026-10-26', 'to': '2026-10-28',
    'note': 'Short break; reopens Thu Oct 29',
    'source': 'https://www.wsmv.com/2026/10/23/punk-wok-owner-says-restaurant-will-remain-open-following-permanent-closure-announcement/'}]
pw[0]['notes'] = (pw[0]['notes'] + ' Announced a permanent closure for Oct 25 on Oct 20, reversed it on Oct 23 after a deal with the landlord; staying open (WSMV, Nashville Scene).').strip()
d['coverage'] = d['coverage'].replace('160 inKind', '159 inKind') + '; 615chuTNey dropped (permanently closed)'
json.dump(d, open('venues-20261023e.json', 'w'), indent=1, ensure_ascii=False)
print(before, '->', len(d['venues']), pw[0]['id'])
