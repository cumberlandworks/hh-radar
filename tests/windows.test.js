'use strict';
// Pure-function tests for logic.js. Every "now" is an injected dateInTz fixture —
// {year, month, day, hour, minute, dayOfWeek} — never new Date(). This is deliberate:
// a clock-dependent fixture rots the day it's written (the calendar time-bomb lesson).
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveWindow, isActive, startsWithin, nextStart, nextStartAcrossVenues,
  isStale, windowWarnings, isAllDay, nearestNeighborhood, NEIGHBORHOOD_CENTROIDS, bestSourceUrl,
  ZONES, hoodKeys, zoneOf, isCoreHood, applyHoodFilter,
  serializeHoodSelection, deserializeHoodSelection,
  projectLatLon, polygonArea, pointInPolygon, voronoiCells,
  CORE_MAP_BBOX, coreHoodCentroids,
  CORE_ZONE_KEYS, MAP_EXTENT, MAP_EXEMPT_HOODS, MAP_VIEW_W, MAP_VIEW_H,
  ZONE_POLYGONS, ZONE_LABEL_ANCHORS, ZONE_MAP_LABELS, RIVER, INTERSTATES,
  zoneContains, zoneLabelBoxes, rectsIntersect, projectToView,
  labelBlockClearance, dayCoverageCounts, hasIntervalOn, pickSurprise,
  surprisePools, candidateKey, serviceDayOf, minutesUntilServiceEnd,
  windowHasFood, windowHasDrink, composeNote,
  driveEstimateMin, walkEstimateMin, travelEstimateMin, formatEtaMin, arrivalLeadMin, PARK_MIN,
  activeOrNextInterval, arrivalVerdict, MAKE_MARGIN_MIN,
  NAV_APPS, isNavApp, navUrl, defaultNavApp,
  NAV_PLATFORMS, NAV_FALLBACK_MS, navApps, detectPlatform,
  shouldShowNavFallback, armNavFallbackTimer, navControlHtml, navPickHtml,
  validateVenues, hoursStatus, weekHours, hoursSourceInfo,
  openBands, lintVenues,
  dealPriceLabel, formatDays, tempClosureOn, tempClosedFor, windowTempClosedNow, dateOfDay,
  outsideHoursDays, lintOutsideHours, gridAxisStart, gridBlockStarts, tipSectionHtml,
  REFBAR_KEY, refBarDismissed, dismissRefBar, followRefBar,
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

// ---- C4 (v1.2): isAllDay is gated on kind === 'special' (v1.13 C2: one rule, span only) ----
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

test('isAllDay: resolved span 299 minutes is not all-day, 300 is (special kind)', () => {
  const short = win(['WED'], '14:00', '18:59', { kind: 'special' }); // 299 min
  const long = win(['WED'], '14:00', '19:00', { kind: 'special' }); // 300 min
  const v = venue({}, [short, long]);
  assert.equal(isAllDay(v, short), false, '299 minutes: not all-day');
  assert.equal(isAllDay(v, long), true, '300 minutes: all-day');
});

test('isAllDay (v1.13 C2): the start time no longer matters; a short special is a block at 13:59, 14:00 or 7am', () => {
  const before = win(['WED'], '13:59', '15:59', { kind: 'special' }); // 120 min span, start < 14:00
  const at = win(['WED'], '14:00', '16:00', { kind: 'special' }); // 120 min span, start === 14:00
  const dock = win(['MON', 'TUE', 'WED', 'THU', 'FRI'], '07:00', '09:00', { kind: 'special' }); // The Loading Dock
  const v = venue({}, [before, at, dock]);
  assert.equal(isAllDay(v, before), false, '13:59 start, 2h: not all-day (the old start rule is gone)');
  assert.equal(isAllDay(v, at), false, '14:00 start, 2h: not all-day');
  assert.equal(isAllDay(v, dock), false, '7-9am: a normal block');
  assert.equal(isAllDay(v, win(['SAT'], '08:00', '13:00', { kind: 'special' })), true, '8am, 5h: still all-day by span');
});

test('isAllDay (v1.13 C2): on the real data The Loading Dock and JBJ\'s Sunday 10-2 are blocks, Two Hands stays all-day', () => {
  const dock = REAL.find((v) => v.name === 'The Loading Dock');
  assert.equal(isAllDay(dock, dock.windows.find((w) => w.kind === 'special' && w.start === '07:00')), false);
  const jbj = REAL.find((v) => v.name === "JBJ's Nashville");
  assert.equal(isAllDay(jbj, jbj.windows.find((w) => w.start === '10:00' && w.end === '14:00')), false);
  const th = REAL.find((v) => v.name === 'Two Hands - Nashville');
  assert.ok(th.windows.filter((w) => w.kind === 'special').every((w) => isAllDay(th, w)), 'Two Hands 8am specials run >= 5h');
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
  assert.equal(nearestNeighborhood(36.1189, -86.7902), '12 South', 'pre-v1.16 12 South centroid -> 12 South (still nearest)');
});

// ---- ZONE model (v1.3): hoodKeys / zoneOf / isCoreHood ----
// v1.16: 21 -> 36 keys. The core hoods are hoods-v2.json's, in its order (fix16 C1).
test('hoodKeys returns exactly 36 keys in the fix16-specified chip order', () => {
  const keys = hoodKeys();
  assert.equal(keys.length, 36);
  assert.deepEqual(keys, [
    'Lower Broadway', 'Downtown & Printers Alley', 'SoBro', 'Rutledge Hill & Rolling Mill Hill',
    'The Gulch', 'Nashville Yards & North Gulch', 'Midtown & Music Row', 'Hillsboro Village & Belmont', 'West End',
    'Germantown', 'Buchanan Arts District & North Nashville', 'Dickerson Pike',
    'Five Points & Main Street', 'Gallatin Avenue & Eastwood', 'Inglewood & Riverside', 'East Bank & Fesslers',
    '12 South', 'Wedgewood-Houston', 'Berry Hill', 'Green Hills',
    'Sylvan Park', 'The Nations', 'West Nashville & White Bridge', 'Belle Meade', 'Bellevue',
    'Brentwood', 'Franklin/Cool Springs', 'Antioch/Hermitage', 'Smyrna',
    'Murfreesboro', 'Mt. Juliet', 'Hendersonville', 'Gallatin', 'Dickson', 'Lewisburg',
    'Donelson & Opry Mills',
  ]);
});

test('ZONES core hoods match data-src hoods-v2.json exactly, in order', () => {
  const hv2 = require(path.join(__dirname, '..', 'data-src', 'refresh-20261023', 'hoods-v2.json'));
  CORE_ZONE_KEYS.forEach((z) => {
    assert.deepEqual(ZONES.find((x) => x.key === z).hoods, hv2[z].map((h) => h.hood), z);
  });
  const outer = ZONES.find((x) => x.key === 'outer').hoods;
  assert.equal(outer[outer.length - 1], 'Donelson & Opry Mills');
});

test('every hood key has exactly one NEIGHBORHOOD_CENTROIDS entry except Dickson and Lewisburg', () => {
  const names = NEIGHBORHOOD_CENTROIDS.map((c) => c.name);
  assert.equal(new Set(names).size, names.length, 'duplicate centroid');
  assert.deepEqual(hoodKeys().filter((h) => !names.includes(h)), ['Dickson', 'Lewisburg']);
  assert.deepEqual(names.filter((n) => zoneOf(n) === null), [], 'centroid with no zone');
});

test('ZONES has 8 zones and every hood belongs to exactly one', () => {
  assert.equal(ZONES.length, 8);
  const seen = new Set();
  ZONES.forEach((z) => z.hoods.forEach((h) => {
    assert.equal(seen.has(h), false, h + ' appears in more than one zone');
    seen.add(h);
  }));
  assert.equal(seen.size, 36);
});

test('zoneOf maps every hood to its zone and returns null for an unknown key', () => {
  assert.equal(zoneOf('The Gulch'), 'gulch');
  assert.equal(zoneOf('Dickson'), 'outer');
  assert.equal(zoneOf('Belle Meade'), 'west');
  assert.equal(zoneOf('Donelson & Opry Mills'), 'outer');
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
  const original = new Set(['The Gulch', 'Midtown & Music Row']);
  const raw = JSON.parse(JSON.stringify(serializeHoodSelection(original)));
  const restored = deserializeHoodSelection(raw, hoodKeys());
  assert.deepEqual(Array.from(restored).sort(), ['Midtown & Music Row', 'The Gulch']);
});

test('deserializeHoodSelection: silently drops unknown keys instead of resetting to all', () => {
  // v1.16: a pre-v1.16 key ('Midtown') is unknown now and drops the same way.
  const restored = deserializeHoodSelection(['The Gulch', 'Atlantis', 'Midtown'], hoodKeys());
  assert.deepEqual(Array.from(restored).sort(), ['The Gulch']);
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


// ---- C3 (v1.4): the hand-authored zone map ----
// The v1.3 Voronoi tests above stay green on purpose: voronoiCells is no longer
// what the map renders, but it remains the geometric cross-check on the hood
// centroids. These tests cover what IS rendered.

// v1.10: one named, measured exception, kept out of the containment tests rather than
// redrawing three polygons and the river for one dot. LinQ Social Kitchen was new in the
// 2026-10-23 refresh; the refresh's hood script (nearestNeighborhood) labelled it
// Wedgewood-Houston, but it sits ~0.002 lon east of the drawn Cumberland seam, inside
// East. Its hood is the data's call (venues.json is not edited here); its dot renders
// on the East side of the line. Do not add to this list without saying why.
// v1.11: the thread relabelled it Downtown/SoBro, zone downtown (post_20261023c.py, label
// only, same lat/lon). The dot is still inside East, so it is still outside its own
// (now Downtown) polygon and the exception stays.
// v1.16 (fix16 C1): hoods are now set by street address, and five more venues land in a
// zone whose drawn polygon does not hold their dot. The block keeps the polygons as drawn,
// so each one is a named exception here; LinQ's hood is now Rutledge Hill & Rolling Mill Hill.
const MAP_SEAM_EXCEPTIONS = {
  'ik-19732': 'LinQ Social Kitchen: Downtown (Rutledge Hill) by address, East of the drawn river',
  'ik-20518': 'Chateau West: Gulch & Midtown (West End, 3408 West End Ave) by address, inside West',
  'ik-15740': 'E+ROSE - OneC1ty: Gulch & Midtown (West End, 4 City Blvd) by address, inside West',
  'ik-20959': 'Jashan: Gulch & Midtown (Hillsboro Village, 2100 21st Ave S) by address, inside South',
};
// v1.17 C4: the Downtown notch is gone, so koshō (ik-13852) and The Herban Perk & Pantry
// (ik-18919) sit inside Downtown and are no longer exceptions; the two tests below hold them
// to it like any other core venue.
function coreVenuesForMap() {
  const venues = require(path.join(__dirname, '..', 'venues.json')).venues;
  return venues.filter((v) => isCoreHood(v.hood) && !MAP_EXEMPT_HOODS.includes(v.hood) &&
    !MAP_SEAM_EXCEPTIONS[v.id]);
}

test('MAP_SEAM_EXCEPTIONS: each exception is still really outside its own zone (drop it once fixed)', () => {
  const venues = require(path.join(__dirname, '..', 'venues.json')).venues;
  Object.keys(MAP_SEAM_EXCEPTIONS).forEach((id) => {
    const v = venues.find((x) => x.id === id);
    assert.ok(v, id + ' is no longer in venues.json — remove the exception');
    assert.equal(zoneContains(zoneOf(v.hood), v.lat, v.lon), false, MAP_SEAM_EXCEPTIONS[id]);
  });
});

test('ZONE_POLYGONS: one simple polygon per core zone, 6-12 vertices, inside the map extent', () => {
  assert.deepEqual(Object.keys(ZONE_POLYGONS).sort(), CORE_ZONE_KEYS.slice().sort());
  CORE_ZONE_KEYS.forEach((z) => {
    const poly = ZONE_POLYGONS[z];
    assert.ok(Array.isArray(poly), z + ': missing polygon');
    assert.ok(poly.length >= 6 && poly.length <= 12, z + ': ' + poly.length + ' vertices, want 6..12');
    poly.forEach(([lat, lon]) => {
      assert.ok(lat >= MAP_EXTENT.minLat && lat <= MAP_EXTENT.maxLat, z + ': vertex lat ' + lat + ' outside extent');
      assert.ok(lon >= MAP_EXTENT.minLon && lon <= MAP_EXTENT.maxLon, z + ': vertex lon ' + lon + ' outside extent');
    });
    // no self-intersection: no pair of non-adjacent edges may cross
    const n = poly.length;
    const orient = (p, q, r) => Math.sign((q[1] - p[1]) * (r[0] - p[0]) - (q[0] - p[0]) * (r[1] - p[1]));
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (j === i + 1 || (i === 0 && j === n - 1)) continue;
        const a = poly[i], b = poly[(i + 1) % n], c = poly[j], d = poly[(j + 1) % n];
        const cross = orient(a, b, c) !== orient(a, b, d) && orient(c, d, a) !== orient(c, d, b);
        assert.equal(cross, false, z + ': edges ' + i + ' and ' + j + ' self-intersect');
      }
    }
  });
});

test('ZONE_POLYGONS: every core venue falls inside its OWN zone polygon (the two Bellevue venues excepted)', () => {
  const coreVenues = coreVenuesForMap();
  assert.ok(coreVenues.length > 50, 'expected the real dataset, got ' + coreVenues.length);
  const misses = coreVenues.filter((v) => !zoneContains(zoneOf(v.hood), v.lat, v.lon));
  assert.deepEqual(
    misses.map((v) => v.name + ' (' + v.hood + ' @ ' + v.lat + ',' + v.lon + ')'),
    [],
    'venues outside their own zone polygon'
  );
});

test('ZONE_POLYGONS: no venue falls inside a FOREIGN zone polygon (the six regions do not overlap on any venue)', () => {
  const strays = [];
  coreVenuesForMap().forEach((v) => {
    CORE_ZONE_KEYS.forEach((z) => {
      if (z === zoneOf(v.hood)) return;
      if (zoneContains(z, v.lat, v.lon)) strays.push(v.name + ' (' + v.hood + ') also inside ' + z);
    });
  });
  assert.deepEqual(strays, []);
});

test('MAP_EXEMPT_HOODS: exactly the two Bellevue venues sit outside the map extent', () => {
  const venues = require(path.join(__dirname, '..', 'venues.json')).venues;
  const outside = venues.filter((v) => isCoreHood(v.hood) && (
    v.lat < MAP_EXTENT.minLat || v.lat > MAP_EXTENT.maxLat ||
    v.lon < MAP_EXTENT.minLon || v.lon > MAP_EXTENT.maxLon));
  // v1.10: the 2026-10-23 refresh added Tiff's Treats - Nashville Bellevue (2 -> 3).
  // v1.12: 615chuTNey (Bellevue) dropped, permanently closed (3 -> 2).
  assert.deepEqual(outside.map((v) => v.hood), ['Bellevue', 'Bellevue'],
    'the exemption must not silently grow: ' + outside.map((v) => v.name + '/' + v.hood).join(', '));
});

test('zone labels do not overlap at the 320px render (approx 6px/char boxes)', () => {
  const boxes = zoneLabelBoxes();
  assert.equal(boxes.length, CORE_ZONE_KEYS.length);
  const hits = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      if (rectsIntersect(boxes[i], boxes[j])) {
        hits.push(boxes[i].zone + ' x ' + boxes[j].zone);
      }
    }
  }
  assert.deepEqual(hits, [], 'overlapping label boxes');
  // and every label must actually be on the canvas
  boxes.forEach((b) => {
    assert.ok(b.x >= 0 && b.x + b.w <= MAP_VIEW_W, b.zone + ': label box runs off the map horizontally (' + b.x.toFixed(1) + '..' + (b.x + b.w).toFixed(1) + ')');
    assert.ok(b.y >= 0 && b.y + b.h <= MAP_VIEW_H, b.zone + ': label box runs off the map vertically');
  });
});

test('every zone label anchor lies inside its own polygon', () => {
  CORE_ZONE_KEYS.forEach((z) => {
    const a = ZONE_LABEL_ANCHORS[z];
    assert.ok(Array.isArray(a), z + ': missing label anchor');
    assert.equal(zoneContains(z, a[0], a[1]), true, z + ': label anchor is not inside its own polygon');
    assert.ok(ZONE_MAP_LABELS[z], z + ': missing short map label');
  });
});

test('RIVER separates the west bank (downtown + Germantown) from the east bank (East Nashville)', () => {
  assert.ok(RIVER.length >= 8, 'river needs enough points to read as a river, got ' + RIVER.length);
  const asc = RIVER.slice().sort((a, b) => a[0] - b[0]);
  assert.deepEqual(RIVER.map((p) => p[0]), asc.map((p) => p[0]),
    'RIVER points must be ordered south -> north so the bank test can interpolate');
  const lonAt = (lat) => {
    if (lat <= asc[0][0]) return asc[0][1];
    if (lat >= asc[asc.length - 1][0]) return asc[asc.length - 1][1];
    for (let i = 1; i < asc.length; i++) {
      if (lat <= asc[i][0]) {
        const t = (lat - asc[i - 1][0]) / (asc[i][0] - asc[i - 1][0]);
        return asc[i - 1][1] + t * (asc[i][1] - asc[i - 1][1]);
      }
    }
    return asc[asc.length - 1][1];
  };
  const wrong = [];
  coreVenuesForMap().forEach((v) => {
    const z = zoneOf(v.hood);
    if (z !== 'downtown' && z !== 'north' && z !== 'east') return;
    if (v.lat < asc[0][0] || v.lat > asc[asc.length - 1][0]) return;
    const shouldBeWest = z !== 'east';
    if ((v.lon < lonAt(v.lat)) !== shouldBeWest) wrong.push(v.name + ' (' + z + ')');
  });
  assert.deepEqual(wrong, [], 'venues on the wrong bank of the river');
});

test('INTERSTATES: three named hints, each a polyline inside the extent', () => {
  const names = Object.keys(INTERSTATES);
  assert.equal(names.length, 3, 'want I-40, I-65 and I-24, got ' + names.join(', '));
  names.forEach((n) => {
    const line = INTERSTATES[n];
    assert.ok(Array.isArray(line) && line.length >= 2, n + ': needs at least 2 points');
    line.forEach(([lat, lon]) => {
      assert.ok(lat >= MAP_EXTENT.minLat && lat <= MAP_EXTENT.maxLat, n + ': lat ' + lat + ' outside extent');
      assert.ok(lon >= MAP_EXTENT.minLon && lon <= MAP_EXTENT.maxLon, n + ': lon ' + lon + ' outside extent');
    });
  });
});

test('projectToView maps the extent corners onto the viewBox corners', () => {
  const tl = projectToView(MAP_EXTENT.maxLat, MAP_EXTENT.minLon);
  const br = projectToView(MAP_EXTENT.minLat, MAP_EXTENT.maxLon);
  assert.ok(Math.abs(tl[0]) < 1e-9 && Math.abs(tl[1]) < 1e-9, 'top-left should be 0,0');
  assert.ok(Math.abs(br[0] - MAP_VIEW_W) < 1e-9, 'right edge should be MAP_VIEW_W');
  assert.ok(Math.abs(br[1] - MAP_VIEW_H) < 1e-9, 'bottom edge should be MAP_VIEW_H');
});

