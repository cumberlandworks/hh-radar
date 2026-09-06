'use strict';
// Pure-function tests for logic.js. Every "now" is an injected dateInTz fixture —
// {year, month, day, hour, minute, dayOfWeek} — never new Date(). This is deliberate:
// a clock-dependent fixture rots the day it's written (the calendar time-bomb lesson).
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveWindow, isActive, startsWithin, nextStart, nextStartAcrossVenues,
  isStale, windowWarnings, isAllDay, nearestNeighborhood, bestSourceUrl,
  ZONES, hoodKeys, zoneOf, isCoreHood, applyHoodFilter,
  serializeHoodSelection, deserializeHoodSelection,
  projectLatLon, polygonArea, pointInPolygon, voronoiCells,
  CORE_MAP_BBOX, coreHoodCentroids,
} = require('../logic.js');
const path = require('node:path');

function dt(dayOfWeek, hour, minute, ymd) {
  ymd = ymd || { year: 2026, month: 9, day: 8 }; // an arbitrary Tuesday; irrelevant to wall-clock math
  return Object.assign({ dayOfWeek, hour, minute }, ymd);
}

function venue(hours, windows) {
  return { tz: 'America/Chicago', hours: hours || {}, windows: windows || [] };
}
function win(days, start, end, extra) {
  return Object.assign({ days, start, end, area: null, kind: 'happy_hour', deals: [], sources: ['https://example.com'], last_verified: '2026-09-05', corroborated: true, confidence: 'high', notes: '' }, extra);
}

// ---- simple same-day window ----
test('same-day window: before / at start / inside / at end (excluded)', () => {
  const w = win(['WED'], '16:00', '18:00');
  const v = venue({}, [w]);
  assert.equal(isActive(v, w, dt('WED', 15, 59)), false, 'before start');
  assert.equal(isActive(v, w, dt('WED', 16, 0)), true, 'at start (inclusive)');
  assert.equal(isActive(v, w, dt('WED', 17, 0)), true, 'inside');
  assert.equal(isActive(v, w, dt('WED', 18, 0)), false, 'at end (exclusive)');
});

// ---- midnight-crossing numeric window ----
test('midnight-crossing numeric window FRI 22:00-02:00', () => {
  const w = win(['FRI'], '22:00', '02:00');
  const v = venue({}, [w]);
  assert.equal(isActive(v, w, dt('FRI', 23, 30)), true, '23:30 FRI active');
  assert.equal(isActive(v, w, dt('SAT', 1, 30)), true, '01:30 SAT active (attributed to FRI window)');
  assert.equal(isActive(v, w, dt('SAT', 2, 0)), false, '02:00 SAT inactive (end exclusive)');
  assert.equal(startsWithin(v, w, dt('FRI', 21, 0)), true, '21:00 FRI = starting soon (within 120min of 22:00)');
});

// ---- "close" resolution ----
test('"close" resolves same-day when last close > start (Punk Wok style)', () => {
  const hours = { SAT: [['11:00', '23:00']] };
  const w = win(['SAT'], '21:00', 'close');
  const v = venue(hours, [w]);
  const intervals = resolveWindow(v, w);
  assert.equal(intervals[0].endAbs - intervals[0].startAbs, 120, 'close(23:00) - start(21:00) = 2h, same day');
  assert.equal(isActive(v, w, dt('SAT', 22, 30)), true);
  assert.equal(isActive(v, w, dt('SAT', 23, 0)), false);
});

test('"close" resolves next-day when the closing time is <= window start (e.g. 00:00, 03:00)', () => {
  const hours = { FRI: [['11:00', '03:00']] }; // venue's own late close, numerically 03:00
  const w = win(['FRI'], '17:00', 'close');
  const v = venue(hours, [w]);
  const intervals = resolveWindow(v, w);
  // start FRI 17:00 = 4*1440+1020; close 03:00 <= 17:00 so it rolls to FRI+1 (=SAT) 03:00
  assert.equal(isActive(v, w, dt('SAT', 2, 30)), true, 'still active 02:30 SAT (next-day close)');
  assert.equal(isActive(v, w, dt('SAT', 3, 0)), false, 'closed at 03:00 SAT');
  assert.equal(intervals[0].warnings.includes('missing-hours-fallback-2359'), false);
});

