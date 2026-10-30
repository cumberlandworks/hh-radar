#!/usr/bin/env python3
# The raw inKind roster pull (inkind-tn-20261023.tsv) is not published (removed 2026-10-29),
# so this script needs a fresh pull to re-run.
"""Merge the 2026-10-23 refresh research into venues.json (schema v2).

Inputs (same folder): venues.json (v1.9, 2026-09-05), inkind-tn-20261023.tsv,
research/batch{A,B,C,D}.json. Output: venues-20261023.json + merge-report-20261023.json.
Rules are the planning thread's design freeze for BLOCK-hh-radar-fix10 (see that block).
"""
import json, re, glob, copy
from collections import Counter

TODAY = '2026-10-23'
DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
HHMM = re.compile(r'^([01][0-9]|2[0-3]):[0-5][0-9]$')
METRO = {"Nashville", "Franklin", "Murfreesboro", "Smyrna", "Brentwood", "Mt. Juliet", "Hendersonville",
         "Gallatin", "Antioch", "Spring Hill", "Dickson", "Lewisburg", "Nolensville"}

old = json.load(open('venues.json'))
OLD = {v['inkind_id']: v for v in old['venues']}
lines = open('inkind-tn-20261023.tsv', encoding='utf-8').read().split('\n')
hdr = lines[0].split('\t')
PULL = {int(r['location_id']): r for r in (dict(zip(hdr, l.split('\t'))) for l in lines[2:]) if r['city'] in METRO}
R = {}
for f in sorted(glob.glob('research/batch*.json')):
    for v in json.load(open(f))['venues']:
        R[v['id']] = v


# --- 2026-10-23 post-run fix (fix11): batchC's helper wrote only the FRI/SAT part of "Sun-Thu ...; Fri-Sat ..."
# hours for 8 venues (found in the fix10 review: Chauhan read "Closed today" on its happy-hour days). Where the
# helper's own source quote gives the other days, they are filled from that quote; where it gives no quote, the
# venue falls back to inKind's 2026-09-05 hours at low confidence.
def _r(a, b): return [[a, b]]
HOURS_FROM_QUOTE = {
    4949:  {d: _r('08:00', '21:00') for d in ('SUN', 'MON', 'TUE', 'WED', 'THU')},        # Two Hands
    5323:  {d: _r('17:00', '20:30') for d in ('SUN', 'MON', 'TUE', 'WED', 'THU')},        # Nicky's Coal Fired Pizza
    7261:  dict({d: _r('11:00', '21:00') for d in ('MON', 'TUE', 'WED', 'THU')}, SUN=_r('11:00', '21:00')),  # Slim & Husky's Buchanan
    14558: {d: [['11:00', '14:00'], ['16:30', '21:00']] for d in ('SUN', 'MON', 'TUE', 'WED', 'THU')},  # Chauhan
    16869: {d: _r('09:00', '20:00') for d in ('SUN', 'MON', 'TUE', 'WED', 'THU')},        # Mr. J's Original - Nashville
}
HOURS_REVERT_TO_INKIND = {9357, 12587, 16195}  # Philippe Chow, Van Leeuwen Edgehill, Prince St. Pizza: no quote
for _iid, _days in HOURS_FROM_QUOTE.items():
    R[_iid]['hours'] = dict(R[_iid]['hours'] or {}, **_days)
for _iid in HOURS_REVERT_TO_INKIND:
    R[_iid]['hours'] = None
    R[_iid]['hours_notes'] = ((R[_iid].get('hours_notes') or '') + ' Research hours were incomplete (FRI/SAT only); using inKind 2026-09-05 hours.').strip()

rep = {'dropped_not_in_inkind': [], 'new': [], 'windows_dropped_unrenderable': [], 'fixes': [],
       'hours_from_research': 0, 'hours_kept_inkind_0905': [], 'hours_none': [], 'status_unknown': [],
       'hh_unchecked': [], 'retired_windows': []}

