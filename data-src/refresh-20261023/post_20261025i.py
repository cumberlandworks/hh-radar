#!/usr/bin/env python3
"""fix14 data step 3: TJ's check of Kane Brown's on Broadway, 2026-10-25 02:34-02:35 CDT (two screenshots of
kanebrownsonbroadway.com: the home page hours and the /happenings/ "Monday @ Kane's Industry Night" flyer).
 - Hours: Mon-Wed 11am-2am, Thu-Sun 10am-2am (venue site).
 - Monday Industry Night ($6 domestic beer & seltzers, $8 well cocktails; Google says from 8pm) is LEFT OFF: TJ 02:38,
   "most of my network wont be industry people and its different from the rest". Recorded in the venue notes only.
 - The home page and the /happenings/ page (where its specials are posted) show no happy hour -> verified none.
Input venues-20261025h.json -> output venues-20261025i.json."""
import json
d = json.load(open('venues-20261025h.json'))
v = [x for x in d['venues'] if x['id'] == 'ik-19432']; assert len(v) == 1 and v[0]['name'] == "Kane Brown's"; v = v[0]
v['hours'] = {**{k: [['11:00', '02:00']] for k in ('MON', 'TUE', 'WED')}, **{k: [['10:00', '02:00']] for k in ('THU', 'FRI', 'SAT', 'SUN')}}
v['hours_source'] = 'https://kanebrownsonbroadway.com/ (checked by TJ 2026-10-25)'; v['hours_confidence'] = 'high'
v['notes'] = (v['notes'] + ' Monday Industry Night (from 8pm, $6 domestic beer and seltzers, $8 well cocktails) is for service-industry workers, so it is left off the radar (TJ, 2026-10-25). The site shows no happy hour.').strip()
v['verified_no_hh'] = True
v['checked'] = '2026-10-25'
json.dump(d, open('venues-20261025i.json', 'w'), indent=1, ensure_ascii=False)
print('ok')
