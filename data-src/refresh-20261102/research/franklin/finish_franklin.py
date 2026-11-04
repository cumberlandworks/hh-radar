#!/usr/bin/env python3
"""fix33: the executor's fixes on research/geocoded-franklin.json after geocode_v2zone.py (idempotent; re-run after a
fresh geocode). Order: combine_franklin.py -> geocode_v2zone.py -> this -> apply_google_hours.py -> merge_v2zone.py.
  - Firebirds Wood Fired Grill (Brentwood): "700 Old Hickory Blvd, Brentwood" has no hit (also spelled out). With the
    ZIP instead of the town, "700 Old Hickory Boulevard, 37027" hits house 700 (OSM files it under Nashville/Benbar,
    Davidson County, 37027; Brentwood is the mailing town). A second "700" hit 500 m west was not used: the one taken
    is ~130 m from inKind E+ROSE - Brentwood (ik-15741, 700 Old Hickory Boulevard #203). Never guessed.
  - CLOSED: venues the closure check (BRIEF-closure-check.md + the Chrome banner) found closed or moved, under the
    closure rule (TJ, 2026-11-04): a dated closure source, or Google "Permanently closed" / "Relocated". Moved to
    not_added "closed / moved" with the source.
  - NOT_CLOSED: the not-added leads the researchers called "closed / moved", each re-checked (web + Google banner).
    All six stay out; the detail now names the dated source or banner the check found (the researcher's MAFIAoZA's
    source was a story about another location). Kokomo and Granite City are only "Temporarily closed".
"""
import json, os, subprocess
H = os.path.dirname(os.path.abspath(__file__)); R = os.path.join(H, '..')
p = os.path.join(R, 'geocoded-franklin.json'); d = json.load(open(p))
CLOSED = {
    'Twin Peaks Cool Springs': ('https://williamsonsource.com/twin-peaks-in-cool-springs-has-closed-after-14-years/',
        'Williamson Source (June 2026): "Twin Peaks in Cool Springs Has Closed After 14 Years"; Apple Maps "Permanently '
        'Closed", Yelp "CLOSED" (updated Aug 2026). Google has no listing of its own for it.'),
    'Condado Tacos': ('https://locations.condadotacos.com/tn/4031-aspen-grove-dr',
        'Google listing at 4031 Aspen Grove Dr #108 shows "Permanently closed" (Chrome, 2026-11-04); Yelp "CLOSED". '
        'The researcher had it from the chain page and a search excerpt of the location page.'),
}
# The researchers' own "closed / moved" calls, with the source the check found (reason unchanged unless noted).
NOT_CLOSED = {
    'Curio Brewing Company': ('closed / moved', 'https://curiobrewing.com/',
        "the brewery's site: \"We have closed our Noah Drive location\"; Instagram and Williamson Source: closed July 29, "
        '2026. Google shows "Temporarily closed" (a new location is promised, no address).'),
    'The Tin Roof 2': ('closed / moved', 'https://whatnow.com/?p=445497',
        'WKRN (Oct 9, 2026) and What Now Nashville (Oct 16, 2026): closed, rebranded The Rafters under new owners. '
        'Google "Permanently closed".'),
    'Ludlow & Prime': ('closed / moved', 'https://williamsonsource.com/ludlow-prime-in-brentwood-closes/',
        'Williamson Source (Jan 27, 2025): the Brentwood Place location closed, moving to Berry Farms (Franklin). Google '
        '"Moved to Franklin ... permanently closed"; Big Bad Breakfast opens at the address Nov 5. The Franklin location '
        'was not a lead in this run.'),
    "MAFIAoZA'S Franklin": ('closed / moved', 'https://williamsonsource.com/after-21-years-mafiaoza-s-announces-closure-of-12south-location/',
        'Williamson Source (Sept 26, 2024) says the Factory location closed in 2023 (the article is about 12South, whose '
        'closure the researcher cited). Google "Permanently closed"; the chain site still lists the address.'),
    'Granite City Food & Brewery - Franklin': ('closed / moved', 'https://williamsonsource.com/fire-causes-significant-damage-to-granite-city-food-brewery-in-franklin/',
        'fire, July 5, 2025 (Williamson Source); gcfb.com and Google both say "Temporarily closed", 16 months on. '
        'Temporarily closed, not researched for a happy hour: on refresh-watchlist.md.'),
    'Kokomo Trading Company': ('closed / moved', 'https://kokomotradingco.com',
        'the site and Facebook say "temporarily closed" (undated); Google "Temporarily closed". No closure news. '
        'Temporarily closed, not researched for a happy hour: on refresh-watchlist.md.'),
}
keep = []
for v in d['added']:
    if v['name'] in CLOSED:
        u, why = CLOSED[v['name']]
        d['not_added'].append({'lead': v['lead'], 'reason': 'closed / moved', 'url': u,
                               'detail': 'fix33 closure check: ' + why})
    else:
        keep.append(v)
d['added'] = keep
for n in d['not_added']:
    if n['lead'] in NOT_CLOSED:
        reason, url, why = NOT_CLOSED[n['lead']]
        n.update({'reason': reason, 'url': url, 'detail': 'fix33 closure check: ' + why})
PTS = {'Firebirds Wood Fired Grill': (36.0406354, -86.7706923, '700 Old Hickory Boulevard, 37027 ("700 Old Hickory Blvd, Brentwood" had no hit)',
       '700, Old Hickory Boulevard, Benbar, Nashville, Davidson County, Middle Tennessee, Tennessee, 37027, United States')}
for v in d['added']:
    if v['name'] in PTS and not isinstance(v.get('lat'), (int, float)):
        la, lo, q, dn = PTS[v['name']]
        pt = json.loads(subprocess.run(['node', os.path.join(R, '..', 'v2zone_helper.js'), 'place'], capture_output=True, text=True,
            input=json.dumps({'items': [{'lat': la, 'lon': lo, 'addr_hood_text': None, 'text_hood': v.get('neighborhood')}]})).stdout)[0]
        v['lat'], v['lon'] = la, lo
        v['geocode'] = {'query': q, 'display_name': dn, 'osm_hood': None, 'point_hood': pt['point_hood'],
                        'addr_hood': pt['addr_hood'], 'match': 'house hit by ZIP (point only)', 'by': 'executor fix33 retry'}
        print('%s -> %s (%s); text hood %s (%s)' % (v['name'], pt['point_hood'], pt['point_zone'], pt['addr_hood'], pt['addr_zone']))
json.dump(d, open(p, 'w'), indent=1, ensure_ascii=False)
print('added %d, not added %d' % (len(d['added']), len(d['not_added'])))