def hm(t):
    if t is None: return None
    t = str(t).strip()
    if t == 'close': return t
    m = re.match(r'^(\d{1,2}):(\d{2})$', t)
    if not m: return None
    h, mi = int(m.group(1)), int(m.group(2))
    if h == 24 and mi == 0: return '00:00'
    if h > 23 or mi > 59: return None
    return '%02d:%02d' % (h, mi)

def norm_hours(h):
    if not h: return None
    out = {}
    for d in DAYS:
        rs = h.get(d)
        if not rs: continue
        ok = []
        for r in rs:
            if not isinstance(r, (list, tuple)) or len(r) != 2: return None
            a, b = hm(r[0]), hm(r[1])
            if not a or not b or a == 'close' or b == 'close': return None
            ok.append([a, b])
        out[d] = ok
    return out or None

def norm_window(w, vname):
    days = w.get('days') or []
    days = [d for d in DAYS if d in set(days)]
    start, end = hm(w.get('start')), hm(w.get('end'))
    srcs = [s for s in (w.get('sources') or []) if s]
    deals = [{'type': d['type'], 'desc': d['desc'].strip(), 'price': d.get('price')}
             for d in (w.get('deals') or []) if d.get('type') in ('food', 'drink') and (d.get('desc') or '').strip()]
    why = []
    if not days: why.append('no days')
    if not start or start == 'close': why.append('no start')
    if not end: why.append('no end')
    if not srcs: why.append('no sources')
    if w.get('kind') not in ('happy_hour', 'special', 'lunch'): why.append('kind ' + str(w.get('kind')))
    if why:
        rep['windows_dropped_unrenderable'].append({'venue': vname, 'why': why, 'window': w})
        return None
    conf = w.get('confidence') if w.get('confidence') in ('high', 'med', 'low') else 'low'
    return {'days': days, 'start': start, 'end': end, 'area': w.get('area') if w.get('area') not in ('null', '') else None,
            'kind': w['kind'], 'deals': deals, 'sources': srcs, 'last_verified': w.get('last_verified'),
            'corroborated': bool(w.get('corroborated')), 'confidence': conf, 'notes': w.get('notes') or ''}

