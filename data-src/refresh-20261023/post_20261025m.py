#!/usr/bin/env python3
"""fix20 data step (2026-10-25, thread + TJ):
 - Deal text: remove research leftovers (360 Bistro "(past-year specials)", Pins "(listed at $12)", The Authentique's
   quoted marketing copy, Germantown Cafe "(items not listed)").
 - 51 North Taproom: its weekday and weekend happy hours describe the same deal two ways; one wording now.
 - Slim & Husky's "$12 Tuesday" (Antioch, Buchanan): removed; the source never says what the $12 covers.
 - Blue Coast Burrito Tuesday family night (7 locations): KEPT. TJ 05:08: "there was a facebook post where I saw the same
   blue coast post recently". Noted on each window; confidence and dates unchanged (still badged verify-before-you-go).
Input venues-20261025l.json -> output venues-20261025m.json."""
import json
d = json.load(open('venues-20261025l.json'))
log = []
def deals(v):
    for w in v['windows']:
        for x in w['deals']:
            yield w, x
for v in d['venues']:
    n = v['name']
    for w, x in deals(v):
        o = x['desc']
        if n == '360 Bistro': x['desc'] = o.replace(' (past-year specials)', '')
        if n.startswith('Pins Mechanical'): x['desc'] = o.replace(' (listed at $12)', ' (usually $12)')
        if n == 'The Authentique' and o.startswith('50% off all crepes'): x['desc'] = 'Half-price crepes'
        if n == 'Germantown Cafe' and 'items not listed' in o: x['desc'] = 'Bar food specials'
        if n == '51 North Taproom' and o == '$2 off drafts, house wine, and well drinks': x['desc'] = '$2 off draft beer, house wine & well liquor'
        if x['desc'] != o: log.append((n, o, x['desc']))
    if n.startswith("Slim & Husky's"):
        before = len(v['windows'])
        v['windows'] = [w for w in v['windows'] if not (w['kind'] == 'special' and any('$12' in (x['desc'] + str(x.get('price'))) or 'Tuesday' in x['desc'] for x in w['deals']) and w['days'] == ['TUE'])]
        if len(v['windows']) != before:
            log.append((n, 'removed $12 Tuesday special', ''))
            v['notes'] = (v['notes'] + ' "$12 Tuesday" left off: its page never says what the $12 covers (2026-10-25).').strip()
    if n.startswith('Blue Coast Burrito'):
        for w in v['windows']:
            if w['kind'] == 'special' and w['days'] == ['TUE']:
                w['notes'] = (w['notes'] + ' TJ saw a recent Facebook post with this deal (reported 2026-10-25).').strip()
                log.append((n, 'noted TJ sighting', ''))
json.dump(d, open('venues-20261025m.json', 'w'), indent=1, ensure_ascii=False)
for l in log: print(l)