test('"close" with missing hours[D] falls back to 23:59 and raises a warning', () => {
  const w = win(['MON'], '20:00', 'close');
  const v = venue({}, [w]); // no MON entry in hours at all
  const intervals = resolveWindow(v, w);
  assert.equal(intervals[0].endAbs - intervals[0].startAbs, 3 * 60 + 59, '20:00 to 23:59 fallback');
  assert.ok(windowWarnings(v, w).includes('missing-hours-fallback-2359'));
  assert.ok(windowWarnings(v, w).includes('closed-day-per-hours'));
});

// ---- window on a day the venue is closed per hours (data wins, but flagged) ----
test('window on a day hours say closed is still evaluated, but flagged (City Winery MON case)', () => {
  const hours = { TUE: [['16:00', '18:00']] }; // MON absent = closed per hours
  const w = win(['MON'], '16:00', '18:00');
  const v = venue(hours, [w]);
  assert.equal(isActive(v, w, dt('MON', 17, 0)), true, 'data wins: window still evaluated active');
  assert.ok(windowWarnings(v, w).includes('closed-day-per-hours'));
});

// ---- starting-soon across midnight + the 120-minute boundary ----
test('starting-soon across midnight: now SAT 23:00, window SUN 00:30', () => {
  const w = win(['SUN'], '00:30', '02:00');
  const v = venue({}, [w]);
  assert.equal(startsWithin(v, w, dt('SAT', 23, 0)), true, '90 min out, within 120');
});

test('120-minute starting-soon boundary: exactly 120 = soon, 121 = not', () => {
  const w = win(['WED'], '18:00', '20:00');
  const v = venue({}, [w]);
  assert.equal(startsWithin(v, w, dt('WED', 16, 0)), true, 'exactly 120 minutes out');
  assert.equal(startsWithin(v, w, dt('WED', 15, 59)), false, '121 minutes out');
});

// ---- stale boundary ----
test('stale boundary: 60 days = not stale, 61 = stale, null = stale', () => {
  const today = { year: 2026, month: 9, day: 8 };
  // 2026-09-08 minus 60 days = 2026-07-10; minus 61 days = 2026-07-09
  assert.equal(isStale('2026-07-10', today), false, 'exactly 60 days ago: not stale');
  assert.equal(isStale('2026-07-09', today), true, '61 days ago: stale');
  assert.equal(isStale(null, today), true, 'null: stale');
});

// ---- DST ----
// resolveWindow/isActive never touch a real Date/epoch — every calculation is done in
// venue-wall-clock minutes-since-week-start, injected by the caller. That is a deliberate
// choice: a window is defined as a wall-clock span ("16:00-18:00"), not an elapsed
// duration, so DST transitions in the real world (handled by Intl.DateTimeFormat before
// this code ever sees "now") cannot change what these functions compute. These tests
// exercise the DST transition dates to document — not just assert by omission — that
// choice.
test('DST spring-forward (2026-03-08): 16:00-18:00 window is exactly 2h of wall clock', () => {
  const w = win(['SUN'], '16:00', '18:00');
  const v = venue({}, [w]);
  const springForward = { year: 2026, month: 3, day: 8 };
  const intervals = resolveWindow(v, w);
  assert.equal(intervals[0].endAbs - intervals[0].startAbs, 120);
  assert.equal(isActive(v, w, dt('SUN', 16, 0, springForward)), true);
  assert.equal(isActive(v, w, dt('SUN', 18, 0, springForward)), false);
});

test('DST fall-back (2026-11-01): 01:00-03:00 window documents wall-clock (not elapsed) behavior', () => {
  // In real elapsed time, 1am-3am on fall-back day contains a repeated hour (3 real
  // hours of clock time). This suite's model deliberately ignores that: the window is
  // "01:00 to 03:00 on the wall clock", always exactly 120 minutes in this model,
  // matching what a person reads off a clock face rather than a stopwatch.
  const w = win(['SUN'], '01:00', '03:00');
  const v = venue({}, [w]);
  const fallBack = { year: 2026, month: 11, day: 1 };
  const intervals = resolveWindow(v, w);
  assert.equal(intervals[0].endAbs - intervals[0].startAbs, 120, 'documented: wall-clock span, not elapsed real time');
  assert.equal(isActive(v, w, dt('SUN', 2, 0, fallBack)), true);
  assert.equal(isActive(v, w, dt('SUN', 3, 0, fallBack)), false);
});