out = []
for iid, r in R.items():
    base = copy.deepcopy(OLD[iid]) if iid in OLD else None
    p = PULL.get(iid)
    if p is None:
        rep['fixes'].append('%s: researched but not in the metro pull; skipped' % r['name'])
        continue
    if r.get('still_operating') is False:
        rep['dropped_not_in_inkind'].append({'id': iid, 'name': r['name'], 'why': 'closed per research'})
        continue
    if base is None:
        base = {'id': 'ik-%d' % iid, 'inkind_id': iid, 'name': p['name'], 'city': p['city'], 'neighborhood': None,
                'hood': None, 'zone': None, 'address': p['address'].lstrip(': ').strip(), 'zip': p['zip_code'],
                'lat': float(p['latitude']), 'lon': float(p['longitude']), 'tz': 'America/Chicago', 'inkind': True,
                'inkind_url': p['purchase_page_link'], 'official_site': None, 'status': 'open', 'hours': {},
                'hours_source': '', 'windows': [], 'verified_no_hh': False, 'checked': TODAY,
                'disagreements': [], 'notes': ''}
        rep['new'].append(p['name'])
    # inKind is the roster: name/address/coords/link from today's pull
    base['address'] = p['address'].lstrip(': ').strip()
    if base['address'] != p['address']:
        rep['fixes'].append('%s: address %r -> %r (stray prefix in inKind data)' % (base['name'], p['address'], base['address']))
    base['inkind_url'] = p['purchase_page_link'] or base['inkind_url']
    if r.get('official_site'): base['official_site'] = r['official_site']
    # hours
    h = norm_hours(r.get('hours'))
    if h:
        base['hours'] = h
        conf = r.get('hours_confidence') or 'med'
        base['hours_source'] = 'researched %s (%s confidence): %s' % (TODAY, conf, '; '.join(
            s.get('url', '') for s in (r.get('hours_sources') or [])[:2]))
        base['hours_confidence'] = conf if conf in ('high', 'med', 'low') else 'low'
        rep['hours_from_research'] += 1
    elif base.get('hours'):
        base['hours_source'] = 'inKind map API 2026-09-05 (not re-confirmed %s; inKind no longer publishes hours)' % TODAY
        base['hours_confidence'] = 'low'
        rep['hours_kept_inkind_0905'].append(base['name'])
    else:
        base['hours'] = {}
        base['hours_source'] = 'none found %s' % TODAY
        base['hours_confidence'] = 'low'
        rep['hours_none'].append(base['name'])
    if r.get('hours_notes'): base['hours_notes'] = r['hours_notes']
    # windows
    notes = [r.get('notes') or '']
    if r.get('windows') is None:
        if iid in OLD:
            notes.append('Happy hour not re-checkable %s; windows carried from 2026-09-05.' % TODAY)
        else:
            base['windows'] = []
            rep['hh_unchecked'].append(base['name'])
            notes.append('Happy hour not yet confirmed (%s).' % TODAY)
    else:
        ws = [x for x in (norm_window(w, base['name']) for w in r['windows']) if x]
        base['windows'] = ws
    for rw in r.get('retired_windows') or []:
        rep['retired_windows'].append({'venue': base['name'], **rw})
    has_hh = any(w['kind'] == 'happy_hour' for w in base['windows'])
    base['verified_no_hh'] = bool(r.get('verified_no_hh')) and not has_hh and r.get('windows') is not None
    base['lunch_checked'] = bool(r.get('lunch_checked'))
    base['checked'] = TODAY
    base['disagreements'] = r.get('disagreements') or []
    if r.get('still_operating') == 'unknown':
        rep['status_unknown'].append(base['name'])
        notes.append('Still operating? Not confirmed %s.' % TODAY)
    if r.get('tj_question_answer'): notes.append('First-visit question: ' + r['tj_question_answer'])
    base['notes'] = ' '.join(n for n in notes if n).strip()
    out.append(base)

for iid, v in OLD.items():
    if iid not in PULL:
        rep['dropped_not_in_inkind'].append({'id': iid, 'name': v['name'], 'why': 'not in inKind map pull %s' % TODAY})

out.sort(key=lambda v: v['name'].lower())
data = {'schema_version': 2, 'generated': TODAY,
        'generator': 'merge_20261023.py (hh-radar planning thread, from research/batch*.json + inkind-tn-20261023.tsv)',
        'coverage': '%d inKind partners in the Nashville metro per inKind map API %s; every venue re-researched %s' % (len(out), TODAY, TODAY),
        'venues': out}
json.dump(data, open('venues-20261023b-prehood.json', 'w'), indent=1, ensure_ascii=False)
c = Counter(w['kind'] for v in out for w in v['windows'])
rep['counts'] = {'venues': len(out), 'with_any_window': sum(1 for v in out if v['windows']),
                 'with_hh': sum(1 for v in out if any(w['kind'] == 'happy_hour' for w in v['windows'])),
                 'verified_no_hh': sum(v['verified_no_hh'] for v in out), 'windows': sum(c.values()), 'by_kind': dict(c),
                 'lunch_venues': sum(1 for v in out if any(w['kind'] == 'lunch' for w in v['windows'])),
                 'stale_on_%s' % TODAY: None}
json.dump(rep, open('merge-report-20261023b.json', 'w'), indent=1, ensure_ascii=False)
print(json.dumps(rep['counts'], indent=1))
for k in ('dropped_not_in_inkind', 'windows_dropped_unrenderable', 'hours_kept_inkind_0905', 'hours_none', 'status_unknown', 'hh_unchecked', 'fixes', 'retired_windows'):
    x = rep[k]
    print(k, len(x) if isinstance(x, list) else x)
    for i in (x if isinstance(x, list) else []):
        print('   ', i if isinstance(i, str) else json.dumps(i, ensure_ascii=False)[:220])
