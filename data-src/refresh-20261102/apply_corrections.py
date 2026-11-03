#!/usr/bin/env python3
"""fix29: apply a correction file on top of a zone file, keeping the file chain (hh-radar v2).

Usage: python3 apply_corrections.py <venues file> <corrections JSON> <out file> [--date YYYY-MM-DD]

The corrections JSON is a list. Each entry names a venue by `id` (or by exact `name`, for venues
new in this run), and either:
  - `window_index` + `set` (fields to replace in that window: deals, notes, research_notes,
    confidence, days, start, end) + optional `sources_add` (appended, duplicates skipped); or
  - `add_window` (a whole new window, in the brief's shape).
Every entry may carry `why` (for the report; never written to the data). The venue's `checked`
and each touched window's `last_verified` become the date. The result is validated with logic.js
(v2zone_helper.js validate) and nothing is written on an error. Prints a before/after table.
"""
import json, os, subprocess, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from merge_v2zone import norm_window, helper  # noqa: E402

SETTABLE = {'deals', 'notes', 'research_notes', 'confidence', 'days', 'start', 'end', 'area'}


def label(w):
    return '%s %s-%s' % (','.join(w['days']), w['start'], w['end'])


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]
    date = sys.argv[sys.argv.index('--date') + 1] if '--date' in sys.argv else datetime.date.today().isoformat()
    if '--date' in sys.argv:
        args.remove(date)
    src, corr_path, out = args
    data = json.load(open(src))
    corr = json.load(open(corr_path))
    rows = []
    for c in corr:
        hits = [v for v in data['venues'] if (c.get('id') and v['id'] == c['id']) or (c.get('name') and v['name'] == c['name'])]
        if len(hits) != 1:
            sys.exit('correction %r matches %d venues' % (c.get('id') or c.get('name'), len(hits)))
        v = hits[0]
        if 'add_window' in c:
            w = dict(c['add_window'], last_verified=date)
            v['windows'].append(norm_window(w))
            rows.append((v['id'], v['name'], len(v['windows']) - 1, '(new window)', label(w), len(w.get('deals') or []), c.get('why', '')))
        else:
            w = v['windows'][c['window_index']]
            before = len(w.get('deals') or [])
            bad = set(c.get('set', {})) - SETTABLE
            if bad:
                sys.exit('not settable: %s' % bad)
            w.update(c.get('set', {}))
            have = {s['url'] for s in w.get('sources', [])}
            for s in c.get('sources_add', []):
                if s['url'] not in have:
                    w.setdefault('sources', []).append(s)
                    have.add(s['url'])
            w['last_verified'] = date
            v['windows'][c['window_index']] = norm_window(w)
            rows.append((v['id'], v['name'], c['window_index'], '%d deals' % before, label(w), len(w.get('deals') or []), c.get('why', '')))
        v['checked'] = date
    data['generated'] = date
    tmp = out + '.tmp'
    json.dump(data, open(tmp, 'w'), indent=1, ensure_ascii=False)
    res = helper('validate', {'path': tmp})
    if res['errors']:
        os.remove(tmp)
        sys.exit('validate failed, nothing written:\n  ' + '\n  '.join(res['errors'][:40]))
    os.replace(tmp, out)
    for r in rows:
        print('%s | %s | w%s | before %s | %s | after %d deals | %s' % r)
    print('lint warnings: %d' % len(res['warnings']))


if __name__ == '__main__':
    main()