// ==================== v1.7 C1: surprisePools + pickSurprise (Now | Later) ====================
// v1.5's tier-ladder tests are gone with the ladder. TJ: "I tested the roll again
// feature - doesn't change anything" — the ladder's last tier narrowed to the ties at
// the single earliest start, which live is two rows, so there was nothing to roll.
const fixedRng = (v) => () => v;
function cand(name, tier, deals, startAbs) {
  return {
    venue: { id: 'ik-' + name, name: name },
    win: win(['TUE'], '15:00', '18:00', { deals: deals }),
    tier: tier,
    day: 'TUE',
    startAbs: startAbs === undefined ? 0 : startAbs,
  };
}
const FOOD = [{ type: 'food', desc: 'Gyoza', price: '$9' }];
const DRINK = [{ type: 'drink', desc: 'Well pours', price: '$5' }];

test('pickSurprise: food candidates shut drink-only ones out of the pool entirely', () => {
  const candidates = [
    cand('DrinkA', 'live', DRINK), cand('DrinkB', 'live', DRINK),
    cand('FoodA', 'live', FOOD), cand('DrinkC', 'live', DRINK),
  ];
  // Sweep the whole rng range: every draw must land on the one food candidate.
  for (let i = 0; i < 20; i++) {
    const res = pickSurprise(candidates, fixedRng(i / 20), { prefer: 'food' });
    assert.equal(res.pick.venue.name, 'FoodA', 'rng ' + (i / 20) + ' picked a drink-only venue');
    assert.equal(res.poolSize, 1);
    assert.equal(res.canRoll, false, 'a one-candidate pool cannot roll');
  }
});

test('pickSurprise: with no food in the pool the drink-only one is used rather than nothing', () => {
  const res = pickSurprise([cand('DrinkA', 'live', DRINK)], fixedRng(0.5), { prefer: 'food' });
  assert.equal(res.pick.venue.name, 'DrinkA');
});

test('pickSurprise: prefer:drink mirrors the rule (drink pool wins over food)', () => {
  const res = pickSurprise([cand('FoodA', 'live', FOOD), cand('DrinkA', 'live', DRINK)],
    fixedRng(0.9), { prefer: 'drink' });
  assert.equal(res.pick.venue.name, 'DrinkA');
});

test('pickSurprise: deterministic under a fixed rng, and the draw actually spreads', () => {
  const pool = [cand('A', 'live', FOOD), cand('B', 'live', FOOD), cand('C', 'live', FOOD), cand('D', 'live', FOOD)];
  assert.equal(pickSurprise(pool, fixedRng(0.3), {}).pick.venue.name,
    pickSurprise(pool, fixedRng(0.3), {}).pick.venue.name);
  assert.deepEqual(
    [0, 0.26, 0.51, 0.76, 0.999].map((r) => pickSurprise(pool, fixedRng(r), {}).pick.venue.name),
    ['A', 'B', 'C', 'D', 'D']);
});

test('pickSurprise: rng returning exactly 1 (or nonsense) clamps instead of returning undefined', () => {
  const pool = [cand('A', 'live', FOOD), cand('B', 'live', FOOD)];
  assert.equal(pickSurprise(pool, fixedRng(1), {}).pick.venue.name, 'B');
  assert.equal(pickSurprise(pool, fixedRng(NaN), {}).pick.venue.name, 'A');
  assert.equal(pickSurprise(pool, undefined, {}).pick.venue.name, 'A');
});

test('pickSurprise: an empty candidate list is null, not a crash', () => {
  assert.equal(pickSurprise([], fixedRng(0.5), {}), null);
});

// (e) Roll again must MOVE. This is the whole bug: 100 draws, never the excluded key.
test('(e) pickSurprise: exclude — 100 draws from a 2-pool never return the excluded key', () => {
  const pool = [cand('A', 'live', FOOD), cand('B', 'live', FOOD)];
  const excluded = candidateKey(pool[0]);
  for (let i = 0; i < 100; i++) {
    const res = pickSurprise(pool, Math.random, { prefer: 'food', exclude: excluded });
    assert.equal(res.pick.venue.name, 'B', 'draw ' + i + ' returned the excluded pick');
    assert.equal(res.poolSize, 2, 'poolSize stays the honest count, not the post-exclusion one');
    assert.equal(res.canRoll, true);
  }
});

test('(f) pickSurprise: a pool of one reports canRoll:false (the card hides Roll again)', () => {
  const res = pickSurprise([cand('Only', 'live', FOOD)], fixedRng(0.5), { prefer: 'food' });
  assert.equal(res.poolSize, 1);
  assert.equal(res.canRoll, false);
  // Excluding the only candidate falls back to it rather than returning nothing.
  const res2 = pickSurprise([cand('Only', 'live', FOOD)], fixedRng(0.5),
    { prefer: 'food', exclude: candidateKey(cand('Only', 'live', FOOD)) });
  assert.equal(res2.pick.venue.name, 'Only');
  assert.equal(res2.canRoll, false);
});

test('surprisePools: specials never enter either pool (Surprise me promises a happy hour)', () => {
  const v = { id: 'ik-1', name: 'S', hours: {}, windows: [
    win(['TUE'], '11:00', '20:00', { kind: 'special', deals: FOOD }),
    win(['TUE'], '16:00', '18:00', { kind: 'happy_hour', deals: FOOD }),
  ] };
  const pools = surprisePools([v], dt('TUE', 16, 30));
  assert.equal(pools.now.length, 1, 'only the happy_hour window is live-eligible');
  assert.equal(pools.now[0].win.kind, 'happy_hour');
});

test('surprisePools: a venue live now is never also in later', () => {
  const v = { id: 'ik-1', name: 'Both', hours: {}, windows: [
    win(['TUE'], '15:00', '18:00', { deals: FOOD }),   // live at 16:30
    win(['TUE'], '21:00', '23:00', { deals: FOOD }),   // later tonight
  ] };
  const pools = surprisePools([v], dt('TUE', 16, 30));
  assert.equal(pools.now.length, 1);
  assert.equal(pools.now[0].win.start, '15:00');
  assert.equal(pools.later.length, 1, 'the 21:00 window is a separate, legal Later pick');
  assert.equal(pools.later[0].win.start, '21:00');
  assert.equal(pools.laterScope, 'today');
  assert.equal(pools.laterLabel, 'later today');
  assert.notEqual(candidateKey(pools.now[0]), candidateKey(pools.later[0]),
    'the same venue on two windows must have two distinct keys, or Roll again would over-exclude');
});

test('surprisePools: a window starting within 2h is Now, not Later', () => {
  const v = { id: 'ik-1', name: 'Soon', hours: {}, windows: [win(['TUE'], '17:30', '19:00', { deals: FOOD })] };
  const pools = surprisePools([v], dt('TUE', 16, 30));
  assert.equal(pools.now.length, 1);
  assert.equal(pools.now[0].tier, 'soon');
  assert.equal(pools.now[0].startAbs, 60);
  assert.ok(!pools.later.some((c) => c.win.start === '17:30'), 'a Now entry must not also be Later');
});

test('surprisePools: the service day runs to 03:00, so 01:00 SAT is still Friday night', () => {
  assert.equal(serviceDayOf(dt('SAT', 1, 0)), 'FRI');
  assert.equal(serviceDayOf(dt('SAT', 3, 0)), 'SAT');
  assert.equal(serviceDayOf(dt('FRI', 23, 59)), 'FRI');
  assert.equal(minutesUntilServiceEnd(dt('SAT', 1, 0)), 120, '01:00 -> 03:00 is two hours');
  assert.equal(minutesUntilServiceEnd(dt('FRI', 16, 30)), 630, '16:30 -> 03:00 next day');
});

// ---- (a)-(d): measured against the real venues.json, the way the page runs ----
const REAL = require(path.join(__dirname, '..', 'venues.json')).venues;

test('(a) 16:30 TUE: Now is deep, Later is non-trivial and holds nothing live or soon', () => {
  const pools = surprisePools(REAL, dt('TUE', 16, 30));
  assert.ok(pools.now.length >= 30, 'now.length = ' + pools.now.length);
  assert.ok(pools.later.length >= 5, 'later.length = ' + pools.later.length);
  const nowKeys = new Set(pools.now.map(candidateKey));
  assert.ok(!pools.later.some((c) => nowKeys.has(candidateKey(c))), 'later shares a key with now');
  // The stronger promise from the block's ACCEPT: flipping to Later never shows a
  // venue that is open as you read the card.
  const liveVenues = new Set(pools.now.filter((c) => c.tier === 'live').map((c) => c.venue.id));
  assert.ok(!pools.later.some((c) => liveVenues.has(c.venue.id)),
    'Later offered a venue that is live right now');
});

test('(b) 04:20 FRI (the dead hour TJ tested): Now is empty, Later is the whole evening', () => {
  const now = dt('FRI', 4, 20);
  const pools = surprisePools(REAL, now);
  assert.equal(pools.now.length, 0, 'nothing is live or starting soon at 04:20');
  assert.ok(pools.later.length >= 10, 'later.length = ' + pools.later.length);
  assert.equal(pools.laterScope, 'today');
  const horizon = minutesUntilServiceEnd(now);
  pools.later.forEach((c) => {
    assert.ok(c.startAbs > 120 && c.startAbs <= horizon,
      c.venue.name + ' starts ' + c.startAbs + 'm out, outside (120, ' + horizon + ']');
  });
  // The regression itself: the v1.5 fallback collapsed to the single earliest start.
  const starts = new Set(pools.later.map((c) => c.win.start));
  assert.ok(starts.size >= 5, 'later spans only ' + starts.size + ' distinct start times');
});

test('(c) 01:00 SAT, past the last start: Later rolls over to tomorrow with the tomorrow label', () => {
  const pools = surprisePools(REAL, dt('SAT', 1, 0));
  assert.equal(pools.laterScope, 'tomorrow');
  assert.equal(pools.laterDay, 'SAT', 'the service day is FRI, so tomorrow is SAT');
  assert.equal(pools.laterLabel, 'tomorrow — Sat');
  assert.ok(pools.later.length >= 10, 'later.length = ' + pools.later.length);
  pools.later.forEach((c) => {
    assert.equal(c.day, 'SAT');
    assert.ok(c.win.days.includes('SAT'));
  });
});

test('(d) Day Grid override: Later is the selected day\'s full set, clock notwithstanding', () => {
  const pools = surprisePools(REAL, dt('TUE', 16, 30), { day: 'SUN' });
  assert.equal(pools.laterScope, 'day');
  assert.equal(pools.laterDay, 'SUN');
  assert.equal(pools.laterLabel, 'Sunday');
  const expected = REAL.reduce((n, v) => n + v.windows.filter(
    (w) => w.kind === 'happy_hour' && w.days.includes('SUN')).length, 0);
  assert.equal(pools.later.length, expected, 'the full SUN set, nothing pruned');
  assert.ok(pools.now.length >= 30, 'Now still means the clock, even on the grid tab');
  // Selecting TODAY on the grid is not an override — it falls back to the clock rule.
  const same = surprisePools(REAL, dt('TUE', 16, 30), { day: 'TUE' });
  assert.notEqual(same.laterScope, 'day');
});

// ==================== v1.17 C2: Surprise me follows the filters ====================
const { refreshSurprise, applyHoodFilter: hoodFilter } = require('../logic.js');

test('refreshSurprise (v1.17 C2): dismissed stays dismissed', () => {
  assert.equal(refreshSurprise(null, { now: [cand('A', 'live', FOOD)], later: [] }, fixedRng(0)), null);
});

test('refreshSurprise (v1.17 C2): a pick still in its pool is kept, with the fresh pool size', () => {
  const a = cand('A', 'live', FOOD), b = cand('B', 'live', FOOD), c = cand('C', 'live', FOOD);
  const prev = { mode: 'now', pick: a, poolSize: 1, canRoll: false };
  for (const r of [0, 0.5, 0.99]) {
    const s = refreshSurprise(prev, { now: [b, a, c], later: [] }, fixedRng(r), { prefer: 'food' });
    assert.equal(s.pick.venue.name, 'A', 'rng ' + r + ' re-rolled a pick that was still in the pool');
    assert.equal(s.mode, 'now');
    assert.equal(s.poolSize, 3);
    assert.equal(s.canRoll, true);
  }
});

test('refreshSurprise (v1.17 C2): a pick filtered out is replaced, and Now/Later stays as chosen', () => {
  const a = cand('A', 'live', FOOD), b = cand('B', 'live', FOOD);
  const prev = { mode: 'later', pick: a, poolSize: 2, canRoll: true };
  const s = refreshSurprise(prev, { now: [a], later: [b] }, fixedRng(0), { prefer: 'food' });
  assert.equal(s.mode, 'later');
  assert.equal(s.pick.venue.name, 'B');
  // Food -> Drink: the pool narrows to drink windows, so a food-only pick is replaced.
  const d = cand('D', 'live', DRINK);
  const s2 = refreshSurprise({ mode: 'now', pick: a, poolSize: 2, canRoll: true },
    { now: [a, d], later: [] }, fixedRng(0), { prefer: 'drink' });
  assert.equal(s2.pick.venue.name, 'D');
  // Its pool emptied: an empty card in the chosen mode, not a silent switch.
  const s3 = refreshSurprise({ mode: 'now', pick: a, poolSize: 1, canRoll: false },
    { now: [], later: [b] }, fixedRng(0), { prefer: 'food' });
  assert.deepEqual(s3, { mode: 'now', pick: null, poolSize: 0, canRoll: false });
});

test('refreshSurprise (v1.17 C2): an empty card re-opens by the 🎲 rule (Now if anything is on)', () => {
  const a = cand('A', 'live', FOOD), b = cand('B', 'live', FOOD);
  const empty = { mode: 'later', pick: null, poolSize: 0, canRoll: false };
  assert.equal(refreshSurprise(empty, { now: [a], later: [b] }, fixedRng(0)).mode, 'now');
  assert.equal(refreshSurprise(empty, { now: [], later: [b] }, fixedRng(0)).pick.venue.name, 'B');
  assert.deepEqual(refreshSurprise(empty, { now: [], later: [] }, fixedRng(0)), empty);
});

// TJ's exact steps, Sunday 03:48: None -> Surprise me (empty) -> select Downtown, Gulch &
// Midtown, Germantown & North -> a Later pick, a Sunday happy hour, never JBJ's (a special).
test('refreshSurprise (v1.17 C2): TJ\'s steps at SUN 03:48 — None, Surprise me, three zones -> a Later pick', () => {
  const now = dt('SUN', 3, 48, { year: 2026, month: 10, day: 25 });
  const none = surprisePools(hoodFilter(REAL, { selected: new Set() }), now);
  assert.equal(none.now.length + none.later.length, 0);
  let card = refreshSurprise({ mode: 'later', pick: null, poolSize: 0, canRoll: false }, none, fixedRng(0.5));
  assert.equal(card.pick, null, 'None selected: the empty card');
  const three = ZONES.filter((z) => ['downtown', 'gulch', 'north'].includes(z.key));
  assert.equal(three.length, 3);
  const sel = new Set([].concat(...three.map((z) => z.hoods)));
  const pools = surprisePools(hoodFilter(REAL, { selected: sel }), now);
  for (const r of [0, 0.25, 0.5, 0.75, 0.999]) {
    card = refreshSurprise({ mode: 'later', pick: null, poolSize: 0, canRoll: false }, pools, fixedRng(r), { prefer: 'food' });
    assert.equal(card.mode, 'later');
    assert.ok(card.pick, 'rng ' + r + ': still "Nothing later"');
    assert.equal(card.pick.win.kind, 'happy_hour');
    assert.equal(card.pick.day, 'SUN');
    assert.ok(sel.has(card.pick.venue.hood));
    assert.ok(!/JBJ/.test(card.pick.venue.name));
  }
  assert.ok(pools.later.some((c) => /Blue Sushi/.test(c.venue.name) && c.win.start === '12:00'),
    'Blue Sushi 5th & Broadway from noon is in the Later pool');
});

test('surprisePools: five rolls at the dead hour give distinct venues (the acceptance test)', () => {
  const pools = surprisePools(REAL, dt('FRI', 4, 20));
  const names = new Set();
  let exclude = null;
  for (let i = 0; i < 5; i++) {
    const res = pickSurprise(pools.later, Math.random, { prefer: 'food', exclude: exclude });
    assert.equal(res.canRoll, true);
    exclude = candidateKey(res.pick);
    names.add(res.pick.venue.name);
  }
  assert.ok(names.size >= 3, 'five rolls produced only ' + names.size + ' distinct venues');
});

// ==================== v1.5 C4: the grid coverage footer ====================
test('dayCoverageCounts: the four groups partition the roster on EVERY day', () => {
  const venues = require(path.join(__dirname, '..', 'venues.json')).venues;
  ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].forEach((d) => {
    const c = dayCoverageCounts(venues, d);
    assert.equal(c.onDay + c.otherDays + c.none + c.unchecked, venues.length,
      d + ': ' + c.onDay + ' + ' + c.otherDays + ' + ' + c.none + ' + ' + c.unchecked + ' != ' + venues.length);
    assert.equal(c.otherList.length, c.otherDays);
    assert.equal(c.uncheckedList.length, c.unchecked);
  });
});

test('dayCoverageCounts: measured SUN and TUE against venues.json', () => {
  const venues = require(path.join(__dirname, '..', 'venues.json')).venues;
  const pick = (c) => ({ onDay: c.onDay, otherDays: c.otherDays, none: c.none, unchecked: c.unchecked });
  // v1.14 (2026-10-25j data): the browser pass added 11 happy-hour windows at 7 venues and
  // verified 5 more as no happy hour, so "not checked yet" is 0.
  // v1.20 (2026-10-25m data): both Slim & Husky's lost their only window ("$12 Tuesday"), so
  // two venues move from "other days" to none (and off Tuesday).
  // v1.21 (2026-10-25n data): the 7 Blue Coast Burritos lost their only window (Tuesday family
  // night, a Little Rock post), so seven more move to none and off Tuesday.
  assert.deepEqual(pick(dayCoverageCounts(venues, 'SUN')), { onDay: 40, otherDays: 34, none: 85, unchecked: 0 });
  assert.deepEqual(pick(dayCoverageCounts(venues, 'TUE')), { onDay: 58, otherDays: 16, none: 85, unchecked: 0 });
});

test('dayCoverageCounts: "none" is exactly the verified-no-HH empty roster, not a day artefact', () => {
  const venues = require(path.join(__dirname, '..', 'venues.json')).venues;
  const verifiedEmpty = venues.filter((v) => v.windows.length === 0 && v.verified_no_hh).length;
  const notChecked = venues.filter((v) => v.windows.length === 0 && !v.verified_no_hh).length;
  ['MON', 'SUN'].forEach((d) => {
    assert.equal(dayCoverageCounts(venues, d).none, verifiedEmpty);
    assert.equal(dayCoverageCounts(venues, d).unchecked, notChecked);
  });
});

test('dayCoverageCounts: a "not checked yet" venue is never counted as no happy hour (v1.10 C3)', () => {
  const unchecked = Object.assign(venue({}, []), { name: 'U', verified_no_hh: false });
  const verified = Object.assign(venue({}, []), { name: 'V', verified_no_hh: true });
  const c = dayCoverageCounts([unchecked, verified], 'MON');
  assert.equal(c.none, 1);
  assert.equal(c.unchecked, 1);
  assert.deepEqual(c.uncheckedList.map((v) => v.name), ['U']);
});

test('dayCoverageCounts: it filters, so a zone selection changes onDay but never breaks the sum', () => {
  const venues = require(path.join(__dirname, '..', 'venues.json')).venues;
  const east = venues.filter((v) => v.zone === 'east');
  const c = dayCoverageCounts(east, 'SUN');
  assert.equal(c.onDay + c.otherDays + c.none + c.unchecked, east.length);
  assert.ok(c.onDay < dayCoverageCounts(venues, 'SUN').onDay);
});