// ---- NOW-view empty-state nextStart across all venues, including one starting tomorrow ----
test('nextStartAcrossVenues picks the earliest future start across ALL venues, including tomorrow', () => {
  // alreadyPassedToday's only WED slot already happened (08:00, now is 10:00) so its
  // next occurrence wraps a full week out — it must NOT win despite being "today".
  const alreadyPassedToday = venue({}, [win(['WED'], '08:00', '09:00')]);
  const tomorrowVenue = venue({}, [win(['THU'], '08:00', '09:00')]); // 46h out — earliest real option
  const laterThisWeek = venue({}, [win(['SAT'], '08:00', '09:00')]); // 94h out
  const venues = [alreadyPassedToday, laterThisWeek, tomorrowVenue];
  const now = dt('WED', 10, 0);
  const best = nextStartAcrossVenues(venues, now);
  assert.equal(best.venue, tomorrowVenue, 'earliest is THU 08:00 (tomorrow), not a same-day slot that already passed');
});

test('nextStart returns null for a venue with no windows (verified_no_hh venue)', () => {
  const v = venue({}, []);
  assert.equal(nextStart(v, dt('WED', 10, 0)), null);
});

// ---- C4 (v1.2): isAllDay is gated on kind === 'special' for BOTH rules ----
test('isAllDay: a long-span happy_hour window (Blue Sushi 11:00-18:30) is NOT all-day', () => {
  const w = win(['TUE'], '11:00', '18:30', { kind: 'happy_hour' }); // 450 min span
  const v = venue({}, [w]);
  assert.equal(isAllDay(v, w), false, 'happy_hour kind is never all-day, however long its span');
});

test('isAllDay: the same long span on a special window IS all-day', () => {
  const w = win(['TUE'], '11:00', '18:30', { kind: 'special' }); // 450 min span
  const v = venue({}, [w]);
  assert.equal(isAllDay(v, w), true, 'special kind with span >= 300 min is all-day');
});

test('isAllDay: resolved span 299 minutes is not all-day, 300 is (special kind, start >= 14:00 so rule (b) cannot fire)', () => {
  const short = win(['WED'], '14:00', '18:59', { kind: 'special' }); // 299 min
  const long = win(['WED'], '14:00', '19:00', { kind: 'special' }); // 300 min
  const v = venue({}, [short, long]);
  assert.equal(isAllDay(v, short), false, '299 minutes: not all-day');
  assert.equal(isAllDay(v, long), true, '300 minutes: all-day');
});

test('isAllDay: kind=special start rule fires at 13:59, not at 14:00 (short span both ways)', () => {
  const before = win(['WED'], '13:59', '15:59', { kind: 'special' }); // 120 min span, start < 14:00
  const at = win(['WED'], '14:00', '16:00', { kind: 'special' }); // 120 min span, start === 14:00
  const v = venue({}, [before, at]);
  assert.equal(isAllDay(v, before), true, '13:59 start: all-day via start rule');
  assert.equal(isAllDay(v, at), false, '14:00 start: not all-day (rule is strictly <14:00, span too short)');
});

test('isAllDay: happy_hour kind at 08:00 with a short span is NOT all-day (start rule is kind-gated)', () => {
  const w = win(['MON'], '08:00', '10:00', { kind: 'happy_hour' }); // 120 min, start < 14:00 but not `special`
  const v = venue({}, [w]);
  assert.equal(isAllDay(v, w), false);
});

test('nextStartAcrossVenues with excludeAllDay skips an 08:00-close all-day special in favour of a real 16:00 happy hour', () => {
  const hours = { WED: [['08:00', '21:00']] };
  const allDaySpecial = venue(hours, [win(['WED'], '08:00', 'close', { kind: 'special' })]); // ~13h span: all-day
  const realHappyHour = venue(hours, [win(['WED'], '16:00', '18:00', { kind: 'happy_hour' })]);
  const now = dt('WED', 3, 0);
  const plain = nextStartAcrossVenues([allDaySpecial, realHappyHour], now);
  assert.equal(plain.venue, allDaySpecial, 'without excludeAllDay, the earlier 08:00 start wins (documents the bug)');
  const filtered = nextStartAcrossVenues([allDaySpecial, realHappyHour], now, { excludeAllDay: true });
  assert.equal(filtered.venue, realHappyHour, 'with excludeAllDay, the all-day special is skipped in favor of the real happy hour');
  assert.equal(filtered.next.window.kind, 'happy_hour');
});

