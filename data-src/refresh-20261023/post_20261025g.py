#!/usr/bin/env python3
"""fix14 data step: fold in the 2026-10-25 browser pass (research/browser-pass.json; Sonnet in TJ's Chrome, approved by
TJ 2026-10-25 01:56 CDT). Thread rulings applied here, each named in the CHANGELOG:
 - Hours: take the Google business-panel hours where the pass rated them high/med and they are store-specific.
   NOT taken: all six Tiff's Treats (the panels were the brand's shared delivery panel, or another store's: hours
   copied across locations, which TJ ruled out on 2026-10-23), both Bad-Ass Breakfast Burritos (Uber Eats delivery
   hours, not dine-in). Acme Feed & Seed taken at low (Google vs the venue's site disagree; multi-floor venue).
 - Happy hours: add NoWhere Special (high), Bakersfield, Bungalow 10, Butterfly, Margaritaville (med or low), Noir (low,
   sources disagree), LinQ Friday only (low). NOT added: LinQ's Tuesday window (day inferred from a file name) and
   Jar 10 (the only source was a "Jar Cocktail Club" post: possibly another business).
Input venues-20261023f.json -> output venues-20261025g.json."""
import json
TODAY = '2026-10-25'
DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
B = {v['id']: v for v in json.load(open('research/browser-pass.json'))['venues']}
SKIP_HOURS = {21369, 21448, 21493, 21469, 21351, 21489, 12500, 15989}
LOW_HOURS = {16087}
HH_ADD = {19205, 2562, 19204, 14146, 19673, 19731, 19732}
HH_LOW = {14146, 19731, 19732}
def norm_hours(h):
    out = {}
    for d in DAYS:
        rs = [r for r in (h.get(d) or []) if r and len(r) == 2]
        if rs: out[d] = [[a, b] for a, b in rs]
    return out
d = json.load(open('venues-20261023f.json'))
log = {'hours_taken': [], 'hours_skipped': [], 'hh_added': [], 'hh_still_unknown': []}
for v in d['venues']:
    b = B.get(v['inkind_id'])
    if not b: continue
    if b.get('hours') and v['inkind_id'] not in SKIP_HOURS and b.get('hours_confidence') in ('high', 'med', 'low'):
        if b['hours_confidence'] == 'low' and v['inkind_id'] not in LOW_HOURS:
            log['hours_skipped'].append(v['name'])
        else:
            v['hours'] = norm_hours(b['hours'])
            v['hours_source'] = 'Google business listing, checked %s' % TODAY
            v['hours_confidence'] = 'low' if v['inkind_id'] in LOW_HOURS else b['hours_confidence']
            if v['inkind_id'] in LOW_HOURS: v['hours_notes'] = b.get('notes', '')
            log['hours_taken'].append(v['name'])
    elif b.get('hours'):
        log['hours_skipped'].append(v['name'])
    if v['inkind_id'] in HH_ADD:
        for w in b['windows']:
            if v['inkind_id'] == 19732 and w['days'] != ['FRI']: continue
            v['windows'].append({'days': [x for x in DAYS if x in w['days']], 'start': w['start'], 'end': w['end'],
                'area': w.get('area'), 'kind': 'happy_hour',
                'deals': [{'type': x['type'], 'desc': x['desc'], 'price': x.get('price')} for x in w['deals']],
                'sources': w['sources'], 'last_verified': TODAY, 'corroborated': False,
                'confidence': 'low' if v['inkind_id'] in HH_LOW else w['confidence'], 'notes': w.get('notes', '')})
        v['verified_no_hh'] = False
        log['hh_added'].append(v['name'])
    elif b.get('happy_hour') in ('unknown', 'found'):
        log['hh_still_unknown'].append(v['name'])
    v['checked'] = TODAY
json.dump(d, open('venues-20261025g.json', 'w'), indent=1, ensure_ascii=False)
for k, x in log.items(): print(k, len(x), x)