test('dayCoverageCounts: every venue in the otherDays list really has nothing that day and something later', () => {
  const venues = require(path.join(__dirname, '..', 'venues.json')).venues;
  const c = dayCoverageCounts(venues, 'SUN');
  c.otherList.forEach((o) => {
    assert.equal(hasIntervalOn(o.venue, 'SUN'), false, o.venue.name + ' is in otherDays but has a SUN interval');
    assert.ok(o.nextDay, o.venue.name + ': no next day resolved');
    assert.equal(hasIntervalOn(o.venue, o.nextDay), true, o.venue.name + ': nextDay ' + o.nextDay + ' has no interval');
  });
});

test('windowHasFood / windowHasDrink read the deal types independently', () => {
  assert.equal(windowHasFood(win(['TUE'], '15:00', '18:00', { deals: FOOD })), true);
  assert.equal(windowHasDrink(win(['TUE'], '15:00', '18:00', { deals: FOOD })), false);
  assert.equal(windowHasDrink(win(['TUE'], '15:00', '18:00', { deals: DRINK })), true);
  assert.equal(windowHasFood(win(['TUE'], '15:00', '18:00', { deals: [] })), false);
});

// ==================== v1.5 C5: map label clearance + the river seam ====================
test('zone label blocks clear each other by >= 12 view units (sub line included)', () => {
  const boxes = zoneLabelBoxes();
  const pairs = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      pairs.push({ p: boxes[i].zone + ' x ' + boxes[j].zone, c: labelBlockClearance(boxes[i], boxes[j]) });
    }
  }
  const tight = pairs.filter((x) => x.c < 12);
  assert.deepEqual(tight, [], 'label blocks closer than 12 units');
});

test('zoneLabelBox is sized from the WIDER of the name and count lines', () => {
  // "Gulch" is 5 chars (30 units) but "NN today" is 8 (40) — the v1.4 model used
  // the name alone and so under-measured every short-named zone.
  const g = zoneLabelBoxes().find((b) => b.zone === 'gulch');
  assert.equal(g.nameW, 30);
  assert.equal(g.subW, 40);
  assert.equal(g.w, 40);
});

test('north/east seam north of Downtown sits ON the river polyline, vertex for vertex', () => {
  const riverNorth = RIVER.filter(([lat]) => lat >= 36.1735);
  riverNorth.forEach(([lat, lon]) => {
    const onEast = ZONE_POLYGONS.east.some((p) => p[0] === lat && p[1] === lon);
    const onNorth = ZONE_POLYGONS.north.some((p) => p[0] === lat && p[1] === lon);
    assert.ok(onEast, 'east polygon is missing river vertex ' + lat + ',' + lon);
    assert.ok(onNorth, 'north polygon is missing river vertex ' + lat + ',' + lon);
  });
  // and the three regions still meet at one point, so no sliver opens up
  const triple = [36.1735, -86.7745];
  ['east', 'north', 'downtown'].forEach((z) => {
    assert.ok(ZONE_POLYGONS[z].some((p) => p[0] === triple[0] && p[1] === triple[1]),
      z + ' lost the Downtown/North/East triple point');
  });
});

// ---------- v1.6 C1: feedback note composition ----------
test('composeNote tags the note with the chosen mood', () => {
  assert.equal(composeNote('liked', 'the map is great'), '[liked] the map is great');
  assert.equal(composeNote('idea', 'add brunch'), '[idea] add brunch');
  assert.equal(composeNote('problem', 'East is empty'), '[problem] East is empty');
});

test('composeNote leaves the note alone when no chip is chosen', () => {
  assert.equal(composeNote('', 'just a note'), 'just a note');
  assert.equal(composeNote(null, 'just a note'), 'just a note');
  // An unknown value must never reach the inbox as a tag.
  assert.equal(composeNote('urgent', 'just a note'), 'just a note');
});

test('composeNote trims, and empty text stays empty so Send has nothing to post', () => {
  assert.equal(composeNote('idea', '   padded   '), '[idea] padded');
  assert.equal(composeNote('idea', '   '), '');
  assert.equal(composeNote('idea', ''), '');
  assert.equal(composeNote('idea', undefined), '');
});

// ==================== v1.8 (fix8): drive time, verdict, navigation links ====================

// v1.23 (fix23): road = miles * 1.35; bands 20 / 26 / 35 mph on ROAD miles; +1 to pull out.
// Drive time only, as a maps app shows it. Parking (+5) belongs to the arrival, not here.
test('driveEstimateMin: the block’s worked examples', () => {
  assert.equal(driveEstimateMin(0.5), 3);  // road 0.675 @20 -> 1 + 2.03
  assert.equal(driveEstimateMin(2), 9);    // road 2.7   @20 -> 1 + 8.1
  assert.equal(driveEstimateMin(15), 36);  // road 20.25 @35 -> 1 + 34.71
});

// TJ 14:10: "one says 12 - its 3 - two other ones i checked say 20 and they are 9 and 14".
// Back-solved, those are road 0.6 mi and road 3.0 mi.
test('driveEstimateMin: TJ’s cases, by road miles', () => {
  assert.equal(driveEstimateMin(0.6 / 1.35), 3);  // was 12
  assert.equal(driveEstimateMin(3.0 / 1.35), 10); // was 20; his maps app said 9 and 14
});

// Flat bands are NOT monotonic: just past 3 road miles the 26mph band charges 7.9 min where
// the 20mph band charged 10 at its ceiling. driveEstimateMin floors each band at what the
// band below charged at its own ceiling.
test('driveEstimateMin: just past a band edge is clamped up, never down', () => {
  assert.equal(driveEstimateMin(3.01 / 1.35), 10, 'road 3.01 must not drop to 8');
  assert.equal(driveEstimateMin(3.9 / 1.35), 10, 'road 3.9, where the 26mph band catches up');
  assert.equal(driveEstimateMin(8.01 / 1.35), 19, 'road 8.01 must not drop to 15');
});

test('driveEstimateMin never decreases as the distance grows', () => {
  let prev = -1;
  for (let m = 0; m <= 40; m += 0.01) {
    const v = driveEstimateMin(m);
    assert.ok(v >= prev, `driveEstimateMin(${m.toFixed(2)}) = ${v} fell below ${prev}`);
    prev = v;
  }
});

test('driveEstimateMin floors at the one minute to pull out and ignores junk input', () => {
  assert.equal(driveEstimateMin(0), 1);
  assert.equal(driveEstimateMin(-3), 1);
  assert.equal(driveEstimateMin(null), 1);
  assert.equal(driveEstimateMin(undefined), 1);
  assert.equal(driveEstimateMin('junk'), 1);
  assert.equal(driveEstimateMin(NaN), 1);
});

test('arrivalLeadMin: driving adds 5 min to park, walking adds nothing', () => {
  assert.equal(PARK_MIN, 5);
  assert.equal(arrivalLeadMin(10, 'drive'), 15);
  assert.equal(arrivalLeadMin(10, undefined), 15, 'drive is the default');
  assert.equal(arrivalLeadMin(16, 'walk'), 16);
  assert.equal(arrivalLeadMin(null, 'drive'), null);
});

test('walkEstimateMin: 3 minutes to get moving, then 3 mph over a 1.25 detour', () => {
  assert.equal(walkEstimateMin(0.5), 16); // 3 + 0.625/3*60 = 15.5 -> 16
  assert.equal(walkEstimateMin(1), 28);   // 3 + 1.25/3*60  = 28
  assert.equal(walkEstimateMin(0), 3);
});

test('travelEstimateMin dispatches on mode, defaulting to drive', () => {
  assert.equal(travelEstimateMin(2, 'walk'), walkEstimateMin(2));
  assert.equal(travelEstimateMin(2, 'drive'), driveEstimateMin(2));
  assert.equal(travelEstimateMin(2), driveEstimateMin(2));
  assert.equal(travelEstimateMin(2, 'teleport'), driveEstimateMin(2));
});

test('formatEtaMin: minutes under an hour, h+mm past it, never seconds', () => {
  assert.equal(formatEtaMin(14), '14 min');
  assert.equal(formatEtaMin(59), '59 min');
  assert.equal(formatEtaMin(60), '1 h');
  assert.equal(formatEtaMin(70), '1 h 10');
  assert.equal(formatEtaMin(65), '1 h 05');
  assert.equal(formatEtaMin(130), '2 h 10');
  assert.equal(formatEtaMin(null), '');
});

// ---- arrivalVerdict: boundaries are the whole point ----
// A WED 16:00-18:00 window resolves to startAbs = 2*1440 + 960, endAbs = 2*1440 + 1080.
const WED_WIN = resolveWindow(venue({}, []), win(['WED'], '16:00', '18:00'))[0];

test('arrivalVerdict boundaries: end-20 makes it, end-19 is close, end misses', () => {
  const end = WED_WIN.endAbs;
  assert.equal(arrivalVerdict(end - 20 - 30, 30, WED_WIN), 'make', 'arrive exactly end-20');
  assert.equal(arrivalVerdict(end - 19 - 30, 30, WED_WIN), 'close', 'arrive end-19');
  assert.equal(arrivalVerdict(end - 1 - 30, 30, WED_WIN), 'close', 'arrive one minute before end');
  assert.equal(arrivalVerdict(end - 30, 30, WED_WIN), 'miss', 'arrive exactly at end');
  assert.equal(arrivalVerdict(end + 10 - 30, 30, WED_WIN), 'miss', 'arrive after end');
  assert.equal(MAKE_MARGIN_MIN, 20, 'the 20-minute margin is the documented contract');
});

test('the verdict uses drive + 5: a 10-minute drive leaving at end-30 cuts it close', () => {
  const end = WED_WIN.endAbs;
  const drive = 10;
  assert.equal(arrivalVerdict(end - 30, drive, WED_WIN), 'make', 'bare drive would arrive end-20');
  assert.equal(arrivalVerdict(end - 30, arrivalLeadMin(drive, 'drive'), WED_WIN), 'close', 'drive+5 arrives end-15');
  assert.equal(arrivalVerdict(end - 12, drive, WED_WIN), 'close', 'bare drive would arrive end-2');
  assert.equal(arrivalVerdict(end - 12, arrivalLeadMin(drive, 'drive'), WED_WIN), 'miss', 'drive+5 lands past the end');
  assert.equal(arrivalVerdict(end - 30, arrivalLeadMin(drive, 'walk'), WED_WIN), 'make', 'walk mode adds nothing');
});

test('arrivalVerdict: arriving before the window opens is early, not make', () => {
  const start = WED_WIN.startAbs;
  assert.equal(arrivalVerdict(start - 40, 10, WED_WIN), 'early', 'arrive 30 min before start');
  assert.equal(arrivalVerdict(start - 10, 10, WED_WIN), 'make', 'arrive exactly at start');
});

test('arrivalVerdict returns null with no estimate or no interval', () => {
  assert.equal(arrivalVerdict(1000, null, WED_WIN), null);
  assert.equal(arrivalVerdict(1000, undefined, WED_WIN), null);
  assert.equal(arrivalVerdict(1000, NaN, WED_WIN), null);
  assert.equal(arrivalVerdict(1000, 10, null), null);
});

test('arrivalVerdict matches a week-crossing window a week either side', () => {
  // SUN 22:00-02:00 resolves to endAbs past 10080; "now" is SUN 23:30 = 9930.
  const w = win(['SUN'], '22:00', '02:00');
  const iv = resolveWindow(venue({}, [w]), w)[0];
  assert.ok(iv.endAbs > 10080, 'precondition: the interval wraps past the week');
  const nowAbs = 6 * 1440 + 23 * 60 + 30;
  assert.equal(arrivalVerdict(nowAbs, 15, iv), 'make', 'arrive 23:45 SUN, ends 02:00 MON');
  assert.equal(arrivalVerdict(nowAbs, 160, iv), 'miss', 'arrive 02:10, past the end');
  // The same clock expressed on the far side of the wrap must land identically.
  assert.equal(arrivalVerdict(nowAbs - 10080, 15, iv), 'make');
});

test('activeOrNextInterval returns the live interval, else the soonest start', () => {
  const w = win(['WED'], '16:00', '18:00');
  const v = venue({}, [w]);
  assert.equal(activeOrNextInterval(v, w, dt('WED', 17, 0)).startAbs, WED_WIN.startAbs, 'live now');
  assert.equal(activeOrNextInterval(v, w, dt('WED', 15, 0)).startAbs, WED_WIN.startAbs, 'starts soon');
  const w2 = win(['MON', 'FRI'], '16:00', '18:00');
  const v2 = venue({}, [w2]);
  assert.equal(activeOrNextInterval(v2, w2, dt('WED', 12, 0)).day, 'FRI', 'Friday is nearer than next Monday');
});

// ---- navigation URLs: exact strings, 6 decimals, name URL-encoded ----
// v1.9 (fix9): navUrl returns {app, web, builtinFallback} and takes a platform. The .web
// half is what v1.8 shipped as the ONLY url — and shipping it as an <a target="_blank">
// is the bug TJ hit: "it navigates to the waze web page before opening up the app".
const NAV_VENUE = { id: 'v1', lat: 36.1770247, lon: -86.7877993, name: '312 Pizza Company',
  address: '371 Monroe St', city: 'Nashville' };

test('detectPlatform: android / ios / other from the user agent', () => {
  assert.equal(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/128'), 'android');
  assert.equal(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)'), 'ios');
  assert.equal(detectPlatform('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)'), 'ios');
  assert.equal(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'), 'other');
  assert.equal(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'other');
  assert.equal(detectPlatform(null), 'other');
  assert.deepEqual(NAV_PLATFORMS, ['android', 'ios', 'other']);
});

test('navUrl(*, other): no app to launch, so .app IS the https link', () => {
  assert.deepEqual(navUrl('waze', NAV_VENUE, 'other'), {
    app: 'https://waze.com/ul?ll=36.177025,-86.787799&navigate=yes',
    web: 'https://waze.com/ul?ll=36.177025,-86.787799&navigate=yes',
    builtinFallback: true,
  });
  assert.equal(navUrl('apple', NAV_VENUE, 'other').web,
    'https://maps.apple.com/?daddr=36.177025,-86.787799&q=312%20Pizza%20Company');
  assert.equal(navUrl('google', NAV_VENUE, 'other').web,
    'https://www.google.com/maps/dir/?api=1&destination=36.177025,-86.787799');
});

// TJ's phone. The intent: form is the whole fix — Chrome opens the app with no
// intermediate page, and falls back without one either.
test('navUrl(waze, android) is an intent: url with package= and an encoded fallback', () => {
  const u = navUrl('waze', NAV_VENUE, 'android');
  assert.equal(u.app,
    'intent://?ll=36.177025,-86.787799&navigate=yes#Intent;scheme=waze;package=com.waze' +
    ';S.browser_fallback_url=https%3A%2F%2Fwaze.com%2Ful%3Fll%3D36.177025%2C-86.787799%26navigate%3Dyes;end');
  assert.equal(u.web, 'https://waze.com/ul?ll=36.177025,-86.787799&navigate=yes');
  assert.equal(u.builtinFallback, true, 'intent: carries its own fallback');
  assert.match(u.app, /package=com\.waze/);
  // The fallback must be fully encoded: a raw ';' would terminate the intent block early
  // and a raw '&' would split it, so Chrome would parse a truncated fallback url.
  const fb = u.app.split('S.browser_fallback_url=')[1].replace(/;end$/, '');
  assert.ok(!/[;&?]/.test(fb), 'no unencoded ; & or ? survives inside the fallback url');
  assert.equal(decodeURIComponent(fb), u.web, 'and it decodes back to exactly the web url');
});

test('navUrl(google, android) targets the Maps package and encodes its fallback', () => {
  const u = navUrl('google', NAV_VENUE, 'android');
  assert.equal(u.app,
    'intent://maps.google.com/maps?daddr=36.177025,-86.787799&directionsmode=driving' +
    '#Intent;scheme=https;package=com.google.android.apps.maps' +
    ';S.browser_fallback_url=https%3A%2F%2Fwww.google.com%2Fmaps%2Fdir%2F%3Fapi%3D1%26destination%3D36.177025%2C-86.787799;end');
  assert.equal(u.builtinFallback, true);
  assert.match(u.app, /package=com\.google\.android\.apps\.maps/);
});

test('navUrl(geo, android) hands the system chooser the point — and has NO builtin fallback', () => {
  const u = navUrl('geo', NAV_VENUE, 'android');
  assert.equal(u.app, 'geo:36.177025,-86.787799?q=36.177025,-86.787799(312%20Pizza%20Company)');
  assert.equal(u.web, 'https://www.google.com/maps/dir/?api=1&destination=36.177025,-86.787799');
  assert.equal(u.builtinFallback, false, 'geo: fails silently, so the caller must time it');
});

test('navUrl(apple, android) degrades to geo: — Apple Maps is not installable there', () => {
  assert.equal(navUrl('apple', NAV_VENUE, 'android').app, navUrl('geo', NAV_VENUE, 'android').app);
});

test('navUrl(*, ios) uses bare schemes, none of which fall back on their own', () => {
  const waze = navUrl('waze', NAV_VENUE, 'ios');
  assert.equal(waze.app, 'waze://?ll=36.177025,-86.787799&navigate=yes');
  assert.equal(waze.web, 'https://waze.com/ul?ll=36.177025,-86.787799&navigate=yes');
  assert.equal(waze.builtinFallback, false);
  assert.equal(navUrl('apple', NAV_VENUE, 'ios').app,
    'maps://?daddr=36.177025,-86.787799&q=312%20Pizza%20Company');
  assert.equal(navUrl('google', NAV_VENUE, 'ios').app,
    'comgooglemaps://?daddr=36.177025,-86.787799&directionsmode=driving');
  assert.equal(navUrl('google', NAV_VENUE, 'ios').builtinFallback, false);
});

test('navUrl encodes names with ampersands and slashes, and falls back to Apple', () => {
  const v = { lat: 36.1, lon: -86.8, name: 'Fish & Chips / Bar' };
  assert.equal(navUrl('apple', v, 'other').web,
    'https://maps.apple.com/?daddr=36.100000,-86.800000&q=Fish%20%26%20Chips%20%2F%20Bar');
  assert.deepEqual(navUrl('nonsense', v, 'other'), navUrl('apple', v, 'other'),
    'unknown key falls back to Apple Maps');
  assert.equal(navUrl('geo', v, 'android').app,
    'geo:36.100000,-86.800000?q=36.100000,-86.800000(Fish%20%26%20Chips%20%2F%20Bar)',
    'the name inside geo:(...) is encoded, so a & cannot split the query');
});

test('navUrl returns empty urls for a venue with no coordinates, on every platform', () => {
  for (const p of NAV_PLATFORMS) {
    assert.deepEqual(navUrl('waze', { name: 'nowhere' }, p), { app: '', web: '', builtinFallback: false });
    assert.deepEqual(navUrl('waze', null, p), { app: '', web: '', builtinFallback: false });
    assert.deepEqual(navUrl('waze', { lat: 36.1, lon: null, name: 'half' }, p),
      { app: '', web: '', builtinFallback: false });
  }
});

test('NAV_APPS is the key registry; navApps() is what each platform offers', () => {
  assert.deepEqual(NAV_APPS.map((a) => a.key), ['waze', 'apple', 'google', 'geo']);
  assert.ok(isNavApp('waze') && isNavApp('apple') && isNavApp('google') && isNavApp('geo'));
  assert.equal(isNavApp('bing'), false);
  assert.equal(isNavApp(null), false);
  assert.deepEqual(navApps('android').map((a) => a.key), ['waze', 'google', 'geo']);
  assert.deepEqual(navApps('android').map((a) => a.label), ['Waze', 'Google Maps', 'Default maps app']);
  assert.deepEqual(navApps('ios').map((a) => a.label), ['Waze', 'Apple Maps', 'Google Maps']);
  assert.deepEqual(navApps('other').map((a) => a.label), ['Apple Maps', 'Google Maps', 'Waze web']);
  assert.deepEqual(navApps('nonsense'), navApps('other'), 'unknown platform is treated as desktop');
  // TJ already picked Waze on v1.8; that stored value must stay legal everywhere.
  for (const p of NAV_PLATFORMS) {
    assert.ok(navApps(p).some((a) => a.key === 'waze'), 'waze offered on ' + p);
  }
});

// ---- v1.9 C1: the control's markup. A `target` is exactly how v1.8 spawned the tab
// TJ could not get back out of, so the phone control must not carry one.
test('the Directions control is a <button> on phones, with no target and no href', () => {
  for (const p of ['android', 'ios']) {
    const html = navControlHtml(NAV_VENUE, 'card-addr', 'waze', p);
    assert.match(html, /^<button type="button" class="card-addr"/, p + ': is a button');
    assert.ok(!/target=/.test(html), p + ': carries no target');
    assert.ok(!/href=/.test(html), p + ': carries no href');
    assert.match(html, /data-nav-venue="v1"/);
    assert.match(html, /aria-label="Directions to 312 Pizza Company, 371 Monroe St, Nashville"/);
    assert.match(html, /<span class="addr-go">Directions ↗<\/span><\/button>$/);
  }
});

test('on desktop the Directions control stays an <a> to the https map', () => {
  const html = navControlHtml(NAV_VENUE, 'surprise-addr', 'google', 'other');
  assert.match(html, /^<a href="https:\/\/www\.google\.com\/maps\/dir\/\?api=1&amp;destination=36\.177025,-86\.787799" target="_blank" rel="noopener" class="surprise-addr"/);
  assert.match(html, /<\/a>$/);
});

test('the Directions control is empty without an address or coordinates', () => {
  assert.equal(navControlHtml({ id: 'x', lat: 1, lon: 2, name: 'n' }, 'card-addr', 'waze', 'android'), '');
  assert.equal(navControlHtml({ id: 'x', address: 'somewhere', name: 'n' }, 'card-addr', 'waze', 'android'), '');
  assert.equal(navControlHtml(null, 'card-addr', 'waze', 'android'), '');
});

test('chooser picks are buttons on phones and links on desktop', () => {
  const waze = { key: 'waze', label: 'Waze' };
  for (const p of ['android', 'ios']) {
    const html = navPickHtml(waze, NAV_VENUE, p);
    assert.equal(html, '<button type="button" class="nav-pick" data-nav-pick="waze">Waze</button>');
    assert.ok(!/target=/.test(html), p + ': chooser pick carries no target either');
  }
  assert.equal(navPickHtml(waze, NAV_VENUE, 'other'),
    '<a class="nav-pick" data-nav-pick="waze" href="https://waze.com/ul?ll=36.177025,-86.787799&amp;navigate=yes"' +
    ' target="_blank" rel="noopener">Waze</a>');
});

// ---- v1.9 C1: the "didn't open?" fallback line ----
test('shouldShowNavFallback: only while the page is still on screen', () => {
  assert.equal(shouldShowNavFallback('visible'), true);
  assert.equal(shouldShowNavFallback('hidden'), false);
  assert.equal(shouldShowNavFallback('prerender'), false);
  assert.equal(NAV_FALLBACK_MS, 1200);
});

test('fallback line appears when the page stays visible past the timer', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let shown = 0;
  armNavFallbackTimer({
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    visibility: () => 'visible',
    show: () => { shown++; },
  });
  t.mock.timers.tick(NAV_FALLBACK_MS - 1);
  assert.equal(shown, 0, 'not before 1.2s');
  t.mock.timers.tick(1);
  assert.equal(shown, 1, 'shown at 1.2s — nothing ever came forward');
});

test('fallback line does NOT appear when visibilitychange to hidden fires first', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let shown = 0;
  const cancel = armNavFallbackTimer({
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    visibility: () => 'hidden',
    show: () => { shown++; },
  });
  cancel(); // what document.addEventListener('visibilitychange', clearNavFallback) does
  t.mock.timers.tick(NAV_FALLBACK_MS * 2);
  assert.equal(shown, 0, 'the app opened, so no dead-button line');
  cancel(); // cancelling twice must not throw
});

