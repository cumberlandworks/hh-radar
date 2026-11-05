#!/usr/bin/env python3
"""fix29: apply a correction file on top of a zone file, keeping the file chain (hh-radar v2).

Usage: python3 apply_corrections.py <venues file> <corrections JSON> <out file> [--date YYYY-MM-DD]

The corrections JSON is a list. Each entry names a venue by `id` (or by exact `name`, for venues
new in this run), and either:
  - `window_index` + `set` (fields to replace in that window: deals, notes, research_notes,
    confidence, days, start, end) + optional `sources_add` (appended, duplicates skipped); or
  - `add_window` (a whole new window, in the brief's shape).
  - `remove` (fix32): take the venue out (a confirmed closure, or the all-day rule leaving a non-inKind venue
    with no happy hour). Needs `reason` and `url`; printed for the report, and the coverage text's non-inKind
    count is updated.
    fix33: every removal is also appended to the zone's `not-added-<zone>.md` (in this folder), under
    "## Removed after the merge", with its reason, date, URL and why. A venue already listed there (by id)
    is not added again, so re-running the chain does not duplicate it.
  - `temp_closed` (fix35): a closure to add to the venue, {from, to?, note, source, seen?}. With no `to` it is
    open-ended (no posted reopening date), and `seen` (YYYY-MM-DD, the date on the source) is required. The
    venue's windows stay, per the closure rule in RUNBOOK-v2zone.md; put the venue on the watchlist too.
  - `annotate: true` (fix35) with `window_index` + `set`: an edit that isn't a re-check (a reason line, a posted week).
    The window's `last_verified` and the venue's `checked` keep their dates.
  - `venue_set` (fix35): venue fields to replace (official_site, inkind_url, notes, hours, hours_source,
    hours_confidence). Goes with `window_index` + `set`, or stands alone.
  - `remove_window` (fix35): a window index to drop, with `reason`.
fix32: `kind` is settable (TJ's all-day rule: an everyday menu the venue itself calls "all day" is a `special`).
Every entry may carry `why` (for the report; never written to the data). The venue's `checked`
and each touched window's `last_verified` become the date. The result is validated with logic.js
(v2zone_helper.js validate) and nothing is written on an error. Prints a before/after table.
"""
import json, os, subprocess, sys, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from merge_v2zone import norm_window, helper  # noqa: E402

SETTABLE = {'deals', 'notes', 'research_notes', 'confidence', 'days', 'start', 'end', 'area', 'kind', 'sources',
            'last_verified', 'corroborated', 'posted_week', 'verify_reason'}
VENUE_SETTABLE = {'official_site', 'inkind_url', 'notes', 'hours', 'hours_source', 'hours_confidence', 'hours_notes'}
import re  # noqa: E402


REMOVED_HEAD = '## Removed after the merge (correction files)'


def record_removal(zone, v, c, date, folder=HERE):
    """fix33: append a removal to not-added-<zone>.md, once per venue id. Returns the file path."""
    path = os.path.join(folder, 'not-added-%s.md' % zone)
    text = open(path).read() if os.path.exists(path) else '# Not added: %s\n' % zone
    if '(`%s`)' % v['id'] in text.split(REMOVED_HEAD, 1)[-1] and REMOVED_HEAD in text:
        return path
    why = (' ' + c['why']) if c.get('why') else ''
    line = '- %s (`%s`) = %s, removed %s.%s — %s\n' % (v['name'], v['id'], c['reason'], date, why, c['url'])
    if REMOVED_HEAD not in text:
        text = text.rstrip('\n') + '\n\n' + REMOVED_HEAD + '\n' + \
            'Added by an earlier zone run, then taken out by a later `-corr` file (apply_corrections.py).\n'
    text = text.rstrip('\n') + '\n' + line
    open(path, 'w').write(text)
    return path


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
    removed = []
    for c in corr:
        hits = [v for v in data['venues'] if (c.get('id') and v['id'] == c['id']) or (c.get('name') and v['name'] == c['name'])]
        if len(hits) != 1:
            sys.exit('correction %r matches %d venues' % (c.get('id') or c.get('name'), len(hits)))
        v = hits[0]
        if c.get('remove'):
            if not (c.get('reason') and c.get('url')):
                sys.exit('remove %s needs reason and url' % v['id'])
            data['venues'].remove(v)
            removed.append((v, c))
            rows.append((v['id'], v['name'], '-', 'REMOVED', c['reason'], 0, c.get('why', '') + ' ' + c['url']))
            continue
        if 'temp_closed' in c:
            tc = c['temp_closed']
            v.setdefault('temp_closed', []).append(tc)
            rows.append((v['id'], v['name'], '-', 'temp_closed', '%s to %s' % (tc.get('from'), tc.get('to', 'open-ended')), 0, c.get('why', '')))
            v['checked'] = date
            continue
        if 'venue_set' in c:
            bad = set(c['venue_set']) - VENUE_SETTABLE
            if bad:
                sys.exit('not settable on a venue: %s' % bad)
            v.update(c['venue_set'])
            rows.append((v['id'], v['name'], '-', 'venue fields', ','.join(sorted(c['venue_set'])), 0, c.get('why', '')))
            if 'window_index' not in c and 'add_window' not in c and 'remove_window' not in c:
                v['checked'] = date
                continue
        if 'remove_window' in c:
            if not c.get('reason'):
                sys.exit('remove_window %s needs reason' % v['id'])
            gone = v['windows'].pop(c['remove_window'])
            rows.append((v['id'], v['name'], c['remove_window'], 'window removed', label(gone), 0, c['reason']))
            v['checked'] = date
            continue
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
            have = {s['url'] if isinstance(s, dict) else s for s in w.get('sources', [])}  # inKind sources are plain URLs
            for s in c.get('sources_add', []):
                if s['url'] not in have:
                    w.setdefault('sources', []).append(s)
                    have.add(s['url'])
            if not c.get('annotate') and 'last_verified' not in c.get('set', {}):
                w['last_verified'] = date
            v['windows'][c['window_index']] = norm_window(w)
            for k in ('area', 'last_verified'):  # fix35: a null stays a null rather than losing its key
                if k in w and w[k] is None:
                    v['windows'][c['window_index']][k] = None
            rows.append((v['id'], v['name'], c['window_index'], '%d deals' % before, label(w), len(w.get('deals') or []), c.get('why', '')))
        if not c.get('annotate'):
            v['checked'] = date
    data['generated'] = date
    cov = data.get('coverage')
    if isinstance(cov, dict):
        n_nv = sum(1 for v in data['venues'] if not v['inkind'])
        cov['text'] = re.sub(r'v2: \d+ non-inKind venues', 'v2: %d non-inKind venues' % n_nv, cov['text'])
    tmp = out + '.tmp'
    json.dump(data, open(tmp, 'w'), indent=1, ensure_ascii=False)
    res = helper('validate', {'path': tmp})
    if res['errors']:
        os.remove(tmp)
        sys.exit('validate failed, nothing written:\n  ' + '\n  '.join(res['errors'][:40]))
    os.replace(tmp, out)
    for v, c in removed:
        print('not-added: %s' % record_removal(v['zone'], v, c, date))
    for r in rows:
        print('%s | %s | w%s | before %s | %s | after %s deals | %s' % r)
    print('lint warnings: %d' % len(res['warnings']))


if __name__ == '__main__':
    main()
