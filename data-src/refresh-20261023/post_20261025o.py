#!/usr/bin/env python3
"""fix24 C3 data step, TJ ruling 2026-10-25 (after the fix24 report): "Apply the strongest C3 leans as a data fix:
Acme Monday hours, Fortuna open Monday, drop the Detroit Cowboy patio window, ZuZu HH Tue–Fri 5–7pm."
None of these was settled by a 2026-dated source (see research-fix24-c3-20261025.md in the thread folder); each is TJ's
call on the official pages as read 2026-10-25.
 - Acme Feed & Seed: MON 11:00-16:30 -> 11:00-23:00 (the 1st-floor hours the other days already use; no source has
   Monday ending at 4:30pm). The Mon-Thu 4:30-6:30 happy hour is now inside the hours. Confidence stays low.
 - Fortuna Italian Steakhouse: MON added, 16:30-21:30 (homepage "Daily 4:30 PM-9:30 PM", a Monday wine promo, Atmosfy
   daily; only the /happyhour footer says Tue-Sun). Confidence stays med.
 - The Detroit Cowboy: the daily 15:00-close patio window (last verified 2026-09-05) removed; no current source
   mentions it. The Mon-Sat 4-6pm and Sun 3-6pm happy hours stay.
 - ZuZu: happy hour Mon-Fri 16:00-18:00 -> Tue-Fri 17:00-19:00, the official /nashville/ page's reading. Confidence
   stays low (the pages still disagree); last_verified 2026-10-25.
Input venues-20261025n.json -> output venues-20261025o.json."""
import json
d = json.load(open('venues-20261025n.json'))
log = []
RULING = ' TJ ruling 2026-10-25 (fix24 C3 lean):'
for v in d['venues']:
    n = v['name']
    if n == 'Acme Feed & Seed':
        assert v['hours']['MON'] == [['11:00', '16:30']], v['hours']['MON']
        v['hours']['MON'] = [['11:00', '23:00']]
        v['hours_source'] = 'Official site floor hours (1st floor 11am-11pm daily), checked 2026-10-25'
        v['hours_notes'] = (v['hours_notes'] + RULING + ' Monday set to 11:00-23:00; no source had it ending at 16:30.').strip()
        v['checked'] = '2026-10-25'
        log.append((n, 'MON hours 11:00-23:00'))
    if n == 'Fortuna Italian Steakhouse':
        assert 'MON' not in v['hours']
        v['hours'] = dict([('MON', [['16:30', '21:30']])] + list(v['hours'].items()))
        v['hours_source'] = 'Official homepage "Daily 4:30 PM-9:30 PM", checked 2026-10-25'
        v['hours_notes'] = (v['hours_notes'] + RULING + ' Monday open 16:30-21:30 (homepage "Daily", Monday wine promo, Atmosfy daily); only the /happyhour footer says Tue-Sun.').strip()
        v['checked'] = '2026-10-25'
        log.append((n, 'MON open 16:30-21:30'))
    if n == 'The Detroit Cowboy':
        before = len(v['windows'])
        v['windows'] = [w for w in v['windows'] if not (w['area'] == 'patio' and w['start'] == '15:00' and w['end'] == 'close')]
        assert len(v['windows']) == before - 1, n
        v['notes'] = (v['notes'] + RULING + ' the daily 3pm-close patio happy hour (last verified 2026-09-05) was removed; the menu page and Visit Music City list only the Mon-Sat 4-6pm / Sun 3-6pm Golden Hour.').strip()
        v['checked'] = '2026-10-25'
        log.append((n, 'patio window removed'))
    if n == 'ZuZu':
        hh = [w for w in v['windows'] if w['kind'] == 'happy_hour']
        assert len(hh) == 1 and hh[0]['days'] == ['MON', 'TUE', 'WED', 'THU', 'FRI'] and hh[0]['start'] == '16:00', hh
        w = hh[0]
        w['days'] = ['TUE', 'WED', 'THU', 'FRI']
        w['start'], w['end'] = '17:00', '19:00'
        w['sources'] = ['https://experiencezuzu.com/nashville/'] + [s for s in w['sources'] if s != 'https://experiencezuzu.com/nashville/']
        w['last_verified'] = '2026-10-25'
        w['notes'] = (w['notes'] + RULING + ' Tue-Fri 5-7pm, the official /nashville/ reading; it fits the posted 5pm opening and Monday closed.').strip()
        v['notes'] = v['notes'].replace('The Mon-Fri 4-6 reading was chosen for the window only because Guru\'s time matches it; the other reading is recorded above.',
                                        'The window uses the Tue-Fri 5-7pm reading (TJ ruling 2026-10-25); the other reading is recorded above.')
        v['checked'] = '2026-10-25'
        log.append((n, 'HH Tue-Fri 17:00-19:00'))
json.dump(d, open('venues-20261025o.json', 'w'), indent=1, ensure_ascii=False)
for l in log: print(l)