test('a fallback timer that fires while hidden still shows nothing', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let shown = 0;
  armNavFallbackTimer({
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    visibility: () => 'hidden', // the event was missed, but the state is still the truth
    show: () => { shown++; },
  });
  t.mock.timers.tick(NAV_FALLBACK_MS);
  assert.equal(shown, 0);
});

test('defaultNavApp: Apple on Apple platforms, Google everywhere else', () => {
  assert.equal(defaultNavApp('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iPhone'), 'apple');
  assert.equal(defaultNavApp('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'MacIntel'), 'apple');
  assert.equal(defaultNavApp('Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X)', 'MacIntel'), 'apple');
  assert.equal(defaultNavApp('Mozilla/5.0 (Linux; Android 14; Pixel 8)', 'Linux armv8l'), 'google');
  assert.equal(defaultNavApp('Mozilla/5.0 (Windows NT 10.0; Win64; x64)', 'Win32'), 'google');
  assert.equal(defaultNavApp(null, null), 'google');
});

// ==================== v1.10 C1: schema 2 validator ====================
function v2file(venues) { return { schema_version: 2, generated: '2026-10-23', venues }; }
function v2venue(extra) {
  return Object.assign({
    id: 'ik-1', name: 'Test', lat: 36.16, lon: -86.78, hood: 'SoBro', zone: 'downtown',
    tz: 'America/Chicago', inkind: true, status: 'open', hours: {}, windows: [], verified_no_hh: true,
  }, extra);
}

test('validateVenues v2: the real venues.json passes', () => {
  assert.deepEqual(validateVenues(require(path.join(__dirname, '..', 'venues.json'))), []);
});

test('validateVenues v2: schema_version must be 2 (1 is now rejected)', () => {
  assert.deepEqual(validateVenues(v2file([v2venue()])), []);
  const old = v2file([v2venue()]); old.schema_version = 1;
  assert.ok(validateVenues(old).some((e) => /schema_version must be 2/.test(e)));
});

test('validateVenues v2: windows [] with verified_no_hh false = "happy hour not checked yet", valid', () => {
  assert.deepEqual(validateVenues(v2file([v2venue({ verified_no_hh: false })])), []);
});

test('validateVenues v2: verified_no_hh true next to a happy_hour window is the one contradiction', () => {
  const errs = validateVenues(v2file([v2venue({ windows: [win(['MON'], '16:00', '18:00')] })]));
  assert.ok(errs.some((e) => /verified_no_hh is true but the venue has a happy_hour window/.test(e)), errs.join('\n'));
  assert.deepEqual(validateVenues(v2file([v2venue({ verified_no_hh: false, windows: [win(['MON'], '16:00', '18:00')] })])), []);
});

test('validateVenues v2: a lunch-only or special-only venue can be verified no-HH', () => {
  assert.deepEqual(validateVenues(v2file([v2venue({ windows: [win(['MON'], '11:00', '14:00', { kind: 'lunch' })] })])), []);
  assert.deepEqual(validateVenues(v2file([v2venue({ windows: [win(['TUE'], '17:00', '21:00', { kind: 'special' })] })])), []);
});

test('validateVenues v2: kind may be lunch; anything else outside the three is still invalid', () => {
  const bad = validateVenues(v2file([v2venue({ verified_no_hh: false, windows: [win(['MON'], '10:00', '14:00', { kind: 'brunch' })] })]));
  assert.ok(bad.some((e) => /kind invalid/.test(e)));
});

test('validateVenues v2: optional hours_confidence / hours_notes / lunch_checked are type-checked when present', () => {
  assert.deepEqual(validateVenues(v2file([v2venue({ hours_confidence: 'med', hours_notes: 'x', lunch_checked: false })])), []);
  const errs = validateVenues(v2file([v2venue({ hours_confidence: 'maybe', hours_notes: 3, lunch_checked: 'yes' })]));
  assert.ok(errs.some((e) => /hours_confidence must be high\|med\|low/.test(e)));
  assert.ok(errs.some((e) => /hours_notes must be a string/.test(e)));
  assert.ok(errs.some((e) => /lunch_checked must be boolean/.test(e)));
});

// ==================== v1.10 C3: kind "lunch" ====================
test('isAllDay: a lunch window is never all-day, even long (gated on special only)', () => {
  const v = venue({}, []);
  assert.equal(isAllDay(v, win(['MON'], '10:00', '17:00', { kind: 'lunch' })), false);
  assert.equal(isAllDay(v, win(['MON'], '10:00', '17:00', { kind: 'special' })), true);
});

test('lunch windows resolve, go live and start soon exactly like any other window', () => {
  const w = win(['MON', 'TUE'], '11:00', '14:30', { kind: 'lunch' });
  const v = venue({}, [w]);
  assert.equal(isActive(v, w, dt('TUE', 12, 0)), true);
  assert.equal(isActive(v, w, dt('TUE', 14, 30)), false);
  assert.equal(startsWithin(v, w, dt('TUE', 10, 0), 120, { excludeAllDay: true }), true);
});

test('surprisePools: lunch is treated like special — out of both pools (Surprise me promises a happy hour)', () => {
  const lunch = Object.assign(venue({}, [win(['TUE'], '11:00', '14:30', { kind: 'lunch' })]), { id: 'ik-9', name: 'L' });
  const pools = surprisePools([lunch], dt('TUE', 12, 0));
  assert.equal(pools.now.length, 0);
  assert.equal(pools.later.length, 0);
});

// ==================== v1.10 C2: the venue's own hours ====================
const SPLIT = { MON: [['11:00', '14:30'], ['17:00', '22:00']], TUE: [['11:00', '14:30'], ['17:00', '22:00']] };

test('hoursStatus: split day — open at lunch, closed-between in the gap, open at dinner, done after', () => {
  const v = venue(SPLIT);
  assert.deepEqual(hoursStatus(v, dt('TUE', 12, 0)), { state: 'open', closes: '14:30' });
  assert.deepEqual(hoursStatus(v, dt('TUE', 15, 0)), { state: 'closed-between', closedFrom: '14:30', opens: '17:00' });
  assert.deepEqual(hoursStatus(v, dt('TUE', 18, 0)), { state: 'open', closes: '22:00' });
  assert.deepEqual(hoursStatus(v, dt('TUE', 22, 30)), { state: 'closed-for-the-day' });
  assert.deepEqual(hoursStatus(v, dt('TUE', 9, 0)), { state: 'closed-opens-later', opens: '11:00' });
});

test('hoursStatus: minute boundaries — the open minute is open, the close minute is closed', () => {
  const v = venue(SPLIT);
  assert.equal(hoursStatus(v, dt('TUE', 10, 59)).state, 'closed-opens-later');
  assert.equal(hoursStatus(v, dt('TUE', 11, 0)).state, 'open');
  assert.equal(hoursStatus(v, dt('TUE', 14, 29)).state, 'open');
  assert.equal(hoursStatus(v, dt('TUE', 14, 30)).state, 'closed-between');
  assert.equal(hoursStatus(v, dt('TUE', 16, 59)).state, 'closed-between');
  assert.equal(hoursStatus(v, dt('TUE', 17, 0)).state, 'open');
  assert.equal(hoursStatus(v, dt('TUE', 21, 59)).state, 'open');
  assert.equal(hoursStatus(v, dt('TUE', 22, 0)).state, 'closed-for-the-day');
});

test('hoursStatus: a close past midnight ends on D+1, and yesterday\'s late range is open now', () => {
  const v = venue({ FRI: [['17:00', '02:00']], SAT: [['17:00', '02:00']] });
  assert.deepEqual(hoursStatus(v, dt('FRI', 23, 0)), { state: 'open', closes: '02:00' });
  // 01:00 Saturday belongs to Friday's range.
  assert.deepEqual(hoursStatus(v, dt('SAT', 1, 0)), { state: 'open', closes: '02:00' });
  assert.equal(hoursStatus(v, dt('SAT', 1, 59)).state, 'open');
  // 02:00 Saturday: Friday's range is over and Saturday's has not begun.
  assert.deepEqual(hoursStatus(v, dt('SAT', 2, 0)), { state: 'closed-opens-later', opens: '17:00' });
  // 01:00 Sunday: Saturday's range still running, though Sunday itself has no hours.
  assert.deepEqual(hoursStatus(v, dt('SUN', 1, 0)), { state: 'open', closes: '02:00' });
  assert.deepEqual(hoursStatus(v, dt('SUN', 3, 0)), { state: 'closed-today' });
});

test('hoursStatus: the week wraps — Sunday night past midnight is open on Monday 00:30', () => {
  const v = venue({ SUN: [['18:00', '01:00']] });
  assert.deepEqual(hoursStatus(v, dt('MON', 0, 30)), { state: 'open', closes: '01:00' });
  assert.deepEqual(hoursStatus(v, dt('MON', 1, 0)), { state: 'closed-today' });
});

test('hoursStatus: back-to-back ranges are one stretch (no fake 3pm close)', () => {
  const v = venue({ MON: [['11:00', '15:00'], ['15:00', '22:00']] });
  assert.deepEqual(hoursStatus(v, dt('MON', 14, 0)), { state: 'open', closes: '22:00' });
});

test('hoursStatus: closed-today when the day is absent; no-hours when nothing is on file', () => {
  assert.deepEqual(hoursStatus(venue(SPLIT), dt('WED', 12, 0)), { state: 'closed-today' });
  assert.deepEqual(hoursStatus(venue({}), dt('WED', 12, 0)), { state: 'no-hours' });
  assert.deepEqual(hoursStatus({ windows: [] }, dt('WED', 12, 0)), { state: 'no-hours' });
});

test('hoursStatus: a range ending at 00:00 runs to midnight', () => {
  const v = venue({ THU: [['16:00', '00:00']] });
  assert.deepEqual(hoursStatus(v, dt('THU', 23, 59)), { state: 'open', closes: '00:00' });
  assert.deepEqual(hoursStatus(v, dt('FRI', 0, 0)), { state: 'closed-today' });
});

test('weekHours: seven days MON..SUN, ranges sorted, closed days empty, split days kept as two', () => {
  const wk = weekHours(venue({ TUE: [['17:00', '22:00'], ['11:00', '14:30']], SAT: [['17:00', '02:00']] }));
  assert.deepEqual(wk.map((d) => d.day), ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']);
  assert.deepEqual(wk[0].ranges, []);
  assert.deepEqual(wk[1].ranges, [['11:00', '14:30'], ['17:00', '22:00']]);
  assert.deepEqual(wk[5].ranges, [['17:00', '02:00']]);
  assert.equal(weekHours(venue({})), null);
});

test('hoursStatus/weekHours: the real Jashan record gives the block\'s "Closed 2:30-5pm" state', () => {
  const j = REAL.find((v) => v.name === 'Jashan');
  assert.deepEqual(hoursStatus(j, dt('TUE', 15, 0)), { state: 'closed-between', closedFrom: '14:30', opens: '17:00' });
  assert.equal(weekHours(j).filter((d) => d.ranges.length === 2).length, 7);
});

test('hoursSourceInfo: the three hours_source shapes the 2026-10-23 refresh writes', () => {
  assert.deepEqual(hoursSourceInfo({ hours_source: 'researched 2026-10-23 (high confidence): https://www.jashannashville.com/hours', hours_confidence: 'high' }),
    { from: 'jashannashville.com', date: '2026-10-23', unconfirmed: false });
  assert.deepEqual(hoursSourceInfo({ hours_source: 'inKind map API 2026-09-05 (not re-confirmed 2026-10-23; inKind no longer publishes hours)', hours_confidence: 'low' }),
    { from: 'inKind listing', date: '2026-09-05', unconfirmed: true });
  assert.deepEqual(hoursSourceInfo({ hours_source: 'researched 2026-10-23 (low confidence): ', hours_confidence: 'low' }),
    { from: 'researched', date: '2026-10-23', unconfirmed: true });
  assert.deepEqual(hoursSourceInfo({ hours_source: 'none found 2026-10-23', hours_confidence: 'low' }),
    { from: 'none found', date: '2026-10-23', unconfirmed: true });
});


// ---- v1.11 C3: open-hours bands on the Day Grid ----
// Axis as the grid draws it: 11:00 to 26:00 (2am next day).
const AX0 = 11 * 60, AX1 = 26 * 60;

test('openBands: a split day is two bands with the gap between them', () => {
  const v = venue({ TUE: [['11:00', '14:00'], ['16:30', '21:00']] });
  assert.deepEqual(openBands(v, 'TUE', AX0, AX1), [{ start: 660, end: 840 }, { start: 990, end: 1260 }]);
});

test('openBands: an early open clips flush to the axis start; a close past midnight runs to its real close', () => {
  assert.deepEqual(openBands(venue({ FRI: [['07:30', '20:30']] }), 'FRI', AX0, AX1), [{ start: 660, end: 1230 }]);
  assert.deepEqual(openBands(venue({ FRI: [['16:00', '01:30']] }), 'FRI', AX0, AX1), [{ start: 960, end: 1530 }]);
  assert.deepEqual(openBands(venue({ FRI: [['16:00', '04:00']] }), 'FRI', AX0, AX1), [{ start: 960, end: 1560 }]);
});

test('openBands: back-to-back ranges are one band; tomorrow\'s 00:00 open joins tonight\'s', () => {
  assert.deepEqual(openBands(venue({ TUE: [['11:00', '15:00'], ['15:00', '22:00']] }), 'TUE', AX0, AX1), [{ start: 660, end: 1320 }]);
  assert.deepEqual(openBands(venue({ TUE: [['17:00', '00:00']], WED: [['00:00', '01:00']] }), 'TUE', AX0, AX1), [{ start: 1020, end: 1500 }]);
});

test('openBands: closed that day = []; no hours on file = null (no band)', () => {
  assert.deepEqual(openBands(venue({ FRI: [['17:00', '22:00']] }), 'MON', AX0, AX1), []);
  assert.equal(openBands(venue({}), 'MON', AX0, AX1), null);
});

test('openBands: the real Mr. J\'s Original - Nashville on FRI is 9am (clipped to 11am) to 8:30pm', () => {
  const mj = REAL.find((v) => v.name === "Mr. J's Original - Nashville");
  assert.deepEqual(openBands(mj, 'FRI', AX0, AX1), [{ start: 660, end: 1230 }]);
});

test('openBands and hoursStatus agree on the real Chauhan (TUE 11-2, 4:30-9)', () => {
  const c = REAL.find((v) => v.name === 'Chauhan Ale & Masala House');
  assert.deepEqual(openBands(c, 'TUE', AX0, AX1), [{ start: 660, end: 840 }, { start: 990, end: 1260 }]);
  assert.deepEqual(hoursStatus(c, dt('TUE', 17, 0)), { state: 'open', closes: '21:00' });
  assert.deepEqual(hoursStatus(c, dt('TUE', 15, 0)), { state: 'closed-between', closedFrom: '14:00', opens: '16:30' });
});

// ---- v1.11 C4: closed-day lint ----
function lintVenue(hours, windows) {
  return lintVenues({ venues: [{ name: 'X', hours: hours, windows: windows }] });
}
const hhWin = (days) => ({ kind: 'happy_hour', days: days, start: '16:00', end: '18:00', deals: [] });

test('lint closed-day: a window on a day the hours leave out warns, once per day', () => {
  const week = { TUE: [['11:00', '22:00']], WED: [['11:00', '22:00']], THU: [['11:00', '22:00']] };
  assert.deepEqual(lintVenue(week, [hhWin(['MON', 'TUE'])]), ['X: happy_hour window on MON but hours say closed']);
  assert.deepEqual(lintVenue(week, [hhWin(['TUE', 'WED'])]), []);
});

test('lint closed-day: hours for 2 or fewer days plus a window elsewhere also warns "may be incomplete"', () => {
  assert.deepEqual(lintVenue({ FRI: [['11:00', '22:00']], SAT: [['11:00', '22:00']] }, [hhWin(['TUE', 'FRI'])]), [
    'X: happy_hour window on TUE but hours say closed',
    'X: hours on file for only FRI/SAT but a window on TUE (hours may be incomplete)',
  ]);
  assert.deepEqual(lintVenue({ FRI: [['11:00', '22:00']], SAT: [['11:00', '22:00']] }, [hhWin(['FRI'])]), []);
});

test('lint closed-day: no hours on file is skipped (the card already says so)', () => {
  assert.deepEqual(lintVenue({}, [hhWin(['MON'])]), []);
  assert.deepEqual(lintVenue(undefined, [hhWin(['MON'])]), []);
});

test('lint closed-day: the shipped data warns only where the sources disagree', () => {
  const data = require(path.join(__dirname, '..', 'venues.json'));
  assert.deepEqual(lintVenues(data).filter((w) => /hours say closed|may be incomplete/.test(w)).sort(), [
    // v1.24 data step (TJ ruling): Fortuna open Monday, ZuZu's happy hour Tue–Fri.
    'The Side Piece Nashville: happy_hour window on TUE but hours say closed',
  ]);
});


// ==================== v1.12 (fix12) ====================

// ---- C2: dealPriceLabel ----
test('dealPriceLabel: a price the text already says is dropped (every number in it is in the text)', () => {
  assert.equal(dealPriceLabel({ desc: '$2 off draft beer', price: '-$2' }), null);
  assert.equal(dealPriceLabel({ desc: '$10 12" cheese pizzas and $19 deep dish', price: '$10/$19' }), null);
  assert.equal(dealPriceLabel({ desc: '$11 cocktails', price: '$11.00' }), null, 'numbers compare by value');
  assert.equal(dealPriceLabel({ desc: 'Cocktails $11', price: '$4.25-$11.00' }), '$4.25-$11.00', 'one number missing = shown');
});

test('dealPriceLabel: a wordy price the text contains (case and spacing ignored) is dropped', () => {
  assert.equal(dealPriceLabel({ desc: 'Half Price wings', price: 'half price' }), null);
  assert.equal(dealPriceLabel({ desc: '2-for-1 wells', price: '2-for-1' }), null);
  assert.equal(dealPriceLabel({ desc: 'Free chips and salsa', price: 'free' }), null);
  assert.equal(dealPriceLabel({ desc: 'Wings', price: 'half price' }), 'half price', 'a wordy price is not vacuously "all numbers present"');
});

test('dealPriceLabel: otherwise the price, with a leading minus read as "off"', () => {
  assert.equal(dealPriceLabel({ desc: 'Smashburger', price: '$7' }), '$7');
  assert.equal(dealPriceLabel({ desc: 'Wings', price: '-$2' }), '$2 off');
  assert.equal(dealPriceLabel({ desc: 'Bottles of wine', price: '-50%' }), '50% off');
  assert.equal(dealPriceLabel({ desc: 'Draft beer', price: '$2.99-$3.99' }), '$2.99-$3.99', 'an inner dash is a range, not a discount');
  assert.equal(dealPriceLabel({ desc: 'Bento box lunch', price: null }), null);
  assert.equal(dealPriceLabel({ desc: 'Bento box lunch', price: '' }), null);
});

// v1.14: 413/334 on the v1.13 data; the 2026-10-25j windows add 27 priced deals, 26 shown.
// v1.20 (2026-10-25m data): the two "$12 Tuesday" deals are gone (440 -> 438), and The Authentique's
// "Half-price crepes" no longer carries a 50 in its text, so its "50% off" price shows (360 -> 361).
// v1.21 (2026-10-25n data): the 7 Blue Coast family nights take 12 priced deals, all shown (438 -> 426,
// 361 -> 349); The Authentique's crepes now read "All crepes" + "50% off".
// v1.24 data step: the Detroit Cowboy patio window (4 priced deals, all shown) is gone: 426/349 -> 422/345.
test('dealPriceLabel: measured on venues.json — 422 priced deals, 345 still show a price', () => {
  let priced = 0, shown = 0;
  REAL.forEach((v) => v.windows.forEach((w) => w.deals.forEach((d) => {
    if (d.price) priced++;
    if (dealPriceLabel(d) !== null) shown++;
  })));
  assert.equal(priced, 422);
  assert.equal(shown, 345);
  const auth = REAL.find((v) => v.name === 'The Authentique').windows.find((w) => w.kind === 'special');
  assert.deepEqual(auth.deals.map((d) => [d.desc, dealPriceLabel(d)]), [['All crepes', '50% off']]);
  const dog = REAL.find((v) => v.name === 'Dog Haus - East Nashville (Biergarten)');
  assert.deepEqual(dog.windows[0].deals.map(dealPriceLabel), [null, null, null, null, null]);
});

// ---- C8: formatDays ----
test('formatDays: runs of three or more as ranges, pairs stay pairs, all seven = Daily', () => {
  assert.equal(formatDays(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']), 'Mon–Sat');
  assert.equal(formatDays(['MON', 'WED', 'THU', 'FRI']), 'Mon, Wed–Fri');
  assert.equal(formatDays(['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']), 'Daily');
  assert.equal(formatDays(['SAT', 'SUN']), 'Sat, Sun');
  assert.equal(formatDays(['TUE']), 'Tue');
  assert.equal(formatDays(['MON', 'TUE', 'THU', 'SAT', 'SUN']), 'Mon, Tue, Thu, Sat, Sun');
  assert.equal(formatDays(['SUN', 'MON']), 'Mon, Sun', 'week order, no wrap past Sunday');
});

// ---- C3: temporary closures (Punk Wok, Oct 26-28) ----
function nowAt(iso) {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
  const y = +m[1], mo = +m[2], d = +m[3];
  const dow = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'][new Date(Date.UTC(y, mo - 1, d)).getUTCDay()];
  return { year: y, month: mo, day: d, hour: +m[4], minute: +m[5], dayOfWeek: dow };
}
const PUNK = REAL.find((v) => v.name === 'Punk Wok');
const PUNK_LUNCH = PUNK.windows.find((w) => w.kind === 'lunch');
const PUNK_HH = PUNK.windows.find((w) => w.kind === 'happy_hour');

test('hoursStatus: Punk Wok is temp-closed on Oct 28, open on Oct 29 and Oct 25', () => {
  assert.deepEqual(hoursStatus(PUNK, nowAt('2026-10-28T12:00')),
    { state: 'temp-closed', until: '2026-10-29', untilDay: 'THU', note: 'Short break; reopens Thu Oct 29' });
  assert.deepEqual(hoursStatus(PUNK, nowAt('2026-10-29T12:00')), { state: 'open', closes: '21:00' });
  assert.deepEqual(hoursStatus(PUNK, nowAt('2026-10-25T12:00')), { state: 'open', closes: '21:00' });
  assert.equal(hoursStatus(PUNK, nowAt('2026-10-26T12:00')).state, 'temp-closed', 'first day, inclusive');
  assert.equal(hoursStatus(PUNK, nowAt('2026-10-27T12:00')).state, 'temp-closed', 'wins over its own closed Tuesday');
});

test('temp closures: windows on closed dates are not live, not soon, not in Surprise me', () => {
  const t28 = nowAt('2026-10-28T12:00'), t29 = nowAt('2026-10-29T12:00'), t25 = nowAt('2026-10-25T12:00');
  assert.equal(isActive(PUNK, PUNK_LUNCH, t28), true, 'the window itself still resolves');
  assert.equal(windowTempClosedNow(PUNK, PUNK_LUNCH, t28), true);
  assert.equal(windowTempClosedNow(PUNK, PUNK_LUNCH, t29), false);
  assert.equal(windowTempClosedNow(PUNK, PUNK_HH, t25), false);
  const inPool = (pool) => pool.some((c) => c.venue.name === 'Punk Wok');
  assert.equal(inPool(surprisePools([PUNK], nowAt('2026-10-28T15:30')).now), false, 'live HH on Oct 28 is out');
  assert.equal(inPool(surprisePools([PUNK], nowAt('2026-10-28T14:00')).now), false, 'starting-soon HH on Oct 28 is out');
  assert.equal(inPool(surprisePools([PUNK], nowAt('2026-10-29T15:30')).now), true);
  assert.equal(inPool(surprisePools([PUNK], nowAt('2026-10-25T15:30')).now), true);
  assert.equal(inPool(surprisePools([PUNK], nowAt('2026-10-25T12:00'), { day: 'MON' }).later), false, 'grid Monday = Oct 26');
  assert.equal(inPool(surprisePools([PUNK], nowAt('2026-10-25T12:00'), { day: 'THU' }).later), true, 'grid Thursday = Oct 29');
});

test('temp closures: dates map from weekdays both ways, and past ranges are ignored', () => {
  assert.equal(dateOfDay(nowAt('2026-10-25T12:00'), 'MON', 1), '2026-10-26');
  assert.equal(dateOfDay(nowAt('2026-10-25T12:00'), 'SUN', 1), '2026-10-25');
  assert.equal(dateOfDay(nowAt('2026-10-29T01:00'), 'WED', -1), '2026-10-28', 'a window running past midnight started yesterday');
  assert.equal(dateOfDay(nowAt('2026-12-31T12:00'), 'FRI', 1), '2027-01-01');
  assert.equal(tempClosedFor(PUNK, nowAt('2026-11-02T12:00'), 'MON', 1), false);
  assert.equal(tempClosureOn(PUNK, '2026-10-29'), null);
  assert.equal(tempClosedFor(PUNK, dt('WED', 12, 0, {}), 'WED', 1), false, 'no calendar date = no closure check');
});

test('validateVenues v2: temp_closed and research_notes are type-checked', () => {
  const base = JSON.parse(JSON.stringify(PUNK));
  const errs = (patch) => validateVenues(v2file([Object.assign(JSON.parse(JSON.stringify(base)), patch)]));
  assert.deepEqual(errs({}), []);
  assert.ok(errs({ temp_closed: {} }).some((e) => /temp_closed must be an array/.test(e)));
  assert.ok(errs({ temp_closed: [{ from: '2026-10-28', to: '2026-10-26', note: '', source: 'https://x.test' }] }).some((e) => /from must be <= to/.test(e)));
  assert.ok(errs({ temp_closed: [{ from: '10/26', to: '2026-10-28', note: '', source: 'https://x.test' }] }).some((e) => /from must be YYYY-MM-DD/.test(e)));
  assert.ok(errs({ temp_closed: [{ from: '2026-10-26', to: '2026-10-28', note: 3, source: 'https://x.test' }] }).some((e) => /note must be a string/.test(e)));
  assert.ok(errs({ temp_closed: [{ from: '2026-10-26', to: '2026-10-28', note: '', source: 'wsmv' }] }).some((e) => /source must be a URL/.test(e)));
  const w = JSON.parse(JSON.stringify(base.windows));
  w[1].research_notes = 7;
  assert.ok(errs({ windows: w }).some((e) => /research_notes must be a string/.test(e)));
});

// ---- C4: deals outside posted hours ----
test('outsideHoursDays: a 1-hour early start (ZuZu-style) and a deal in the lunch-dinner gap (The Southern-style)', () => {
  const zuzu = venue({ TUE: [['17:00', '23:00']], WED: [['16:00', '23:00']] }, []);
  assert.deepEqual(outsideHoursDays(zuzu, win(['TUE', 'WED'], '16:00', '18:00')), ['TUE']);
  const southern = venue({ FRI: [['11:00', '15:00'], ['17:00', '22:00']] }, []);
  assert.deepEqual(outsideHoursDays(southern, win(['FRI'], '15:00', '17:00')), ['FRI'], 'wholly in the gap');
  assert.deepEqual(outsideHoursDays(southern, win(['FRI'], '14:00', '18:00')), ['FRI'], 'spans the gap');
  assert.deepEqual(outsideHoursDays(southern, win(['FRI'], '17:00', '19:00')), []);
  assert.deepEqual(outsideHoursDays(southern, win(['FRI'], '15:00', 'close')), ['FRI'], 'close = the last close, across the gap');
});

test('outsideHoursDays: back-to-back ranges are one stretch, past-midnight closes count, closed days and no hours are not this case', () => {
  assert.deepEqual(outsideHoursDays(venue({ MON: [['11:00', '15:00'], ['15:00', '22:00']] }, []), win(['MON'], '14:00', '16:00')), []);
  assert.deepEqual(outsideHoursDays(venue({ FRI: [['17:00', '02:00']] }, []), win(['FRI'], '23:00', '01:00')), []);
  assert.deepEqual(outsideHoursDays(venue({ FRI: [['17:00', '00:30']] }, []), win(['FRI'], '23:00', '01:00')), ['FRI']);
  assert.deepEqual(outsideHoursDays(venue({ MON: [['11:00', '22:00']] }, []), win(['TUE'], '16:00', '18:00')), [], 'closed day = Hours conflict');
  assert.deepEqual(outsideHoursDays(venue({}, []), win(['TUE'], '06:00', '08:00')), []);
});

// v1.14 (2026-10-25j data, Google-listing hours): JBJ's Sunday and The Southern are gone
// (now inside posted hours); Present Tense moves SUN -> THU; Acme (low, Google and its
// site disagree), LinQ, NoWhere Special and The Side Piece are new. 10 venues, 12 windows.
// v1.24 data step (TJ ruling): Acme Monday hours, Detroit Cowboy patio window and ZuZu's times no longer warn.
test('outside-hours lint: measured on venues.json — 7 venues, 9 windows (v1.14, v1.24 data)', () => {
  const lines = REAL.flatMap(lintOutsideHours);
  assert.deepEqual(lines, [
    '51 North Taproom: happy_hour window 11:00–23:00 outside posted hours on MON',
    '51 North Taproom: special window 11:00–23:00 outside posted hours on WED',
    '51 North Taproom: special window 11:00–23:00 outside posted hours on THU',
    'Brugada Kitchen & Bar: happy_hour window 16:00–18:00 outside posted hours on TUE/WED/THU',
    'LinQ Social Kitchen: happy_hour window 16:00–21:00 outside posted hours on FRI',
    'NoWhere Special: happy_hour window 16:00–19:00 outside posted hours on FRI',
    'Present Tense: happy_hour window 16:00–17:30 outside posted hours on THU',
    'The Side Piece Nashville: happy_hour window 15:00–18:00 outside posted hours on WED',
    'Verna Café & Bar: happy_hour window 15:00–18:00 outside posted hours on MON/THU/FRI/SAT/SUN',
  ]);
  assert.ok(lintVenues({ venues: REAL }).some((l) => /outside posted hours/.test(l)), 'runs inside lintVenues');
});

// ---- C5: the Day Grid axis ----
test('gridAxisStart: 11am unless a shown window starts earlier; rounded down to the hour; never before 6am', () => {
  assert.equal(gridAxisStart([]), 660);
  assert.equal(gridAxisStart([900, 1020]), 660);
  assert.equal(gridAxisStart([420, 900]), 420, 'Loading Dock 7am');
  assert.equal(gridAxisStart([450]), 420, '7:30 -> 7am');
  assert.equal(gridAxisStart([659]), 600);
  assert.equal(gridAxisStart([600, 480]), 480, 'the earliest wins, in any order');
  assert.equal(gridAxisStart([300]), 360, 'floor 6am');
  assert.equal(gridAxisStart([660]), 660);
});

// ==================== v1.13 ====================
// C3: only windows drawn as normal blocks set the Day Grid's left edge.
test('gridBlockStarts (v1.13 C3): all-day bars and temp-closed rows do not count', () => {
  const allDay8 = venue({}, [win(['SAT'], '08:00', '17:00', { kind: 'special' })]); // 9h: all-day bar
  const hh9 = venue({}, [win(['SAT'], '09:00', '11:00', { kind: 'happy_hour' })]);
  const dock7 = venue({}, [win(['SAT'], '07:00', '09:00', { kind: 'special' })]); // 2h: a block
  const base = 5 * 1440;
  const row = (v, closed) => ({ venue: v, closed: !!closed, items: resolveWindow(v, v.windows[0]).filter((iv) => iv.day === 'SAT').map((iv) => ({ win: v.windows[0], startAbs: iv.startAbs })) });
  assert.deepEqual(gridBlockStarts([row(allDay8), row(hh9)], base), [540]);
  assert.equal(gridAxisStart(gridBlockStarts([row(allDay8), row(hh9)], base)), 540, 'axis at 9am, not 8am');
  assert.equal(gridAxisStart(gridBlockStarts([row(allDay8)], base)), 660, 'an all-day bar alone leaves 11am');
  assert.equal(gridAxisStart(gridBlockStarts([row(dock7), row(hh9)], base)), 420, 'a short 7am special is a block');
  assert.equal(gridAxisStart(gridBlockStarts([row(dock7, true), row(hh9)], base)), 540, 'a closed row does not count');
  assert.deepEqual(gridBlockStarts([], base), []);
});

// C4: the NOW empty state never names a start on a temp-closed date.
test('nextStartAcrossVenues (v1.13 C4): skips Punk Wok on its break (dead hour Mon Oct 26, 10pm)', () => {
  const dead = nowAt('2026-10-26T22:00');
  const plain = nextStart(PUNK, dead);
  assert.equal(plain.day, 'WED', 'documents the old answer: Wed Oct 28 11am, a closed date');
  const solo = nextStartAcrossVenues([PUNK], dead, { excludeAllDay: true });
  assert.equal(solo.next.day, 'THU', 'first open date is Thu Oct 29');
  assert.equal(solo.next.start, '11:00');
  const other = venue({}, [win(['WED'], '16:00', '18:00', { kind: 'happy_hour' })]);
  const best = nextStartAcrossVenues([PUNK, other], dead, { excludeAllDay: true });
  assert.equal(best.venue, other, 'Wed 4pm elsewhere beats a closed Wed 11am at Punk Wok');
  const after = nextStartAcrossVenues([PUNK, other], nowAt('2026-10-28T22:00'), { excludeAllDay: true });
  assert.equal(after.venue, PUNK, 'Wed Oct 28 10pm: Punk Wok Thu 11am (open again) wins');
});

test('nextStart (v1.13 C4): skipTempClosed needs a dated clock; an undated one skips nothing', () => {
  assert.equal(nextStart(PUNK, dt('MON', 22, 0), { skipTempClosed: true }).day, 'WED');
});

// C1: the Venmo card. TIP_URL empty renders nothing (the v1.10 C5 contract).
test('tipSectionHtml (v1.13 C1): empty url renders nothing', () => {
  assert.equal(tipSectionHtml(''), '');
  assert.equal(tipSectionHtml(null), '');
});

// v1.17 C3 (TJ, 2026-10-25: "one QR code - dont hide"): the tip card has the link and no QR.
test('tipSectionHtml (v1.17 C3): the Venmo link, and no QR', () => {
  const html = tipSectionHtml('https://venmo.com/u/Tjwhite-');
  assert.match(html, /<h2 id="tip-h">Enjoying the radar\?<\/h2>/);
  assert.ok(html.includes('Tip on Venmo: <a href="https://venmo.com/u/Tjwhite-" target="_blank" rel="noopener">@Tjwhite-</a>'));
  assert.ok(!html.includes('<img') && !html.includes('venmo-qr'));
});

test('index.html (v1.17 C3): TIP_URL is the Venmo profile; venmo-qr.svg is gone; the one QR is captioned', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /var TIP_URL = 'https:\/\/venmo\.com\/u\/Tjwhite-';/);
  assert.ok(!fs.existsSync(path.join(__dirname, '..', 'venmo-qr.svg')));
  assert.ok(!html.includes("src = 'venmo-qr.svg'") && !html.includes('src="venmo-qr.svg"'));
  assert.ok(html.includes("img.src = 'inkind-referral-qr.svg';"));
  assert.ok(html.includes("cap.textContent = 'Scan for $25 off';"));
});

// v1.17 C1 (TJ, 2026-10-25: "this assumes phone - the may be using a computer"): no
// user-facing string says "this phone" / "your phone". Comments are stripped first.
test('index.html (v1.17 C1): no user-facing "this phone" / "your phone"', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  assert.equal((html.match(/\b(this|your) phone\b/gi) || []).length, 0);
  assert.ok(html.includes('Notes stay in this browser until you send them.'));
});

// v1.14 C4 (TJ, 2026-10-25): "Enjoying the radar vs Like".
test('tipSectionHtml (v1.14 C4): the heading is "Enjoying the radar?"', () => {
  const html = tipSectionHtml('https://venmo.com/u/Tjwhite-', 'ios');
  assert.ok(html.includes('>Enjoying the radar?</h2>'));
  assert.ok(!html.includes('Like the radar'));
});

// v1.14 C2: the referral bar's dismissal, against a fake storage.
function memStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    has: (k) => m.has(k),
  };
}
const throwingStorage = {
  getItem() { throw new Error('SecurityError'); },
  setItem() { throw new Error('QuotaExceededError'); },
};