// ---- C1 (v1.2): bestSourceUrl — one test per branch ----
test('bestSourceUrl: prefers the source whose hostname matches official_site (JINYA case)', () => {
  const v = { official_site: 'https://www.jinyaramenbar.com/locations/nashville/', inkind_url: 'https://jinyasoutheastdsiam.inkind.com/' };
  const w = { sources: ['https://www.jinyaramenbar.com/menu/tn/nashville/happy_hour', 'https://nashvilleguru.com/businesses/jinya-ramen-bar'] };
  assert.equal(bestSourceUrl(v, w), 'https://www.jinyaramenbar.com/menu/tn/nashville/happy_hour');
});

test('bestSourceUrl: falls back to sources[0] when no source matches official_site', () => {
  const v = { official_site: 'https://www.example.com/', inkind_url: 'https://x.inkind.com/' };
  const w = { sources: ['https://do615.com/events/weekly/tue/happy-ho', 'https://nashvilleguru.com/x'] };
  assert.equal(bestSourceUrl(v, w), 'https://do615.com/events/weekly/tue/happy-ho');
});

test('bestSourceUrl: falls back to official_site when the window has no sources', () => {
  const v = { official_site: 'https://www.example.com/', inkind_url: 'https://x.inkind.com/' };
  const w = { sources: [] };
  assert.equal(bestSourceUrl(v, w), 'https://www.example.com/');
});

test('bestSourceUrl: falls back to inkind_url when there is no official_site and no sources', () => {
  const v = { official_site: null, inkind_url: 'https://x.inkind.com/' };
  const w = { sources: [] };
  assert.equal(bestSourceUrl(v, w), 'https://x.inkind.com/');
});

// ---- C6: neighborhood nearest-centroid ----
test('nearestNeighborhood pins known coordinates to their neighborhoods', () => {
  assert.equal(nearestNeighborhood(36.1535, -86.7853), 'The Gulch', 'Bar Mar coordinates -> The Gulch');
  assert.equal(nearestNeighborhood(36.1189, -86.7902), '12 South', 'exact 12 South centroid -> 12 South');
});

// ---- ZONE model (v1.3): hoodKeys / zoneOf / isCoreHood ----
test('hoodKeys returns exactly 21 keys in the C3-specified chip order', () => {
  const keys = hoodKeys();
  assert.equal(keys.length, 21);
  assert.deepEqual(keys, [
    'Downtown/SoBro', 'The Gulch', 'Midtown', 'Germantown', 'East Nashville',
    '12 South', 'Wedgewood-Houston', 'Berry Hill', 'Sylvan Park/Charlotte',
    'Belle Meade / West Nashville', 'Bellevue',
    'Brentwood', 'Franklin/Cool Springs', 'Antioch/Hermitage', 'Smyrna',
    'Murfreesboro', 'Mt. Juliet', 'Hendersonville', 'Gallatin', 'Dickson', 'Lewisburg',
  ]);
});

test('ZONES has 8 zones and every hood belongs to exactly one', () => {
  assert.equal(ZONES.length, 8);
  const seen = new Set();
  ZONES.forEach((z) => z.hoods.forEach((h) => {
    assert.equal(seen.has(h), false, h + ' appears in more than one zone');
    seen.add(h);
  }));
  assert.equal(seen.size, 21);
});

test('zoneOf maps every hood to its zone and returns null for an unknown key', () => {
  assert.equal(zoneOf('The Gulch'), 'gulch');
  assert.equal(zoneOf('Dickson'), 'outer');
  assert.equal(zoneOf('Belle Meade / West Nashville'), 'west');
  assert.equal(zoneOf('not-a-real-hood'), null);
});

test('isCoreHood: downtown/gulch/north/east/south/west hoods are core; franklin/outer are not', () => {
  assert.equal(isCoreHood('The Gulch'), true);
  assert.equal(isCoreHood('Bellevue'), true);
  assert.equal(isCoreHood('Franklin/Cool Springs'), false);
  assert.equal(isCoreHood('Dickson'), false);
});

// ---- C2 (v1.3): applyHoodFilter + selection (de)serialization ----
function venueWithHood(hood) { return { id: 'x', hood: hood }; }

test('applyHoodFilter: toggle a hood out removes only that hood\'s venues', () => {
  const venues = [venueWithHood('The Gulch'), venueWithHood('12 South'), venueWithHood('The Gulch')];
  const selected = new Set(hoodKeys());
  selected.delete('The Gulch');
  const result = applyHoodFilter(venues, { selected });
  assert.deepEqual(result, [venueWithHood('12 South')]);
});

