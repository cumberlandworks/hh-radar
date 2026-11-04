#!/usr/bin/env python3
"""fix27 D5: merge one zone run's researched venues into venues.json (hh-radar v2).

Usage: python3 merge_v2zone.py <current venues.json> <zone> <geocoded research JSON> [--date YYYY-MM-DD] [--suffix b]
       [--addendum]   (fix28: a late lead for a zone already done; needs --suffix, writes not-added-<zone>-<suffix>.md)

The research JSON is the subagents' {added, not_added} (BRIEF-v2zone.md shape), combined, after
geocode_v2zone.py (and the D3 hours pass) have filled lat/lon. It:
  - assigns ids (logic.js nvIdFor), hood (the hand-set `hood` if present, else the geocoded point's
    nearest hood) and zone (zoneOf(hood));
  - dedupes against everything already in the file (logic.js nvDuplicateOf: the same name within 0.15 mi, or
    the same street with a similar name (v2.0.1); and the id);
  - validates the result with logic.js validateVenues and refuses to write on any error;
  - writes venues-v2-<NN>-<zone>.json next to this script (NN = zone run order; --suffix b writes
    venues-v2-<NN>-<zone>-b.json, for a re-merge that keeps the original);
  - appends the zone to coverage.v2_zones_done, updates generated and the coverage text;
  - writes not-added-<zone>.md: every lead not added, with its reason.
fix29: a new venue whose point falls outside its zone's map polygon is a WARNING, not a failure: it is
printed and listed in the not-added file's "map seam" section, so it can be settled (a MAP_SEAM_EXCEPTIONS
line in tests/windows.test.js, or a corrected point) before the tests run.
fix32: notes mentioning "image" or "no extractable text" are printed as WARNINGs (research_warnings), not
refused: the executor opens each and records what it shows.
A venue whose own address puts it in another core zone is still added, in that zone, and listed
in the not-added file's "placed elsewhere" section; one in an outer suburb is not added.
"""
import json, os, subprocess, sys, datetime, collections

HERE = os.path.dirname(os.path.abspath(__file__))
ORDER = {'downtown': 1, 'gulch': 2, 'east': 3, 'north': 4, 'south': 5, 'west': 6, 'franklin': 7}
ZONE_LABEL = {'downtown': 'Downtown', 'gulch': 'Gulch & Midtown', 'north': 'Germantown & North', 'east': 'East',
              'south': 'South', 'west': 'West', 'franklin': 'Franklin & Brentwood'}
KEY_ORDER = ['id', 'name', 'city', 'neighborhood', 'hood', 'zone', 'address', 'zip', 'lat', 'lon', 'tz', 'inkind',
             'official_site', 'status', 'hours', 'hours_confidence', 'hours_source', 'hours_notes', 'windows',
             'verified_no_hh', 'checked', 'notes']
WIN_KEYS = ['days', 'start', 'end', 'area', 'kind', 'deals', 'sources', 'last_verified', 'corroborated',
            'confidence', 'notes', 'research_notes']


WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']


def norm_window(w):
    """The window's keys in the file's order; days in week order (a brief may list SUN first)."""
    out = {k: w[k] for k in WIN_KEYS if k in w and w[k] is not None}
    out['days'] = sorted(set(out['days']), key=WEEK.index)
    return out


# fix31 (from the fix30 notes): research the merge refuses until the executor fixes it.
import re  # noqa: E402
UNOPENED = re.compile(r"\bnot (been )?(opened|read)\b|\b(could ?n[o']t|cannot|can ?not|unable to|did ?n[o']t|failed to)"
                      r" (be )?(open|read)\b|\bnot readable\b|\bunopened\b", re.I)
# A venue site that "didn't load" (brief step 8) is not a linked menu, so "load" is not matched.


def research_problems(research):
    """Every unopened linked menu/PDF/link note and every 24:00-or-later time in the run's own research.
    Midnight is "00:00"; the 13 24:00 ends already in venues.json predate this rule and are not checked."""
    probs = []
    for c in research.get('added', []):
        name = c.get('name') or c.get('lead')
        texts = [('notes', c.get('notes')), ('hours_notes', c.get('hours_notes'))]
        for i, w in enumerate(c.get('windows', [])):
            texts += [('windows[%d].notes' % i, w.get('notes')), ('windows[%d].research_notes' % i, w.get('research_notes'))]
            for k in ('start', 'end'):
                t = w.get(k)
                if isinstance(t, str) and re.match(r'^\d\d:\d\d$', t) and int(t[:2]) >= 24:
                    probs.append('%s: windows[%d].%s is %s (midnight is 00:00; past it, 01:00...)' % (name, i, k, t))
        for d, rs in (c.get('hours') or {}).items():
            for r in rs:
                for t in r:
                    if isinstance(t, str) and re.match(r'^\d\d:\d\d$', t) and int(t[:2]) >= 24:
                        probs.append('%s: hours %s has %s (midnight is 00:00)' % (name, d, t))
        for where, t in texts:
            m = t and UNOPENED.search(t)
            if m:
                probs.append('%s: %s says "%s": open the menu/PDF/link (pdf2txt.swift, a sips render, or the '
                             'Chrome agent), record what it shows, then re-run' % (name, where, m.group(0)))
    return probs