test('refBar (v1.14 C2): the key is hhradar-refbar-dismissed', () => {
  assert.equal(REFBAR_KEY, 'hhradar-refbar-dismissed');
});

test('refBar (v1.14 C2): not dismissed until dismissed, then remembered', () => {
  const s = memStorage();
  assert.equal(refBarDismissed(s), false);
  assert.equal(dismissRefBar(s), true);
  assert.ok(s.has('hhradar-refbar-dismissed'));
  assert.equal(refBarDismissed(s), true);
});

test('refBar (v1.14 C2): storage that throws or is missing reads as not dismissed, never throws', () => {
  assert.equal(refBarDismissed(throwingStorage), false);
  assert.equal(dismissRefBar(throwingStorage), false);
  assert.equal(refBarDismissed(null), false);
  assert.equal(dismissRefBar(null), false);
  assert.equal(refBarDismissed(undefined), false);
});

test('index.html (v1.14 C2/C3): the bar points at the referral card; the card has the button', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.includes('href="#referral" id="refbar-link"'));
  assert.ok(html.includes('aria-label="Dismiss"'));
  assert.ok(html.includes('<a class="ref-btn" href="https://app.inkind.com/refer/XRI8MWHF" target="_blank" rel="noopener">Get $25 off</a>'));
  assert.ok(html.includes('$25 off your first $50+ meal. I get a credit too. Terms apply.'));
  // The bar itself never links to inKind: the disclosure in the card is seen first.
  const bar = html.slice(html.indexOf('<div class="refbar"'), html.indexOf('<header>'));
  assert.ok(bar.length > 0 && !bar.includes('inkind.com'));
});