test('applyHoodFilter: "All" (every key selected) returns every venue', () => {
  const venues = [venueWithHood('The Gulch'), venueWithHood('Dickson')];
  const result = applyHoodFilter(venues, { selected: new Set(hoodKeys()) });
  assert.equal(result.length, 2);
});

test('applyHoodFilter: "None" (empty Set) returns no venues -- an empty selection is not "unset"', () => {
  const venues = [venueWithHood('The Gulch'), venueWithHood('Dickson')];
  const result = applyHoodFilter(venues, { selected: new Set() });
  assert.deepEqual(result, []);
});

test('deserializeHoodSelection: round-trips a saved selection', () => {
  const original = new Set(['The Gulch', 'Midtown']);
  const raw = JSON.parse(JSON.stringify(serializeHoodSelection(original)));
  const restored = deserializeHoodSelection(raw, hoodKeys());
  assert.deepEqual(Array.from(restored).sort(), ['Midtown', 'The Gulch']);
});

test('deserializeHoodSelection: silently drops unknown keys instead of resetting to all', () => {
  const restored = deserializeHoodSelection(['The Gulch', 'Atlantis', 'Midtown'], hoodKeys());
  assert.deepEqual(Array.from(restored).sort(), ['Midtown', 'The Gulch']);
});

test('deserializeHoodSelection: an empty array is a legitimate "none" state, not reset to all', () => {
  const restored = deserializeHoodSelection([], hoodKeys());
  assert.deepEqual(Array.from(restored), []);
});

test('deserializeHoodSelection: missing/corrupt storage (non-array) returns null so the caller defaults to "all"', () => {
  assert.equal(deserializeHoodSelection(null, hoodKeys()), null);
  assert.equal(deserializeHoodSelection('The Gulch', hoodKeys()), null);
});

// ---- C4 (v1.3): voronoiCells geometry ----
const meanLatRad = (CORE_MAP_BBOX.minLat + CORE_MAP_BBOX.maxLat) / 2 * Math.PI / 180;
const bboxProjected = {
  minX: CORE_MAP_BBOX.minLon * Math.cos(meanLatRad), maxX: CORE_MAP_BBOX.maxLon * Math.cos(meanLatRad),
  minY: CORE_MAP_BBOX.minLat, maxY: CORE_MAP_BBOX.maxLat,
};
function projectedCorePoints() {
  return coreHoodCentroids().map((c) => {
    const [x, y] = projectLatLon(c.lat, c.lon, meanLatRad);
    return { key: c.hood, x, y };
  });
}

test('voronoiCells: each core centroid lies strictly inside its own cell', () => {
  const points = projectedCorePoints();
  const cells = voronoiCells(points, bboxProjected);
  points.forEach((p) => {
    const cell = cells.find((c) => c.key === p.key);
    assert.ok(cell.polygon.length >= 3, p.key + ': cell must be a real polygon');
    assert.equal(pointInPolygon([p.x, p.y], cell.polygon), true, p.key + ': centroid not inside its own cell');
  });
});

test('voronoiCells: cells tile the bbox (sum of areas = bbox area, within 0.1%)', () => {
  const points = projectedCorePoints();
  const cells = voronoiCells(points, bboxProjected);
  const sumArea = cells.reduce((n, c) => n + polygonArea(c.polygon), 0);
  const bboxArea = (bboxProjected.maxX - bboxProjected.minX) * (bboxProjected.maxY - bboxProjected.minY);
  const pctDiff = Math.abs(sumArea - bboxArea) / bboxArea * 100;
  assert.ok(pctDiff < 0.1, 'cells cover ' + sumArea.toFixed(6) + ' vs bbox ' + bboxArea.toFixed(6) + ' (' + pctDiff.toFixed(4) + '% off)');
});

test('voronoiCells: every core-hood venue in venues.json falls inside SOME cell (no gaps in real data)', () => {
  const venues = require(path.join(__dirname, '..', 'venues.json')).venues;
  const points = projectedCorePoints();
  const cells = voronoiCells(points, bboxProjected);
  const coreVenues = venues.filter((v) => isCoreHood(v.hood));
  assert.ok(coreVenues.length > 0);
  coreVenues.forEach((v) => {
    const [x, y] = projectLatLon(v.lat, v.lon, meanLatRad);
    const containingCell = cells.find((c) => pointInPolygon([x, y], c.polygon));
    assert.ok(containingCell, v.name + ' (' + v.hood + ') at ' + v.lat + ',' + v.lon + ' falls outside every Voronoi cell');
  });
});
