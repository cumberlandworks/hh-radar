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
  CORE_ZONE_KEYS, MAP_EXTENT, MAP_EXEMPT_HOODS, MAP_VIEW_W, MAP_VIEW_H,
  ZONE_POLYGONS, ZONE_LABEL_ANCHORS, ZONE_MAP_LABELS, RIVER, INTERSTATES,
  zoneContains, zoneLabelBoxes, rectsIntersect, projectToView,
  labelBlockClearance, dayCoverageCounts, hasIntervalOn, pickSurprise,
  windowHasFood, windowHasDrink, composeNote,
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


// ---- C3 (v1.4): the hand-authored zone map ----
// The v1.3 Voronoi tests above stay green on purpose: voronoiCells is no longer
// what the map renders, but it remains the geometric cross-check on the hood
// centroids. These tests cover what IS rendered.

function coreVenuesForMap() {
  const venues = require(path.join(__dirname, '..', 'venues.json')).venues;
  return venues.filter((v) => isCoreHood(v.hood) && !MAP_EXEMPT_HOODS.includes(v.hood));
}

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

// ==================== v1.5 C3: pickSurprise ====================
// A fixed rng makes every pick deterministic; nothing here touches Math.random.
const fixedRng = (v) => () => v;
function cand(name, tier, deals, startAbs) {
  return {
    venue: { id: 'ik-' + name, name: name },
    win: win(['TUE'], '15:00', '18:00', { deals: deals }),
    tier: tier,
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
  }
});

test('pickSurprise: with no food in the tier the drink-only pool is used rather than nothing', () => {
  const res = pickSurprise([cand('DrinkA', 'live', DRINK)], fixedRng(0.5), { prefer: 'food' });
  assert.equal(res.pick.venue.name, 'DrinkA');
  assert.equal(res.tier, 'live');
});

test('pickSurprise: prefer:drink mirrors the rule (drink pool wins over food)', () => {
  const res = pickSurprise([cand('FoodA', 'live', FOOD), cand('DrinkA', 'live', DRINK)],
    fixedRng(0.9), { prefer: 'drink' });
  assert.equal(res.pick.venue.name, 'DrinkA');
});

test('pickSurprise: falls back live -> soon when nothing is live', () => {
  const res = pickSurprise([cand('SoonA', 'soon', FOOD, 30), cand('LaterA', 'later', FOOD, 900)],
    fixedRng(0), { prefer: 'food' });
  assert.equal(res.tier, 'soon');
  assert.equal(res.pick.venue.name, 'SoonA');
});

test('pickSurprise: falls back soon -> later, and "later" narrows to the earliest start only', () => {
  const res = pickSurprise([
    cand('Late9am', 'later', FOOD, 600),
    cand('Earliest', 'later', FOOD, 300),
    cand('AlsoEarliest', 'later', FOOD, 300),
  ], fixedRng(0), { prefer: 'food' });
  assert.equal(res.tier, 'later');
  assert.equal(res.poolSize, 2, 'only the ties at the single earliest start are eligible');
  assert.ok(['Earliest', 'AlsoEarliest'].includes(res.pick.venue.name));
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

// ==================== v1.5 C4: the grid coverage footer ====================
test('dayCoverageCounts: the three groups partition the roster on EVERY day', () => {
  const venues = require(path.join(__dirname, '..', 'venues.json')).venues;
  ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].forEach((d) => {
    const c = dayCoverageCounts(venues, d);
    assert.equal(c.onDay + c.otherDays + c.none, venues.length,
      d + ': ' + c.onDay + ' + ' + c.otherDays + ' + ' + c.none + ' != ' + venues.length);
    assert.equal(c.otherList.length, c.otherDays);
  });
});

test('dayCoverageCounts: measured SUN and TUE against venues.json', () => {
  const venues = require(path.join(__dirname, '..', 'venues.json')).venues;
  const sun = dayCoverageCounts(venues, 'SUN');
  assert.deepEqual({ onDay: sun.onDay, otherDays: sun.otherDays, none: sun.none },
    { onDay: 34, otherDays: 35, none: 67 });
  const tue = dayCoverageCounts(venues, 'TUE');
  assert.deepEqual({ onDay: tue.onDay, otherDays: tue.otherDays, none: tue.none },
    { onDay: 58, otherDays: 11, none: 67 });
});

test('dayCoverageCounts: "none" is exactly the verified_no_hh roster, not a day artefact', () => {
  const venues = require(path.join(__dirname, '..', 'venues.json')).venues;
  const noWindows = venues.filter((v) => v.windows.length === 0).length;
  ['MON', 'SUN'].forEach((d) => assert.equal(dayCoverageCounts(venues, d).none, noWindows));
});

test('dayCoverageCounts: it filters, so a zone selection changes onDay but never breaks the sum', () => {
  const venues = require(path.join(__dirname, '..', 'venues.json')).venues;
  const east = venues.filter((v) => v.zone === 'east');
  const c = dayCoverageCounts(east, 'SUN');
  assert.equal(c.onDay + c.otherDays + c.none, east.length);
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