// v1.15 C2 (TJ, 2026-10-25): tapping the bar's text also dismisses it.
test('followRefBar (v1.15 C2): the tap path writes the key, hides the bar, then goes to the card', () => {
  const s = memStorage();
  const calls = [];
  const saved = followRefBar(s, () => calls.push('hide'), () => calls.push('go'));
  assert.equal(saved, true);
  assert.ok(s.has('hhradar-refbar-dismissed'));
  assert.equal(refBarDismissed(s), true);
  assert.deepEqual(calls, ['hide', 'go']);
});

test('followRefBar (v1.15 C2): blocked storage still hides the bar and goes to the card, never throws', () => {
  for (const st of [throwingStorage, null]) {
    const calls = [];
    assert.equal(followRefBar(st, () => calls.push('hide'), () => calls.push('go')), false);
    assert.deepEqual(calls, ['hide', 'go']);
  }
});

test('index.html (v1.15 C2): the bar text is wired through L.followRefBar; × still dismisses', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.match(html, /getElementById\('refbar-link'\)\.addEventListener\('click'[\s\S]{0,120}L\.followRefBar\(store,/);
  assert.match(html, /getElementById\('refbar-x'\)\.addEventListener\('click'[\s\S]{0,80}L\.dismissRefBar\(store\)/);
});

// ==================== v1.18 C1: the Neighborhoods panel ====================
// TJ, 2026-10-25 03:59: "the neighborhoods only show for the last zone selected and they
// only show up if you hit the tiny dot next to the zone." 04:04: "I hit guluch - then chip
// - delesected and hit east they still show up".
const L18 = require('../logic.js');
const zoneHoods = (key) => ZONES.find((z) => z.key === key).hoods;

test('hoodPanelGroups (v1.18 C1): one group per selected zone, in zone order, chip hoods only', () => {
  const chips = L18.chipHoodsByZone(REAL);
  const sel = new Set([].concat(zoneHoods('south'), zoneHoods('north'), zoneHoods('east')));
  const groups = L18.hoodPanelGroups(sel, chips);
  assert.deepEqual(groups.map((g) => g.key), ['north', 'east', 'south']);
  assert.deepEqual(groups.find((g) => g.key === 'east').hoods, ['Five Points & Main Street', 'Gallatin Avenue & Eastwood']);
  // Only hoods with a happy hour get a chip (v1.16): East's other two have none.
  for (const g of groups) {
    for (const h of g.hoods) assert.ok(REAL.some((v) => v.hood === h && v.windows.some((w) => w.kind === 'happy_hour')), h);
  }
  assert.deepEqual(L18.hoodPanelGroups(new Set(), chips), [], 'nothing selected: no groups');
  const all = L18.hoodPanelGroups(new Set(hoodKeys()), chips);
  assert.deepEqual(all.map((g) => g.key), ZONES.map((z) => z.key));
});

test('hoodPanelGroups (v1.18 C1): a pure function of (selection, data)', () => {
  const chips = L18.chipHoodsByZone(REAL);
  const before = JSON.stringify(chips);
  const sel = new Set(zoneHoods('gulch'));
  const a = L18.hoodPanelGroups(sel, chips);
  a[0].hoods.push('mutated');
  const b = L18.hoodPanelGroups(sel, chips);
  assert.equal(JSON.stringify(chips), before, 'the data is not touched');
  assert.ok(!b[0].hoods.includes('mutated'), 'each call builds fresh groups');
  assert.deepEqual(L18.hoodPanelGroups(new Set(sel), chips), b);
  // A zone with one hood still selected keeps its group.
  assert.deepEqual(L18.hoodPanelGroups(new Set(['The Gulch']), chips).map((g) => g.key), ['gulch']);
});

test('hoodPanelGroups (v1.18 C1): TJ\'s 04:04 steps — Gulch, open, deselect Gulch, select East -> only East', () => {
  const chips = L18.chipHoodsByZone(REAL);
  const sel = new Set();
  zoneHoods('gulch').forEach((h) => sel.add(h)); // select Gulch & Midtown
  assert.deepEqual(L18.hoodPanelGroups(sel, chips).map((g) => g.label), ['Gulch & Midtown']); // open Neighborhoods
  zoneHoods('gulch').forEach((h) => sel.delete(h)); // deselect Gulch & Midtown
  assert.deepEqual(L18.hoodPanelGroups(sel, chips), []);
  zoneHoods('east').forEach((h) => sel.add(h)); // select East
  assert.deepEqual(L18.hoodPanelGroups(sel, chips).map((g) => g.label), ['East']);
});

test('index.html (v1.18 C1): no zone carets; one Neighborhoods button, closed by default, remembered', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(!html.includes('data-caret-zone') && !html.includes('expandedZone'));
  assert.ok(!html.includes('▸'), 'no ▸ left');
  assert.match(html, /id="hood-panel-btn" aria-controls="hood-strip"/);
  assert.ok(html.includes("hoodsOpen: lsGet('hhradar-hoods-open', '0') === '1',"));
  assert.ok(html.includes("lsSet('hhradar-hoods-open', state.hoodsOpen ? '1' : '0');"));
  assert.ok(html.includes('L.hoodPanelGroups(state.hoodSelected, CHIP_HOODS)'));
  assert.ok(html.includes('Select a zone to see its neighborhoods.'));
});

// ==================== v1.18 C2: full schedules in "other days" ====================
// TJ, 2026-10-25 04:07: "this does not seem right either since they seem to have happy hours
// on other days."
test('venueScheduleParts (v1.18 C2): East on Saturday — the four "other days" venues, whole schedules', () => {
  const east = new Set(zoneHoods('east'));
  const cov = dayCoverageCounts(REAL.filter((v) => east.has(v.hood)), 'SAT');
  const got = {};
  cov.otherList.forEach((o) => { got[o.venue.name] = L18.venueScheduleParts(o.venue); });
  assert.deepEqual(Object.keys(got).sort(), ['Pearl Diver', 'The Amsterdamian', 'The Authentique', 'Two Ten Jack']);
  const hh = (n) => got[n].filter((p) => p.kind === 'happy_hour').map((p) => p.text);
  assert.deepEqual(hh('Pearl Diver'), ['Mon–Fri 4–6pm']);
  assert.deepEqual(hh('The Amsterdamian'), ['Tue–Fri 5–7pm']);
  assert.deepEqual(hh('The Authentique'), ['Tue–Thu 5–6:30pm']);
  assert.deepEqual(hh('Two Ten Jack'), ['Mon–Thu 4–6pm']);
  // The count includes specials (hasIntervalOn reads every window), so they are listed, after.
  // v1.20 C3: the special's "close" end is resolved from Wednesday's hours.
  assert.deepEqual(got['Pearl Diver'], [{ text: 'Mon–Fri 4–6pm', kind: 'happy_hour' }, { text: 'Wed 4pm–12am', kind: 'special' }]);
});

test('venueScheduleParts (v1.18 C2): happy hours first, exact repeats once; time style', () => {
  const v = venue({}, [
    win(['SAT'], '11:00', '14:30', { kind: 'lunch' }),
    win(['MON', 'TUE', 'WED'], '15:00', '18:00'),
    win(['FRI'], '21:00', 'close', { kind: 'special' }),
    win(['MON', 'TUE', 'WED'], '15:00', '18:00'),
    win(['SAT', 'SUN'], '12:30', '17:00'),
  ]);
  assert.deepEqual(L18.venueScheduleParts(v).map((p) => p.kind + ' ' + p.text), [
    // v1.20 C3: no hours on file, so the close is never invented.
    'happy_hour Mon–Wed 3–6pm', 'happy_hour Sat, Sun 12:30–5pm', 'special Fri 9pm until close', 'lunch Sat 11am–2:30pm',
  ]);
  assert.equal(L18.fmtHM('00:00'), '12am');
  assert.equal(L18.fmtRangeHM('11:00', '14:30'), '11am–2:30pm');
});

test('index.html (v1.18 C2): the other-days list draws venueScheduleParts, specials tagged', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.includes('var parts = L.venueScheduleParts(o.venue);'));
  assert.ok(html.includes("' <span class=\"cov-tag\">' + (p.kind === 'lunch' ? 'lunch' : 'special') + '</span>'"));
});

// ==================== v1.18 C3: neutral "tap" ====================
// Extends v1.17's "this phone" test: no user-facing "tap" either. Comments are stripped first.
test('index.html (v1.18 C3): no user-facing "tap"', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8')
    .replace(/<!--[\s\S]*?-->/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/\s\/\/ .*$/gm, '');
  assert.deepEqual(html.match(/\btap(s|ped|ping)?\b/gi) || [], []);
  assert.ok(html.includes('Send when you\\u2019re ready.'));
  assert.ok(html.includes('Straight-line estimate — select the address for a real ETA'));
  assert.ok(html.includes('the first time you open directions, this app will ask.'));
});

// ==================== v1.19 C1: three zone-chip states ====================
// TJ, 2026-10-25 04:33: "not quite looking right here." 04:37, on the filled / "2 of 4" /
// outline mockup: "lets try that".
test('zoneChipState (v1.19 C1): all / some / none over the visible hoods, with on and of', () => {
  const chips = L18.chipHoodsByZone(REAL);
  const dt = chips.downtown;
  assert.equal(dt.length, 4);
  assert.deepEqual(L18.zoneChipState(new Set(dt), dt), { state: 'all', on: 4, of: 4 });
  assert.deepEqual(L18.zoneChipState(new Set(['SoBro', 'Rutledge Hill & Rolling Mill Hill']), dt), { state: 'some', on: 2, of: 4 });
  assert.deepEqual(L18.zoneChipState(new Set(), dt), { state: 'none', on: 0, of: 4 });
  // Hoods with no chip never decide the state: Gulch's West End has no happy hour.
  assert.ok(!chips.gulch.includes('West End'));
  assert.equal(L18.zoneChipState(new Set(['West End']), chips.gulch).state, 'none');
  assert.equal(L18.zoneChipState(new Set(chips.gulch), chips.gulch).state, 'all');
  // A zone with exactly one visible hood (Outer suburbs: Murfreesboro) is only all or none.
  assert.deepEqual(chips.outer, ['Murfreesboro']);
  assert.equal(L18.zoneChipState(new Set(['Murfreesboro']), chips.outer).state, 'all');
  assert.equal(L18.zoneChipState(new Set(['Smyrna']), chips.outer).state, 'none');
  for (let n = 0; n < 2; n++) {
    const s = L18.zoneChipState(new Set(chips.outer.slice(0, n)), chips.outer).state;
    assert.ok(s === 'all' || s === 'none', s);
  }
  assert.equal(L18.zoneChipState(new Set(['x']), []).state, 'none', 'no visible hoods: none');
});

test('zoneTapTarget / applyZoneTap (v1.19 C1): none -> all, some -> all, all -> none; pure', () => {
  assert.equal(L18.zoneTapTarget('none'), 'all');
  assert.equal(L18.zoneTapTarget('some'), 'all');
  assert.equal(L18.zoneTapTarget('all'), 'none');
  const chips = L18.chipHoodsByZone(REAL);
  const vis = chips.gulch;
  const some = new Set(['The Gulch', 'Midtown & Music Row', 'Hillsboro Village & Belmont', 'Sylvan Park']);
  const frozen = JSON.stringify([...some]);
  const all = L18.applyZoneTap(some, 'gulch', vis);
  assert.equal(JSON.stringify([...some]), frozen, 'the input Set is not touched');
  assert.equal(L18.zoneChipState(all, vis).state, 'all');
  for (const h of zoneHoods('gulch')) assert.ok(all.has(h), 'whole zone on, hidden hoods too: ' + h);
  assert.ok(all.has('Sylvan Park'), 'other zones untouched');
  const none = L18.applyZoneTap(all, 'gulch', vis);
  assert.equal(L18.zoneChipState(none, vis).state, 'none');
  for (const h of zoneHoods('gulch')) assert.ok(!none.has(h), h);
  assert.ok(none.has('Sylvan Park'));
  assert.equal(L18.zoneChipState(L18.applyZoneTap(none, 'gulch', vis), vis).state, 'all', 'none -> all');
  assert.deepEqual([...L18.applyZoneTap(some, 'nope', vis)].sort(), [...some].sort(), 'unknown zone: a copy, unchanged');
});

// ==================== v1.19 C2: one neighborhood picker ====================
// v1.20 C10: the words are now "Select all" / "Clear".
test('hoodGroupControlLabel (v1.19 C2): the group heading reads "Select all" while some are ticked, "Clear" when all are', () => {
  const chips = L18.chipHoodsByZone(REAL);
  const vis = chips.downtown;
  let sel = new Set(['SoBro']);
  assert.equal(L18.hoodGroupControlLabel(sel, vis), 'Select all');
  sel = L18.applyZoneTap(sel, 'downtown', vis); // the control does what the zone chip does
  assert.equal(L18.zoneChipState(sel, vis).state, 'all');
  assert.equal(L18.hoodGroupControlLabel(sel, vis), 'Clear');
  sel = L18.applyZoneTap(sel, 'downtown', vis);
  assert.equal(L18.zoneChipState(sel, vis).state, 'none');
  assert.deepEqual(L18.hoodPanelGroups(sel, chips), [], 'all off: the group leaves the panel');
  // Groups show for zones in state all or some, in zone order, suburbs included.
  const mixed = new Set(['SoBro', 'Brentwood', 'Murfreesboro'].concat(zoneHoods('west')));
  const groups = L18.hoodPanelGroups(mixed, chips);
  assert.deepEqual(groups.map((g) => g.key), ['downtown', 'west', 'franklin', 'outer']);
  assert.deepEqual(groups.map((g) => L18.zoneChipState(mixed, g.hoods).state), ['some', 'all', 'some', 'all']);
});

test('index.html (v1.19): three chip looks, the group control, and the under-map names are labels', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.includes("var st = L.zoneChipState(state.hoodSelected, stateHoodsOf(zone));"));
  assert.ok(html.includes("'<span class=\"some-badge\">' + st.on + ' of ' + st.of + '</span>'"));
  assert.ok(!/\.pill\.partial\s*\{[^}]*dashed/.test(html), 'some is no longer a dashed outline');
  assert.ok(html.includes('state.hoodSelected = L.applyZoneTap(state.hoodSelected, key, stateHoodsOf(zone));'));
  assert.ok(html.includes('var ctl = L.hoodGroupControlLabel(state.hoodSelected, g.hoods);'));
  assert.ok(html.includes("e.target.closest('[data-group-zone]')"));
  assert.ok(html.includes("'<span class=\"suburb-name\">'"));
  assert.ok(!/suburb-row[^\n]*hoodPillHtml/.test(html), 'no hood chips under the map');
  assert.ok(html.includes('var MAP_FILL = { all: 0.55, some: 0.3, none: 0.12 };'));
});

// ==================== v1.20: a pre-launch trust pass ====================
// TJ, 2026-10-25 05:08: "it should be just as clear on the description as it is on the grid
// what the times are."
const L20 = require('../logic.js');
const byName = (n) => REAL.find((v) => v.name === n);

