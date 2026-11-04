#!/usr/bin/env python3
"""fix27 D4: geocode a zone run's new venues with OpenStreetMap Nominatim.

Usage: python3 geocode_v2zone.py <research JSON {added, not_added}> <out JSON>

curl from the Mac, 1 request per second, User-Agent hh-radar-build/2.0. Adds to each added venue
`lat`, `lon` and `geocode` {query, display_name, osm_hood, point_hood, addr_hood, match}. The
point's hood is logic.js's nearestNeighborhood; the address's hood is the OSM neighbourhood /
suburb (else the venue's neighborhood text) through hood_zone.js. A zone mismatch, or no hit,
is printed for the report (fix32: after a retry with the street suffix spelled out,
Dr -> Drive, Ave -> Avenue, Pk -> Pike) and must be settled by hand (set `hood`, or `lat`/`lon` from the
official site's map link) before merge_v2zone.py runs. Coordinates are never guessed.
"""
import json, os, re, subprocess, sys, time, urllib.parse

HERE = os.path.dirname(os.path.abspath(__file__))
UA = 'hh-radar-build/2.0'


def nominatim(params):
    q = urllib.parse.urlencode(dict(params, format='jsonv2', addressdetails=1, limit=1, countrycodes='us'))
    url = 'https://nominatim.openstreetmap.org/search?' + q
    r = subprocess.run(['curl', '-s', '--max-time', '20', '-A', UA, url], capture_output=True, text=True)
    time.sleep(1.1)
    try:
        hits = json.loads(r.stdout or '[]')
    except ValueError:
        hits = []
    return hits[0] if hits else None


# fix32: street suffixes spelled out for the retry (Dr -> Drive, Ave -> Avenue, Pk -> Pike, ...).
SUFFIX = {'dr': 'Drive', 'ave': 'Avenue', 'av': 'Avenue', 'pk': 'Pike', 'pke': 'Pike', 'st': 'Street', 'rd': 'Road',
          'blvd': 'Boulevard', 'ln': 'Lane', 'ct': 'Court', 'pl': 'Place', 'cir': 'Circle', 'hwy': 'Highway',
          'pkwy': 'Parkway', 'ter': 'Terrace', 'trl': 'Trail', 'sq': 'Square', 'aly': 'Alley', 'xing': 'Crossing'}


def spell_out_suffix(street):
    """'2159 Green Hills Village Dr' -> '2159 Green Hills Village Drive'; '343 53rd Ave. N' -> '343 53rd Avenue N'.
    Only the street's last suffix word is spelled out (a trailing N/S/E/W is skipped), so 'St Clair St' keeps
    its first 'St'. A trailing period is dropped."""
    w = street.split()
    i = len(w) - 1
    if i > 1 and w[i].rstrip('.').upper() in ('N', 'S', 'E', 'W', 'NE', 'NW', 'SE', 'SW'):
        i -= 1
    if i > 1 and w[i].rstrip('.').lower() in SUFFIX:
        w[i] = SUFFIX[w[i].rstrip('.').lower()]
    return ' '.join(w)


def helper(cmd, payload):
    r = subprocess.run(['node', os.path.join(HERE, 'v2zone_helper.js'), cmd], input=json.dumps(payload),
                       capture_output=True, text=True, check=True)
    return json.loads(r.stdout)


def main():
    src, out = sys.argv[1], sys.argv[2]
    data = json.load(open(src))
    report = []
    for v in data['added']:
        if isinstance(v.get('lat'), (int, float)) and v.get('geocode', {}).get('manual'):
            continue  # set by hand from the official site's map link
        street = re.sub(r'\s*(#|\b(suite|ste|unit)\b\.?)\s*\S+$', '', v['address'].split(',')[0].strip(), flags=re.I)
        hit = nominatim({'street': street, 'city': v.get('city') or 'Nashville', 'state': 'TN', 'postalcode': v.get('zip', '')})
        query = street
        if not hit:
            hit = nominatim({'q': '%s, %s, TN %s' % (street, v.get('city') or 'Nashville', v.get('zip', ''))})
        long_street = spell_out_suffix(street)
        if not hit and long_street != street:
            # fix32 (fix31 note): Nominatim misses some abbreviated suffixes ("Green Hills Village Dr"); retry spelled out.
            query = long_street
            hit = nominatim({'street': long_street, 'city': v.get('city') or 'Nashville', 'state': 'TN', 'postalcode': v.get('zip', '')})
            if not hit:
                hit = nominatim({'q': '%s, %s, TN %s' % (long_street, v.get('city') or 'Nashville', v.get('zip', ''))})
        if not hit:
            v['geocode'] = {'query': query, 'match': 'no hit'}
            report.append((v['name'], v['address'], 'NO HIT'))
            continue
        a = hit.get('address', {})
        v['lat'], v['lon'] = round(float(hit['lat']), 7), round(float(hit['lon']), 7)
        v['geocode'] = {'query': query, 'display_name': hit.get('display_name'),
                        'osm_hood': a.get('neighbourhood') or a.get('suburb') or a.get('quarter')}
    todo = [v for v in data['added'] if isinstance(v.get('lat'), (int, float))]
    placed = helper('place', {'items': [{'lat': v['lat'], 'lon': v['lon'], 'addr_hood_text': v['geocode'].get('osm_hood'),
                                         'text_hood': v.get('neighborhood')} for v in todo]})
    for v, p in zip(todo, placed):
        g = v['geocode']
        g['point_hood'], g['addr_hood'] = p['point_hood'], p['addr_hood']
        if p['addr_zone'] is None:
            g['match'] = 'no address hood (point only)'
        elif p['addr_zone'] == p['point_zone']:
            g['match'] = 'ok'
        else:
            g['match'] = 'MISMATCH'
            report.append((v['name'], v['address'], 'point %s (%s) vs address %s (%s), OSM "%s"' % (
                p['point_hood'], p['point_zone'], p['addr_hood'], p['addr_zone'], g.get('osm_hood'))))
    json.dump(data, open(out, 'w'), indent=1, ensure_ascii=False)
    print('geocoded %d of %d' % (len(todo), len(data['added'])))
    for r in report:
        print(' ! %s | %s | %s' % r)


if __name__ == '__main__':
    main()
