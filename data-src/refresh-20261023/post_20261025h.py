#!/usr/bin/env python3
"""fix14 data step 2: TJ's own checks, 2026-10-25 02:23-02:27 CDT (three screenshots: chateauwestrestaurant.com/contact,
salvopizza.com/mt-juliet, and Google's panel for The Urban Perk). The venue's own site is canonical over Google.
 - Chateau West: site hours (Lunch Tue-Fri 11-3, Dinner Mon-Sun 3-10, Brunch Sun 10:45-3) replace Google's. Happy hour
   still unknown.
 - Salvo's Pizza - Mt. Juliet: site hours (Mon-Thu 10:30-8:30, Fri 10-9:30, Sat-Sun 11-9:30) replace Google's; the site
   lists no happy hour, like the other five Salvo's -> verified no happy hour.
 - The Urban Perk: Google panel matches the browser pass exactly (Sun-Fri 7:45-2:30, Sat closed); a coffee shop that
   closes at 2:30pm, no happy hour listed -> verified no happy hour.
Input venues-20261025g.json -> output venues-20261025h.json."""
import json
d = json.load(open('venues-20261025g.json'))
by = {v['id']: v for v in d['venues']}
r = lambda a, b: [[a, b]]
cw = by['ik-20518']; assert cw['name'] == 'Chateau West'
cw['hours'] = {'MON': r('15:00', '22:00'), 'TUE': r('11:00', '22:00'), 'WED': r('11:00', '22:00'), 'THU': r('11:00', '22:00'),
               'FRI': r('11:00', '22:00'), 'SAT': r('15:00', '22:00'), 'SUN': r('10:45', '22:00')}
cw['hours_source'] = 'https://chateauwestrestaurant.com/contact/ (checked by TJ 2026-10-25)'; cw['hours_confidence'] = 'high'
cw['hours_notes'] = 'Lunch Tue-Fri 11-3, dinner daily 3-10, Sunday brunch 10:45-3. Google lists slightly different closing times.'
sm = by['ik-17393']; assert sm['name'] == "Salvo's Pizza - Mt. Juliet"
sm['hours'] = {**{d_: r('10:30', '20:30') for d_ in ('MON', 'TUE', 'WED', 'THU')}, 'FRI': r('10:00', '21:30'),
               'SAT': r('11:00', '21:30'), 'SUN': r('11:00', '21:30')}
sm['hours_source'] = 'https://salvopizza.com/mt-juliet/ (checked by TJ 2026-10-25)'; sm['hours_confidence'] = 'high'
sm['hours_notes'] = 'Google lists earlier closing times; the restaurant site is used.'
sm['verified_no_hh'] = True; sm['notes'] = (sm['notes'] + ' No happy hour on its site (checked 2026-10-25), same as the other Salvo\'s locations.').strip()
up = by['ik-18918']; assert up['name'] == 'The Urban Perk'
up['hours_source'] = 'Google business listing, checked 2026-10-25 (confirmed by TJ the same day)'
up['verified_no_hh'] = True; up['notes'] = (up['notes'] + ' Coffee shop open 7:45am-2:30pm; no happy hour listed (2026-10-25).').strip()
json.dump(d, open('venues-20261025h.json', 'w'), indent=1, ensure_ascii=False)
print('ok')