test('windowLine (v1.20 C2): kind · days and times · area, one line per window, every kind', () => {
  const v = venue({ TUE: [['11:00', '20:30']] }, []);
  assert.equal(L20.windowLine(v, win(['MON', 'TUE', 'WED', 'THU', 'FRI'], '16:00', '18:00', { area: 'bar only' })),
    'Happy hour · Mon–Fri 4–6pm · bar only');
  assert.equal(L20.windowLine(v, win(['TUE', 'WED', 'THU', 'FRI'], '11:00', '14:00', { kind: 'lunch', area: 'dine-in only' })),
    'Lunch special · Tue–Fri 11am–2pm · dine-in only');
  assert.equal(L20.windowLine(v, win(['TUE'], '17:00', 'close', { kind: 'special' })), 'Special · Tue 5–8:30pm');
  // TJ's three 04:59 cards, from venues.json. v1.21: Blue Coast's Tuesday is gone (2026-10-25n
  // data); Nicky's Monday special is the same "close" case.
  const bc = byName('Blue Coast Burrito - Mount Juliet');
  assert.deepEqual(bc.windows, []);
  assert.equal(bc.verified_no_hh, true);
  const nk = byName("Nicky's Coal Fired Pizza");
  const nkMon = nk.windows.find((w) => w.kind === 'special' && w.days.join() === 'MON');
  assert.equal(L20.windowLine(nk, nkMon), 'Special · Mon 5–8:30pm');
  const st = byName('Single Tree BBQ');
  assert.equal(L20.windowLine(st, st.windows[0]), 'Lunch special · Tue–Fri 11am–2pm · dine-in only');
  const b360 = byName('360 Bistro');
  assert.equal(L20.windowLine(b360, b360.windows[0]), 'Happy hour · Mon–Fri 3:30–5:30pm · bar only');
});

test('windowTimeLabel (v1.20 C3): "close" resolved; past midnight; differing closes say "until close"', () => {
  // One day, a normal close.
  const v1 = venue({ TUE: [['11:00', '20:30']] }, []);
  assert.equal(L20.windowTimeLabel(v1, win(['TUE'], '17:00', 'close')), '5–8:30pm');
  // A close past midnight is the real time, not 11:59pm.
  const v2 = venue({ SAT: [['11:00', '02:00']] }, []);
  assert.equal(L20.windowTimeLabel(v2, win(['SAT'], '21:00', 'close')), '9pm–2am');
  // A split day whose dinner range ends at midnight: the close is midnight, not the 3pm
  // lunch close (lastCloseMinutes used to read "00:00" as the earliest end).
  const v3 = venue({ MON: [['07:00', '15:00'], ['17:00', '00:00']] }, []);
  assert.equal(L20.closeHMOn(v3, win(['MON'], '17:00', 'close'), 'MON'), '00:00');
  assert.equal(L20.windowTimeLabel(v3, win(['MON'], '17:00', 'close')), '5pm–12am');
  // Different closes on different days: never pick one.
  const v4 = venue({ SAT: [['11:00', '23:00']], SUN: [['11:00', '21:00']] }, []);
  const w4 = win(['SAT', 'SUN'], '11:00', 'close');
  assert.equal(L20.windowTimeLabel(v4, w4), '11am until close');
  // ...but one day of it (the Day Grid card) has one close.
  assert.equal(L20.windowTimeLabel(v4, w4, 'SUN'), '11am–9pm');
  // No hours on file: no invented time.
  assert.equal(L20.windowTimeLabel(venue({}, []), win(['FRI'], '21:00', 'close')), '9pm until close');
  assert.equal(L20.closeHMOn(venue({}, []), win(['FRI'], '21:00', 'close'), 'FRI'), null);
  // A numeric end is untouched.
  assert.equal(L20.windowTimeLabel(v1, win(['TUE'], '16:30', '18:30')), '4:30–6:30pm');
  assert.equal(L20.compactRangeHM('16:30', '18:30'), '4:30–6:30');
  assert.equal(L20.compactRangeHM('11:00', '14:00'), '11–2');
  // Real data: 51 North's weekend all-day happy hour closes 11pm Sat, 9pm Sun.
  const n51 = byName('51 North Taproom');
  assert.equal(L20.windowLine(n51, n51.windows.find((w) => w.days.join() === 'SAT,SUN' && w.kind === 'happy_hour')),
    'Happy hour · Sat, Sun 11am until close');
});

test('dayHoursStatus (v1.20 C4): the Day Grid card describes the selected day, not the clock', () => {
  const b360 = byName('360 Bistro');
  assert.deepEqual(L20.dayHoursStatus(b360, 'TUE'), { text: 'Tue: open 11am–9pm', closed: false });
  assert.deepEqual(L20.dayHoursStatus(b360, 'SUN'), { text: 'Sun: open 5–9pm', closed: false });
  const split = venue({ MON: [['17:00', '00:00'], ['07:00', '15:00']] }, []);
  assert.equal(L20.dayHoursStatus(split, 'MON').text, 'Mon: open 7am–3pm, 5pm–12am', 'sorted by open time');
  assert.deepEqual(L20.dayHoursStatus(split, 'TUE'), { text: 'Tue: closed', closed: true });
  assert.deepEqual(L20.dayHoursStatus(b360, 'TUE', { from: 'x', to: 'y' }), { text: 'Tue: closed (temporary)', closed: true });
  assert.deepEqual(L20.dayHoursStatus(venue({}, []), 'TUE'), { text: 'Tue: no hours on file', closed: false, none: true });
});

test('index.html (v1.20 C4): grid card passes its day; "Opens…" is never red', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.includes("var HOURS_CLOSED = { 'closed-today': 1, 'closed-for-the-day': 1 };"));
  assert.ok(html.includes("return cardHtml(venue, win, statusLabel, 'soon', distanceLabel(venue), cardKey(venue, win), true, null, day);"));
  assert.ok(html.includes('L.dayHoursStatus(venue, day, L.tempClosedFor(venue, state.now, day, 1))'));
  assert.ok(!html.includes('lunchLineHtml') && !html.includes('scheduleBlockHtml'), 'one source of truth (C2)');
  assert.ok(html.includes('windowLineHtml(venue, win) +\n        \'<div class="deals">\''), 'the line sits directly above the deals');
});

test('zoneCountFor (v1.20 C10): a partly-on zone counts only its ticked neighborhoods', () => {
  const hoods = ['A', 'B', 'C', 'D'];
  const counts = { A: 4, B: 3, C: 2, D: 1 };
  assert.equal(L20.zoneCountFor(new Set(hoods), hoods, hoods, counts), 10, 'all: every hood');
  assert.equal(L20.zoneCountFor(new Set(), hoods, hoods, counts), 10, 'none: every hood (what you would get)');
  assert.equal(L20.zoneCountFor(new Set(['A', 'C']), hoods, hoods, counts), 6, 'some: only A and C');
  // A hidden hood (no chip) follows its zone: off while the zone is partly on.
  assert.equal(L20.zoneCountFor(new Set(['A']), hoods.concat('H'), hoods, Object.assign({ H: 5 }, counts)), 4);
  // Real data: Downtown with SoBro and Rutledge Hill ticked.
  const chips = L20.chipHoodsByZone(REAL);
  const dt = zoneHoods('downtown');
  const live = {}; dt.forEach((h, i) => { live[h] = i + 1; });
  const sel = new Set(['SoBro', 'Rutledge Hill & Rolling Mill Hill']);
  assert.equal(L20.zoneCountFor(sel, dt, chips.downtown, live), live.SoBro + live['Rutledge Hill & Rolling Mill Hill']);
});

test('sourceNoteLines (v1.20 C8): a sentence from the data, never the research prose', () => {
  const st = byName('Single Tree BBQ');
  assert.deepEqual(L20.sourceNoteLines(st, st.windows[0]),
    ['Checked on singletreebbq.com · 2026-10-23', 'Sources disagree — check before you go']);
  const v = venue({}, []);
  assert.deepEqual(L20.sourceNoteLines(v, win(['MON'], '16:00', '18:00', { sources: ['https://www.example.com/hh'], last_verified: '2026-10-01' })),
    ['Checked on example.com · 2026-10-01']);
  assert.deepEqual(L20.sourceNoteLines(v, win(['MON'], '16:00', '18:00', { sources: [] })), ['Checked · 2026-09-05']);
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(!/research_notes : win\.notes/.test(html), 'the prose is no longer rendered');
  assert.ok(html.includes('L.sourceNoteLines(venue, win).map('));
});

test('index.html (v1.20 C1/C7/C9/C11): subtitle, location controls, one verify badge, wording', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.includes('<p class="subtitle">Live happy hours at Nashville restaurants on inKind, the dining app that gives you bonus credit.</p>'));
  assert.ok(html.includes("return state.gridSort === 'distance' && !state.geo ? 'time' : state.gridSort;"), 'Distance never pretends');
  assert.ok(html.includes("'<span class=\"needs-loc\">needs location</span>'"));
  assert.ok(!html.includes('>Unverified<') && !html.includes("'Unverified'"), 'Unverified merged into Verify before you go');
  assert.ok(!html.includes('HH info'), 'HH info is Deal info');
  assert.ok(html.includes('Deal info ↗'));
  assert.ok(html.includes('href="https://github.com/cumberlandworks/hh-radar#readme" target="_blank" rel="noopener">README</a>'));
  assert.ok(html.includes('Notes go to TJ,\n        the person who built this.'));
  assert.ok(html.includes("var dayWord = function (d) { return d === state.now.dayOfWeek ? 'today' : DAY_FULL[d]; };"));
  assert.ok(html.includes('See the Day Grid'));
  // v1.22: no data change, so venues.json keeps ?v=1.21 (C7).
  assert.ok(html.includes("var APP_VERSION = 'v1.24';") && html.includes("venues.json?v=1.24") && html.includes('logic.js?v=1.24'));
});

// ---- v1.21 C2 (fix20 review): the dead-hour line names the next HAPPY HOUR ----
// fix20's report: "next: The Loading Dock at 7am", a breakfast special, shown as the next happy hour.
test('emptyStateNext (v1.21 C2): 03:00 Tuesday names a happy hour, the Loading Dock special is the sooner line', () => {
  const eligible = REAL.filter((v) => v.windows.length > 0);
  const r = L20.emptyStateNext(eligible, nowAt('2026-10-27T03:00'), { excludeAllDay: true });
  assert.equal(r.hh.next.window.kind, 'happy_hour');
  assert.equal(r.hh.venue.name, 'Blue Sushi - 5th & Broadway');
  assert.deepEqual([r.hh.next.day, r.hh.next.start], ['TUE', '11:00']);
  assert.equal(r.sooner.venue.name, 'The Loading Dock');
  assert.equal(r.sooner.next.window.kind, 'special');
  assert.deepEqual([r.sooner.next.day, r.sooner.next.start], ['TUE', '07:00']);
  // The old answer, for the record: any kind wins.
  assert.equal(nextStartAcrossVenues(eligible, nowAt('2026-10-27T03:00'), { excludeAllDay: true }).venue.name, 'The Loading Dock');
});

test('emptyStateNext (v1.21 C2): sooner only when a lunch or special starts before the happy hour', () => {
  const hh = venue({}, [win(['WED'], '16:00', '18:00', { kind: 'happy_hour' })]);
  const lunch = venue({}, [win(['WED'], '11:00', '14:00', { kind: 'lunch' })]);
  const late = venue({}, [win(['WED'], '19:00', '21:00', { kind: 'special' })]);
  const now = dt('WED', 9, 0);
  let r = L20.emptyStateNext([hh, lunch, late], now);
  assert.equal(r.hh.venue, hh);
  assert.equal(r.sooner.venue, lunch);
  assert.equal(r.sooner.next.window.kind, 'lunch');
  r = L20.emptyStateNext([hh, late], now);
  assert.equal(r.hh.venue, hh);
  assert.equal(r.sooner, null, 'a special after the happy hour is not "sooner"');
  r = L20.emptyStateNext([lunch], now);
  assert.equal(r.hh, null, 'no happy hour anywhere: no next happy hour');
  assert.equal(r.sooner, null, 'and nothing to be sooner than');
  assert.equal(L20.nextStart(lunch, now, { kinds: ['happy_hour'] }), null);
});

test('emptyStateNext (v1.21 C2): the temp-closure rule still holds (Punk Wok, Mon Oct 26 10pm)', () => {
  const other = venue({}, [win(['WED'], '16:00', '18:00', { kind: 'happy_hour' })]);
  const r = L20.emptyStateNext([PUNK, other], nowAt('2026-10-26T22:00'), { excludeAllDay: true });
  assert.equal(r.hh.venue, other, 'Punk Wok is closed Wed Oct 28; its happy hour does not win');
  assert.equal(r.sooner, null, 'nor its Wed lunch: the first open lunch is Thu, after the Wed 4pm happy hour');
});

test('index.html (v1.21 C2/C3): "next happy hour", a quieter "Sooner" line, zone chips say 0', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.includes("'No happy hours right now — next happy hour: <b>'"));
  assert.ok(!html.includes("'No happy hours right now — next: <b>'"));
  assert.ok(html.includes("'<div class=\"empty-sooner\">Sooner: <b>'"));
  assert.ok(html.includes("nx.sooner.next.window.kind === 'lunch' ? 'lunch special' : 'special'"));
  assert.ok(html.includes('.empty .empty-sooner {'));
  assert.ok(html.includes("        '<span class=\"count\">' + count + '</span>' +\n      '</div>';"), 'zone pill always has a count');
  assert.ok(!html.includes("(count > 0 ? '<span class=\"count\">' + count + '</span>' : '')"));
});

// ==================== v1.22 (BLOCK-hh-radar-fix22-20261025) ====================
function itemsOn(v, day) {
  const out = [];
  v.windows.forEach((w) => {
    if (w.days.indexOf(day) === -1) return;
    L20.resolveWindow(v, w).forEach((iv) => { if (iv.day === day) out.push({ win: w, startAbs: iv.startAbs, endAbs: iv.endAbs }); });
  });
  return out;
}
const WHERE_ZONES = ZONES.map((z) => ({ key: z.key, label: z.label, stateHoods: z.hoods.slice() }));
const hoodsOfZone = (key) => ZONES.find((z) => z.key === key).hoods;

// ---- C1: the Where line's summary, the footer, the history handling ----
test('whereSummary (v1.22 C1): all, none, one zone, partial, 3+ zones', () => {
  assert.equal(L20.whereSummary(new Set(hoodKeys()), WHERE_ZONES), 'All of Nashville');
  assert.equal(L20.whereSummary(new Set(), WHERE_ZONES), 'Nothing selected');
  assert.equal(L20.whereSummary(new Set(hoodsOfZone('east')), WHERE_ZONES), 'East');
  const partGulch = new Set(hoodsOfZone('downtown').concat(['The Gulch']));
  assert.equal(L20.whereSummary(partGulch, WHERE_ZONES), 'Downtown, Gulch & Midtown (part)');
  const four = new Set(hoodsOfZone('downtown').concat(['The Gulch'], hoodsOfZone('east'), hoodsOfZone('outer')));
  assert.equal(L20.whereSummary(four, WHERE_ZONES), 'Downtown, Gulch & Midtown (part) +2');
  // Every zone but one hood: not "All of Nashville".
  const allButOne = new Set(hoodKeys()); allButOne.delete('SoBro');
  assert.equal(L20.whereSummary(allButOne, WHERE_ZONES), 'Downtown (part), Gulch & Midtown +6');
  // Zone order, not tap order.
  assert.equal(L20.whereSummary(new Set(hoodsOfZone('west').concat(hoodsOfZone('north'))), WHERE_ZONES), 'Germantown & North, West');
});

test('whereFooterLabel (v1.22 C1): NOW counts live, the Day Grid names the day', () => {
  assert.equal(L20.whereFooterLabel('now', 52, 'TUE'), 'Show 52 live now');
  assert.equal(L20.whereFooterLabel('grid', 40, 'SUN'), 'Show 40 on Sunday');
  assert.equal(L20.whereFooterLabel('now', 0, 'SUN'), 'Show 0 live now');
});

function fakeHistory() {
  const h = { entries: 1, calls: [], pushState() { h.entries++; h.calls.push('push'); }, back() { h.entries--; h.calls.push('back'); } };
  return h;
}
test('sheetHistory (v1.22 C1): Back closes the sheet and stays on the page', () => {
  const hist = fakeHistory(); let closed = 0;
  const c = L20.sheetHistory(hist, () => { closed++; });
  assert.equal(c.open(), true);
  assert.equal(hist.entries, 2, 'opening pushes one entry');
  assert.equal(c.open(), false, 'a second open is a no-op');
  assert.equal(hist.entries, 2);
  // The browser's Back pops our entry, then fires popstate.
  hist.entries--;
  assert.equal(c.popstate(), 'closed');
  assert.equal(closed, 1);
  assert.equal(c.isOpen(), false);
  assert.equal(hist.entries, 1, 'still on the page: nothing else was popped');
  assert.deepEqual(hist.calls, ['push']);
});
test('sheetHistory (v1.22 C1): Done / backdrop / Escape pop the entry themselves; that popstate is swallowed', () => {
  const hist = fakeHistory(); let closed = 0;
  const c = L20.sheetHistory(hist, () => { closed++; });
  c.open();
  assert.equal(c.close(), true);
  assert.equal(closed, 1);
  assert.equal(hist.entries, 1, 'the pushed entry is gone');
  assert.equal(c.popstate(), 'swallowed', 'the popstate history.back() causes does not close anything again');
  assert.equal(closed, 1);
  assert.equal(c.close(), false, 'closing a closed sheet does nothing');
  assert.equal(c.popstate(), 'ignored', 'a later Back (e.g. leaving the page) is not ours');
  assert.deepEqual(hist.calls, ['push', 'back']);
  // Open again: a fresh entry.
  c.open(); assert.equal(hist.entries, 2);
});
test('sheetHistory (v1.22 C1): a history that throws still opens and closes the sheet', () => {
  const bad = { pushState() { throw new Error('SecurityError'); }, back() { throw new Error('x'); } };
  let closed = 0;
  const c = L20.sheetHistory(bad, () => { closed++; });
  assert.equal(c.open(), true);
  assert.equal(c.close(), true);
  assert.equal(closed, 1);
  assert.equal(c.popstate(), 'ignored');
});

// ---- C2: no grey cards, a badge instead ----
const JBJ = REAL.find((v) => v.name === "JBJ's Nashville");
const JBJ_BRUNCH = JBJ.windows.find((w) => w.kind === 'special' && w.start === '10:00');
test('onlyBadgeFor (v1.22 C2): TJ\'s JBJ\'s brunch is DRINKS ONLY in Food first, nothing in Drink first', () => {
  assert.equal(L20.onlyBadgeFor(JBJ_BRUNCH, 'food'), 'drinks-only');
  assert.equal(L20.onlyBadgeFor(JBJ_BRUNCH, 'drink'), null);
  const foodOnly = win(['MON'], '16:00', '18:00', { deals: [{ type: 'food', desc: 'Wings' }] });
  assert.equal(L20.onlyBadgeFor(foodOnly, 'drink'), 'food-only');
  assert.equal(L20.onlyBadgeFor(foodOnly, 'food'), null);
  assert.equal(L20.onlyBadgeFor(win(['MON'], '16:00', '18:00'), 'food'), null, 'no deals: no badge (C5 covers it)');
  assert.equal(L20.onlyBadgeFor(win(['MON'], '16:00', '18:00'), 'drink'), null);
});
test('index.html (v1.22 C2): no muted card, hasDrinkOnly gone, the badges and their key', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(!html.includes('.card.muted') && !html.includes("' muted'") && !html.includes('hasFoodMuted'));
  assert.ok(!/function hasDrinkOnly|hasDrinkOnly\(/.test(html));
  assert.ok(html.includes("var ONLY_LABEL = { 'drinks-only': 'Drinks only', 'food-only': 'Food only' };"));
  assert.ok(html.includes("(only ? badgeHtml(only, ONLY_LABEL[only], BADGE_TIPS[only]) : '')"));
  assert.ok(html.includes("[only, ONLY_LABEL[only], BADGE_TIPS[only]]"), 'in the key');
  // The only opacity left on a card is the "you'd miss it" dim.
  const cardOpacity = html.match(/\.card[\w.:-]*\s*\{[^}]*opacity[^}]*\}/g) || [];
  assert.deepEqual(cardOpacity, ['.card.unreachable { opacity: 0.55; }']);
});