# fix32 (fix31 note 3): an image menu ("image", "no extractable text") is a WARNING, not a refusal: the executor
# opens each one (download it and read it, or the Chrome agent) and records what it shows. Harmless wording also
# matches, which is why it only warns.
IMAGE_MENU = re.compile(r"\bimages?\b|\bno extractable text\b|\bno text layer\b", re.I)


def research_warnings(research):
    """Notes that mention an image or no extractable text: printed for the executor to open, never fatal."""
    warns = []
    for c in research.get('added', []):
        name = c.get('name') or c.get('lead')
        texts = [('notes', c.get('notes')), ('hours_notes', c.get('hours_notes'))]
        for i, w in enumerate(c.get('windows', [])):
            texts += [('windows[%d].notes' % i, w.get('notes')), ('windows[%d].research_notes' % i, w.get('research_notes'))]
        for where, t in texts:
            m = t and IMAGE_MENU.search(t)
            if m:
                warns.append('%s: %s mentions "%s": open it and record what it shows' % (name, where, m.group(0)))
    return warns


def helper(cmd, payload):
    r = subprocess.run(['node', os.path.join(HERE, 'v2zone_helper.js'), cmd], input=json.dumps(payload),
                       capture_output=True, text=True)
    if r.returncode:
        sys.exit('v2zone_helper %s failed: %s' % (cmd, r.stderr))
    return json.loads(r.stdout)


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    date = sys.argv[sys.argv.index('--date') + 1] if '--date' in sys.argv else datetime.date.today().isoformat()
    if '--date' in sys.argv:
        args.remove(date)
    suffix = sys.argv[sys.argv.index('--suffix') + 1] if '--suffix' in sys.argv else ''
    if suffix:
        args.remove(suffix)
    addendum = '--addendum' in sys.argv
    if addendum and not suffix:
        sys.exit('--addendum needs --suffix, so the zone file and its not-added file are kept')
    venues_path, zone, research_path = args
    if zone not in ORDER:
        sys.exit('zone must be one of ' + ', '.join(ORDER))
    data = json.load(open(venues_path))
    research = json.load(open(research_path))
    probs = research_problems(research)
    if probs:
        sys.exit('merge refused (fix31 checks):\n  ' + '\n  '.join(probs))
    warns = research_warnings(research)
    for w_ in warns:
        print('WARNING image menu: ' + w_, file=sys.stderr)

    cov = data.get('coverage')
    if not isinstance(cov, dict):
        cov = {'text': cov or '', 'v2_zones_done': []}
    if zone in cov['v2_zones_done'] and not addendum:
        sys.exit('%s is already in coverage.v2_zones_done; nothing to do' % zone)

    not_added = [dict(n) for n in research.get('not_added', [])]
    elsewhere = []
    existing = data['venues']
    added = []
    cands = research['added']
    ids = helper('ids', {'items': [{'name': c['name'], 'address': c['address']} for c in cands]})
    placed = helper('place', {'items': [{'lat': c.get('lat'), 'lon': c.get('lon'),
                                         'addr_hood_text': None, 'text_hood': None} for c in cands]})
    for c, vid, p in zip(cands, ids, placed):
        lead = c.get('lead') or c['name']
        if not isinstance(c.get('lat'), (int, float)):
            not_added.append({'lead': lead, 'reason': 'no geocode (address not found)', 'url': c.get('official_site')})
            continue
        hood = c.get('hood') or p['point_hood']
        vzone = helper('place', {'items': [{'lat': None, 'lon': None, 'addr_hood_text': hood, 'text_hood': None}]})[0]['addr_zone']
        if vzone == 'outer' or vzone is None:
            not_added.append({'lead': lead, 'reason': 'outside Nashville core zones', 'url': c.get('official_site')})
            continue
        v = {
            'id': vid, 'name': c['name'], 'city': c.get('city') or 'Nashville', 'neighborhood': c.get('neighborhood') or hood,
            'hood': hood, 'zone': vzone, 'address': c['address'].split(',')[0].strip(), 'zip': c['zip'],
            'lat': c['lat'], 'lon': c['lon'], 'tz': 'America/Chicago', 'inkind': False,
            'official_site': c['official_site'], 'status': 'open', 'hours': c.get('hours') or {},
            'hours_confidence': c.get('hours_confidence') or 'low', 'hours_source': c.get('hours_source') or ('none found ' + date),
            'hours_notes': c.get('hours_notes'),
            'windows': [norm_window(w) for w in c['windows']],
            'verified_no_hh': False, 'checked': date, 'notes': c.get('notes'),
        }
        v = {k: v[k] for k in KEY_ORDER if v.get(k) is not None}
        dup = helper('dup', {'venue': v, 'others': existing + added})
        if dup or any(o['id'] == vid for o in existing + added):
            d = dup or next(o for o in existing + added if o['id'] == vid)
            not_added.append({'lead': lead, 'reason': 'duplicate of a venue already listed', 'url': c.get('official_site'),
                              'detail': '%s (%s), same %s' % (d['id'], d['name'], d.get('by', 'id'))})
            continue
        if vzone != zone:
            elsewhere.append((v['name'], vzone, hood))
        added.append(v)

    seam = []
    if added:
        poly = helper('polygon', {'items': [{'lat': v['lat'], 'lon': v['lon'], 'hood': v['hood']} for v in added]})
        for v, pg in zip(added, poly):
            if pg['checked'] and not pg['inside']:
                seam.append((v['id'], v['name'], v['address'], v['hood'], pg['zone'], ', '.join(pg['in_zones']) or 'none'))
                print('WARNING map seam: %s (%s, %s) is %s / %s, but its point is outside that zone polygon (inside: %s)'
                      % (v['name'], v['id'], v['address'], v['hood'], pg['zone'], ', '.join(pg['in_zones']) or 'none'),
                      file=sys.stderr)

    data['venues'] = sorted(existing + added, key=lambda v: v['name'].lower())
    cov['v2_zones_done'] = [z for z in ORDER if z in cov['v2_zones_done'] or z == zone]
    n_ik = sum(1 for v in data['venues'] if v['inkind'])
    n_nv = len(data['venues']) - n_ik
    base = cov['text'].split(' | v2: ')[0]
    # fix31: "zone runs from" keeps the first zone run's date (fix30's file said 2026-11-03; fix31's merge had moved it).
    prev = re.search(r'\(zone runs from (\d{4}-\d\d-\d\d)\)', cov['text'])
    since = prev.group(1) if prev else date
    cov['text'] = base + ' | v2: %d non-inKind venues with a happy hour, trust-bar checked, in %s (zone runs from %s)' % (
        n_nv, ', '.join(ZONE_LABEL[z] for z in cov['v2_zones_done']), since)
    data['coverage'] = cov
    data['generated'] = date
    data['generator'] = 'merge_v2zone.py (hh-radar v2 zone runs, refresh-20261102)'

    out = os.path.join(HERE, 'venues-v2-%02d-%s%s.json' % (ORDER[zone], zone, '-' + suffix if suffix else ''))
    tmp = out + '.tmp'
    json.dump(data, open(tmp, 'w'), indent=1, ensure_ascii=False)
    res = helper('validate', {'path': tmp})
    if res['errors']:
        os.remove(tmp)
        sys.exit('validate failed, nothing written:\n  ' + '\n  '.join(res['errors'][:40]))
    os.replace(tmp, out)

    by_reason = collections.defaultdict(list)
    for n in not_added:
        by_reason[n['reason']].append(n)
    lines = ['# Not added: %s (v2 zone run, %s)' % (ZONE_LABEL[zone], date), '',
             '%d added, %d not added. Every lead not added, by reason.' % (len(added), len(not_added)), '']
    for reason in sorted(by_reason, key=lambda r: (-len(by_reason[r]), r)):
        lines.append('## %s (%d)' % (reason, len(by_reason[reason])))
        for n in sorted(by_reason[reason], key=lambda n: n['lead'].lower()):
            lines.append('- %s%s%s' % (n['lead'], (' = ' + n['detail']) if n.get('detail') else '',
                                       (' — ' + n['url']) if n.get('url') else ''))
        lines.append('')
    if elsewhere:
        lines += ['## Added, but placed in another zone by their own address (%d)' % len(elsewhere)]
        lines += ['- %s → %s (%s)' % e for e in elsewhere] + ['']
    if seam:
        lines += ['## Map seam warnings: added, but the point is outside its zone polygon (%d)' % len(seam),
                  'Settle each before the tests: a MAP_SEAM_EXCEPTIONS line in tests/windows.test.js, or a corrected point.']
        lines += ['- %s (`%s`), %s: %s / %s; the point is inside: %s' % s_ for s_ in seam] + ['']
    open(os.path.join(HERE, 'not-added-%s%s.md' % (zone, '-' + suffix if addendum else '')), 'w').write('\n'.join(lines))

    print(json.dumps({'out': out, 'added': len(added), 'not_added': len(not_added),
                      'not_added_by_reason': {r: len(v) for r, v in by_reason.items()},
                      'placed_elsewhere': elsewhere, 'map_seam_warnings': [x[1] for x in seam], 'venues': len(data['venues']), 'inkind': n_ik, 'non_inkind': n_nv,
                      'windows': sum(len(v['windows']) for v in data['venues']), 'lint_warnings': len(res['warnings']),
                      'image_menu_warnings': len(warns)}))


if __name__ == '__main__':
    main()