// ---- C3: grid colours follow the priority ----
test('gridBlockLook (v1.22 C3): filled = the chosen type, outline = the other, grey = no deals', () => {
  const both = win(['MON'], '16:00', '18:00', { deals: [{ type: 'food', desc: 'a' }, { type: 'drink', desc: 'b' }] });
  const food = win(['MON'], '16:00', '18:00', { deals: [{ type: 'food', desc: 'a' }] });
  const drink = win(['MON'], '16:00', '18:00', { deals: [{ type: 'drink', desc: 'b' }] });
  const none = win(['MON'], '16:00', '18:00');
  assert.deepEqual([both, food, drink, none].map((w) => L20.gridBlockLook(w, 'food')), ['food', 'food', 'drink', 'nodeal']);
  assert.deepEqual([both, food, drink, none].map((w) => L20.gridBlockLook(w, 'drink')), ['drinkfill', 'foodline', 'drinkfill', 'nodeal']);
  assert.equal(L20.gridBlockLook(Object.assign({}, drink, { kind: 'special' }), 'drink'), 'special');
  assert.equal(L20.gridBlockLook(Object.assign({}, none, { kind: 'lunch' }), 'food'), 'lunch');
});
test('index.html (v1.22 C3): no drinkmode, the legend follows the mode', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(!html.includes('drinkmode'));
  assert.ok(html.includes(".block.drinkfill { background: var(--drink); }"));
  assert.ok(html.includes("var cls = 'block ' + L.gridBlockLook(it.win, state.priority);"));
  assert.ok(html.includes("'Happy hour, drink deal'") && html.includes("'Happy hour, food only'"));
  assert.ok(html.includes("'Happy hour, food deal'") && html.includes("'Happy hour, drinks only'"));
  assert.ok(html.includes("'Happy hour, deals not posted'"));
});

// ---- C4: times under the venue name ----
test('gridRowTimes (v1.22 C4): one happy hour, several windows tagged, past midnight', () => {
  const v1 = venue({}, [win(['TUE'], '16:30', '18:30', { deals: [{ type: 'food', desc: 'a' }] })]);
  const t1 = L20.gridRowTimes(v1, 'TUE', itemsOn(v1, 'TUE'));
  assert.deepEqual([t1.times, t1.noDeals, t1.parts], ['4:30–6:30pm', '', [{ tag: '', time: '4:30–6:30pm' }]]);
  const v2 = venue({}, [win(['TUE'], '17:00', '01:00', { deals: [{ type: 'drink', desc: 'a' }] })]);
  assert.equal(L20.gridRowTimes(v2, 'TUE', itemsOn(v2, 'TUE')).times, '5pm–1am');
  const v3 = venue({}, [
    win(['TUE'], '16:00', '18:00', { deals: [{ type: 'drink', desc: 'a' }] }),
    win(['TUE'], '11:00', '14:00', { kind: 'lunch', deals: [{ type: 'food', desc: 'b' }] }),
    win(['TUE'], '10:00', '14:00', { kind: 'special', deals: [{ type: 'drink', desc: 'c' }] }),
  ]);
  assert.equal(L20.gridRowTimes(v3, 'TUE', itemsOn(v3, 'TUE')).times, 'Special 10am–2pm · Lunch 11am–2pm · 4–6pm');
  // TJ's JBJ's Sunday: the brunch, and the game-day special to close (2am), "close" resolved.
  assert.equal(L20.gridRowTimes(JBJ, 'SUN', itemsOn(JBJ, 'SUN')).times, 'Special 10am–2pm · Special 11am–2am');
});
test('fmtRangeHM (v1.22 C4): a range past midnight keeps both am/pm', () => {
  assert.equal(L20.fmtRangeHM('11:00', '02:00'), '11am–2am');
  assert.equal(L20.fmtRangeHM('16:00', '18:00'), '4–6pm');
  assert.equal(L20.fmtRangeHM('09:00', '11:30'), '9–11:30am');
  assert.equal(L20.fmtRangeHM('22:00', '02:00'), '10pm–2am');
});
test('index.html (v1.22 C4): the in-block labels and their measuring code are gone', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(!html.includes('blabel') && !html.includes('fitBlockLabels') && !html.includes('nofit'));
  assert.ok(html.includes("rowTimesHtml(venue, day, items, r.closed)"));
  assert.ok(html.includes('.grid-row { display: flex; align-items: stretch; border-bottom: 1px solid var(--border); min-height: 36px; }'));
});

// ---- C5: deals not posted ----
test('NO_DEALS_TEXT (v1.22 C5): Present Tense\'s card and grid row say "Deals not posted, ask at the bar"', () => {
  assert.equal(L20.NO_DEALS_TEXT, 'Deals not posted, ask at the bar');
  const pt = REAL.find((v) => v.name === 'Present Tense');
  const tp = L20.gridRowTimes(pt, 'SUN', itemsOn(pt, 'SUN'));
  assert.deepEqual([tp.times, tp.noDeals], ['4–5:30pm', 'Deals not posted, ask at the bar']);
  // Butterfly's Monday: a special with deals beside a happy hour without: the note names the times.
  const bf = REAL.find((v) => v.name === 'Butterfly - Nashville');
  const tb = L20.gridRowTimes(bf, 'MON', itemsOn(bf, 'MON'));
  assert.deepEqual([tb.times, tb.noDeals], ['4–6pm · Special 4–11pm', '4–6pm: deals not posted, ask at the bar']);
  assert.deepEqual(tb.parts, [{ tag: '', time: '4–6pm' }, { tag: 'Special', time: '4–11pm' }]);
  // The five no-deal happy hours (D5).
  const bare = [];
  REAL.forEach((v) => v.windows.forEach((w) => { if (w.kind === 'happy_hour' && !w.deals.length) bare.push(v.name); }));
  assert.equal(bare.length, 5);
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(!html.includes('No deal details published'));
  assert.ok(html.includes("'<div class=\"deal no-deals\">' + escapeHtml(L.NO_DEALS_TEXT) + '</div>'"));
});

// ---- C6: the update check ----
test('versionDiffers (v1.22 C6): only a real, different version string', () => {
  assert.equal(L20.versionDiffers('v1.23\n', 'v1.22'), true);
  assert.equal(L20.versionDiffers('v1.22\n', 'v1.22'), false);
  assert.equal(L20.versionDiffers('  v1.22  ', 'v1.22'), false);
  assert.equal(L20.versionDiffers('<!doctype html><title>Wi-Fi login</title>', 'v1.22'), false);
  assert.equal(L20.versionDiffers('', 'v1.22'), false);
  assert.equal(L20.versionDiffers(null, 'v1.22'), false);
  assert.equal(L20.versionDiffers(undefined, 'v1.22'), false);
});
test('version.txt (v1.22 C6): matches APP_VERSION, so a release cannot forget it', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const app = html.match(/var APP_VERSION = '([^']+)';/)[1];
  const txt = fs.readFileSync(path.join(__dirname, '..', 'version.txt'), 'utf8').trim();
  assert.equal(txt, app);
  assert.ok(html.includes("fetch('version.txt?t=' + Date.now(), { cache: 'no-store' })"));
  assert.ok(html.includes('var UPDATE_AFTER_HIDDEN_MS = 15 * 60 * 1000;'));
  assert.ok(html.includes("window.addEventListener('pageshow', function (e) { if (e.persisted) checkForUpdate(); });"));
  assert.ok(html.includes('There’s a newer version of the radar.'));
  // No check on first load: the only callers are the two listeners.
  assert.equal((html.match(/checkForUpdate\(\)/g) || []).length, 3, 'one definition + two listeners');
});

// ---- C1 wiring ----
test('index.html (v1.22 C1): the Where sheet is a modal dialog with Done, All/None and a footer', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(html.includes('role="dialog" aria-modal="true" aria-labelledby="where-title"'));
  assert.ok(html.includes('<h2 id="where-title">Where</h2>') && html.includes('id="where-done">Done</button>'));
  assert.ok(html.includes('id="where-all">All</button>') && html.includes('id="where-none">None</button>'));
  assert.ok(html.includes("var whereHist = L.sheetHistory(window.history, hideWhere);"));
  assert.ok(html.includes("window.addEventListener('popstate', function () { whereHist.popstate(); });"));
  assert.ok(html.includes('max-height: 85vh; max-height: 85dvh;'));
  assert.ok(!html.includes('zonesOpen') && !html.includes('toggleZonesOpen'));
});

// ==================== v1.24 (fix24): one live list, no red ====================
const L24 = require('../logic.js');
const VENUES24 = require('../venues.json').venues;
const DATES24 = {
  MON: { year: 2026, month: 10, day: 26 }, TUE: { year: 2026, month: 10, day: 27 },
  WED: { year: 2026, month: 10, day: 28 }, THU: { year: 2026, month: 10, day: 29 },
  FRI: { year: 2026, month: 10, day: 30 }, SAT: { year: 2026, month: 10, day: 31 },
  SUN: { year: 2026, month: 10, day: 25 },
};
const at24 = (d, h, m) => dt(d, h, m, DATES24[d]);

// ---- C1: nowEntries files all-day windows like any other ----
test('nowEntries (v1.24 C1): a live all-day special is live; one starting within 2h is soon', () => {
  const v = venue({ SUN: [['10:00', '22:00']] }, [
    win(['SUN'], '11:00', '21:00', { kind: 'special' }), // all-day (10h)
    win(['SUN'], '16:00', '18:00'),
  ]);
  assert.equal(L24.isAllDay(v, v.windows[0]), true);
  let e = L24.nowEntries([v], at24('SUN', 14, 14));
  assert.deepEqual(e.live.map((x) => x.window), [v.windows[0]]);
  assert.deepEqual(e.soon.map((x) => x.window), [v.windows[1]]);
  assert.equal(e.soon[0].minutesUntil, 106);
  e = L24.nowEntries([v], at24('SUN', 9, 30));
  assert.deepEqual(e.soon.map((x) => x.window), [v.windows[0]], 'all-day, 90 min out: Starting soon');
  assert.equal(e.live.length, 0);
});

test('nowEntries (v1.24 C1): a window on a temporarily closed date is left out', () => {
  const v = venue({ SUN: [['10:00', '22:00']] }, [win(['SUN'], '11:00', '21:00', { kind: 'special' })]);
  v.temp_closed = [{ from: '2026-10-25', to: '2026-10-25', note: 'private event' }];
  const e = L24.nowEntries([v], at24('SUN', 14, 14));
  assert.equal(e.live.length + e.soon.length, 0);
});

test('nowKindRank (v1.24 C1): happy hours first, then lunch and specials', () => {
  assert.equal(L24.nowKindRank({ kind: 'happy_hour' }), 0);
  assert.equal(L24.nowKindRank({ kind: 'lunch' }), 1);
  assert.equal(L24.nowKindRank({ kind: 'special' }), 1);
});

test('windowLine (v1.24 C1): an all-day special says so; a short one stays "Special"', () => {
  const v = venue({ SUN: [['10:00', '22:00']] }, [
    win(['SUN'], '11:00', '21:00', { kind: 'special' }),
    win(['SUN'], '16:00', '18:00', { kind: 'special' }),
  ]);
  assert.equal(L24.windowLine(v, v.windows[0]), 'All-day special · Sun 11am–9pm');
  assert.equal(L24.windowLine(v, v.windows[1]), 'Special · Sun 4–6pm');
});

// The page's three numbers, rebuilt the way index.html builds them: the "Live now (N)" heading
// and the Where sheet's "Show N live now" are nowEntries(filtered).live.length; the zone chips are
// zoneCountFor(selected, visibleHoods, stateHoods, liveCountsByHood(all venues)).
function zonesAsPage(venues) {
  const totals = {};
  venues.forEach((v) => { totals[v.hood] = (totals[v.hood] || 0) + 1; });
  const chips = L24.chipHoodsByZone(venues);
  return L24.ZONES.map((z) => {
    const visible = z.hoods.filter((h) => totals[h] > 0);
    return { key: z.key, visible, stateHoods: chips[z.key].length ? chips[z.key] : visible };
  }).filter((z) => z.visible.length);
}
test('v1.24 C1: "Live now (N)" = the Where sheet = the sum of the selected zone chips, on the real data', () => {
  const zones = zonesAsPage(VENUES24);
  const zoneOf = (k) => zones.find((z) => z.key === k);
  const none = new Set();
  const selections = { all: new Set(L24.hoodKeys()) };
  zones.forEach((z) => { selections[z.key + ' only'] = L24.applyZoneTap(none, z.key, z.stateHoods); });
  // A partly-on zone: Downtown, plus one Gulch & Midtown neighborhood.
  const part = L24.applyZoneTap(none, 'downtown', zoneOf('downtown').stateHoods);
  part.add(zoneOf('gulch').stateHoods[0]);
  selections['downtown + part of gulch'] = part;
  const times = [at24('SUN', 14, 14), at24('MON', 16, 45), at24('WED', 12, 0), at24('FRI', 17, 30),
    at24('SAT', 11, 30), at24('TUE', 3, 0), at24('THU', 22, 15)];
  let checked = 0;
  times.forEach((now) => {
    const counts = L24.liveCountsByHood(VENUES24, now);
    Object.keys(selections).forEach((name) => {
      const sel = selections[name];
      const heading = L24.nowEntries(L24.applyHoodFilter(VENUES24, { selected: sel }), now).live.length;
      const chips = zones.reduce((n, z) => {
        if (L24.zoneChipState(sel, z.stateHoods).state === 'none') return n;
        return n + L24.zoneCountFor(sel, z.visible, z.stateHoods, counts);
      }, 0);
      assert.equal(chips, heading, `${name} at ${now.dayOfWeek} ${now.hour}:${now.minute}`);
      checked++;
    });
  });
  assert.ok(checked >= 60);
  // TJ's 14:14 case: Downtown only on Sunday.
  const dn = L24.nowEntries(L24.applyHoodFilter(VENUES24, { selected: selections['downtown only'] }), at24('SUN', 14, 14));
  assert.ok(dn.live.length >= 3, 'the two all-day cards now count under Live now');
});
test('v1.24 C1: the identity above holds because every hood with a deal window has a chip', () => {
  const chips = new Set([].concat(...Object.values(L24.chipHoodsByZone(VENUES24))));
  VENUES24.filter((v) => v.windows.length).forEach((v) => assert.ok(chips.has(v.hood), v.name + ' / ' + v.hood));
});

// ---- C2: one plain sentence instead of the red badges ----
const HRS24 = { MON: [['11:00', '16:30']], TUE: [['11:00', '23:00']], WED: [['11:00', '23:00']], THU: [['11:00', '23:00']] };
test('hoursCaveat (v1.24 C2): outside the posted hours on one day', () => {
  const v = venue(HRS24, [win(['MON', 'TUE', 'WED', 'THU'], '16:30', '18:30')]);
  assert.equal(L24.hoursCaveat(v, v.windows[0]),
    'Heads up: posted hours on Mon are 11am–4:30pm, which don’t cover this happy hour. Call ahead.');
  assert.equal(L24.hasHoursCaveat(v, v.windows[0]), true);
});
test('hoursCaveat (v1.24 C2): a posted closed day', () => {
  const v = venue({ TUE: [['16:30', '21:30']], WED: [['16:30', '21:30']] }, [win(['MON', 'TUE', 'WED'], '16:30', '18:30')]);
  assert.equal(L24.hoursCaveat(v, v.windows[0]), 'Heads up: posted hours say closed on Mon. Call ahead.');
});
test('hoursCaveat (v1.24 C2): no hours on file', () => {
  const v = venue({}, [win(['MON'], '16:00', '18:00')]);
  assert.equal(L24.hoursCaveat(v, v.windows[0]), 'We don’t have this venue’s hours. Call ahead.');
});
test('hoursCaveat (v1.24 C2): "until close" on a closed day says the closing time isn’t posted', () => {
  const v = venue({ SAT: [['11:00', '23:00']] }, [win(['SAT', 'SUN'], '11:00', 'close', { kind: 'special' })]);
  assert.equal(L24.hoursCaveat(v, v.windows[0]),
    'Heads up: posted hours say closed on Sun. Closing time isn’t posted. Call ahead.');
});
test('hoursCaveat (v1.24 C2): days with the same hours group with formatDays; two groups both show', () => {
  const v = venue({ TUE: [['16:30', '21:00']], WED: [['16:30', '21:00']], THU: [['16:30', '21:00']], FRI: [['16:30', '23:00']] },
    [win(['TUE', 'WED', 'THU'], '16:00', '18:00'), win(['TUE', 'WED', 'THU', 'FRI'], '16:00', '18:00', { kind: 'lunch' })]);
  assert.equal(L24.hoursCaveat(v, v.windows[0]),
    'Heads up: posted hours on Tue–Thu are 4:30–9pm, which don’t cover this happy hour. Call ahead.');
  assert.equal(L24.hoursCaveat(v, v.windows[1]),
    'Heads up: posted hours on Tue–Thu are 4:30–9pm and on Fri 4:30–11pm, which don’t cover this lunch deal. Call ahead.');
});
test('hoursCaveat (v1.24 C2): a closed day plus three different hours stays one short sentence', () => {
  const v = venue({ TUE: [['17:00', '21:00']], WED: [['17:00', '21:00']], THU: [['17:00', '22:00']], FRI: [['17:00', '23:00']] },
    [win(['MON', 'TUE', 'WED', 'THU', 'FRI'], '16:00', '18:00')]);
  assert.equal(L24.hoursCaveat(v, v.windows[0]),
    'Heads up: posted hours say closed on Mon, and on Tue–Fri don’t fully cover this happy hour. Call ahead.');
});
test('hoursCaveat (v1.24 C2): a split day lists both ranges; a covered window says nothing', () => {
  const v = venue({ MON: [['07:00', '15:00'], ['17:00', '00:00']] },
    [win(['MON'], '15:00', '18:00'), win(['MON'], '17:00', '19:00')]);
  assert.equal(L24.hoursCaveat(v, v.windows[0]),
    'Heads up: posted hours on Mon are 7am–3pm, 5pm–12am, which don’t cover this happy hour. Call ahead.');
  assert.equal(L24.hoursCaveat(v, v.windows[1]), '');
  assert.equal(L24.hasHoursCaveat(v, v.windows[1]), false);
});

test('index.html (v1.24): one live list, no red badges, --bad only for #fatal and .debug-pos', () => {
  const fs = require('node:fs');
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  assert.ok(!html.includes('All-day specials ('), 'no All-day specials section');
  assert.ok(!html.includes('allDay'), 'no third list');
  ['Hours conflict', 'Outside posted hours', 'Close time assumed', "badge warn", "'warn'", 'Red: a real problem']
    .forEach((t) => assert.ok(!html.includes(t), t));
  assert.ok(html.includes('return L.nowEntries(filteredVenues(), state.now).live.length;'), 'Where sheet count');
  assert.ok(html.includes('var entries = L.nowEntries(filteredVenues(), state.now);'), 'Live now heading');
  assert.ok(html.includes('var live = L.liveCountsByHood(state.venues, state.now);'), 'zone counts');
  // Every rule that reads var(--bad), by selector.
  const users = [];
  html.replace(/([^{}]+)\{[^{}]*var\(--bad\)[^{}]*\}/g, (m, sel) => { users.push(sel.trim().split('\n').pop().trim()); return m; });
  assert.deepEqual(users.sort(), ['#fatal', '.debug-pos']);
  assert.ok(!/(^|[^-])--bad[^:)]/m.test(html.replace(/var\(--bad\)/g, '')), 'no other --bad use');
});
