// hh-radar shared pure logic: window resolution + schema/semantic validation.
// No `new Date()` / `Date.now()` / `Math.random()` in here — every function takes
// its clock as an explicit argument so tests can inject it and results never rot.
// Loaded by index.html via <script src="logic.js"> and by Node (tests, validate.js)
// via require(). Works in both environments (no import/export syntax).
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.hhRadarLogic = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
  var DAY_INDEX = { MON: 0, TUE: 1, WED: 2, THU: 3, FRI: 4, SAT: 5, SUN: 6 };
  var HHMM_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

  function parseHM(hm) {
    var parts = hm.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  // dateInTz: {year, month, day, hour, minute, dayOfWeek} — dayOfWeek is one of DAYS,
  // already resolved to the venue's timezone wall-clock by the caller (index.html uses
  // Intl.DateTimeFormat; tests pass fixtures directly). This function does no tz math.
  function minutesSinceWeekStart(dateInTz) {
    return DAY_INDEX[dateInTz.dayOfWeek] * 1440 + dateInTz.hour * 60 + dateInTz.minute;
  }

  function lastCloseMinutes(hours, day) {
    var ranges = hours && hours[day];
    if (!ranges || ranges.length === 0) return null;
    var maxEnd = -1;
    for (var i = 0; i < ranges.length; i++) {
      var end = parseHM(ranges[i][1]);
      if (end > maxEnd) maxEnd = end;
    }
    return maxEnd;
  }

  // Resolves a window's [start, end) into absolute minutes since the venue's week
  // start (MON 00:00 = 0), for the week containing `days[i]`. Returns one interval
  // per day in `days`. `end` may roll onto the next day.
  function resolveWindow(venue, win) {
    var out = [];
    for (var i = 0; i < win.days.length; i++) {
      var day = win.days[i];
      var dayBase = DAY_INDEX[day] * 1440;
      var startMin = dayBase + parseHM(win.start);
      var endMin;
      var warnings = [];
      var hoursForDay = venue.hours && venue.hours[day];
      if (!hoursForDay || hoursForDay.length === 0) warnings.push('closed-day-per-hours');
      if (win.end === 'close') {
        var close = lastCloseMinutes(venue.hours, day);
        if (close === null) {
          endMin = dayBase + 23 * 60 + 59;
          warnings.push('missing-hours-fallback-2359');
        } else {
          var closeAbs = dayBase + close;
          endMin = closeAbs <= startMin ? closeAbs + 1440 : closeAbs;
        }
      } else {
        var endHM = parseHM(win.end);
        endMin = dayBase + endHM;
        if (endHM <= parseHM(win.start)) endMin += 1440;
      }
      out.push({ day: day, startAbs: startMin, endAbs: endMin, warnings: warnings });
    }
    return out;
  }

  // t: absolute minutes since MON 00:00 for "now", already wrapped to [0, 10080).
  function isActive(venue, win, dateInTz) {
    var t = minutesSinceWeekStart(dateInTz);
    var intervals = resolveWindow(venue, win);
    for (var i = 0; i < intervals.length; i++) {
      var iv = intervals[i];
      if (inIntervalWrapped(t, iv.startAbs, iv.endAbs)) return true;
    }
    return false;
  }

  function inIntervalWrapped(t, start, end) {
    // Check t, t+10080, t-10080 against [start, end) to handle week-boundary wraps
    // (e.g. a SUN 22:00-02:00 window observed on MON 01:00).
    var candidates = [t, t + 10080, t - 10080];
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (c >= start && c < end) return true;
    }
    return false;
  }

  function minutesUntilWrapped(t, start) {
    var diff = start - t;
    while (diff < 0) diff += 10080;
    return diff;
  }

  // True if `win` is not active now but starts within `withinMin` minutes (default 120).
  // opts.excludeAllDay: treat an all-day window (see isAllDay) as never "starting soon".
  function startsWithin(venue, win, dateInTz, withinMin, opts) {
    if (withinMin === undefined) withinMin = 120;
    opts = opts || {};
    if (opts.excludeAllDay && isAllDay(venue, win)) return false;
    if (isActive(venue, win, dateInTz)) return false;
    var t = minutesSinceWeekStart(dateInTz);
    var intervals = resolveWindow(venue, win);
    for (var i = 0; i < intervals.length; i++) {
      var mins = minutesUntilWrapped(t, intervals[i].startAbs);
      if (mins <= withinMin) return true;
    }
    return false;
  }

  // Earliest future start (in minutes-from-now) across all windows of `venue`.
  // Returns {minutesFromNow, day, start} or null if venue has no windows.
  // opts.excludeAllDay: skip all-day windows entirely (they shouldn't win "next start").
  function nextStart(venue, dateInTz, opts) {
    opts = opts || {};
    var t = minutesSinceWeekStart(dateInTz);
    var best = null;
    for (var w = 0; w < venue.windows.length; w++) {
      var win = venue.windows[w];
      if (opts.excludeAllDay && isAllDay(venue, win)) continue;
      var intervals = resolveWindow(venue, win);
      for (var i = 0; i < intervals.length; i++) {
        var mins = minutesUntilWrapped(t, intervals[i].startAbs);
        if (best === null || mins < best.minutesFromNow) {
          best = { minutesFromNow: mins, day: intervals[i].day, start: win.start, window: win };
        }
      }
    }
    return best;
  }

  // Earliest future start across ALL venues (for the NOW-view empty state).
  function nextStartAcrossVenues(venues, dateInTz, opts) {
    opts = opts || {};
    var best = null;
    for (var i = 0; i < venues.length; i++) {
      var ns = nextStart(venues[i], dateInTz, opts);
      if (ns && (best === null || ns.minutesFromNow < best.next.minutesFromNow)) {
        best = { venue: venues[i], next: ns };
      }
    }
    return best;
  }

  // Minutes remaining until the currently-active interval of `win` ends (null if not active now).
  function minutesUntilEnd(venue, win, dateInTz) {
    var t = minutesSinceWeekStart(dateInTz);
    var intervals = resolveWindow(venue, win);
    var best = null;
    for (var i = 0; i < intervals.length; i++) {
      var iv = intervals[i];
      var candidates = [t, t + 10080, t - 10080];
      for (var j = 0; j < candidates.length; j++) {
        var c = candidates[j];
        if (c >= iv.startAbs && c < iv.endAbs) {
          var remaining = iv.endAbs - c;
          if (best === null || remaining < best) best = remaining;
        }
      }
    }
    return best;
  }

  // Minutes until `win`'s next start (regardless of the 120-minute "soon" threshold).
  function minutesUntilNextStart(venue, win, dateInTz) {
    var t = minutesSinceWeekStart(dateInTz);
    var intervals = resolveWindow(venue, win);
    var best = null;
    for (var i = 0; i < intervals.length; i++) {
      var mins = minutesUntilWrapped(t, intervals[i].startAbs);
      if (best === null || mins < best) best = mins;
    }
    return best;
  }

  // ---- C4: all-day / not-a-real-time-bound "special" detection ----
  // v1.2 fix: BOTH rules are gated on kind === 'special'. A `happy_hour`-kind
  // window is never all-day for ranking purposes, however long its span (Blue
  // Sushi 11:00-18:30, Playdate 11:00-20:00 are real, time-bound happy hours).
  // Only a `special` window — (a) with a resolved span >= 5 hours on any day
  // it runs, or (b) starting before 14:00 (the common "available all day,
  // every day" capture pattern) — counts as all-day.
  function isAllDay(venue, win) {
    if (win.kind !== 'special') return false;
    var intervals = resolveWindow(venue, win);
    for (var i = 0; i < intervals.length; i++) {
      if (intervals[i].endAbs - intervals[i].startAbs >= 300) return true;
    }
    if (parseHM(win.start) < 14 * 60) return true;
    return false;
  }

  // ---- C1 (v1.2): pick the best link for "see the happy hour info" ----
  // Preference order: (1) the window's own source whose hostname matches the
  // venue's official_site hostname (the source most likely to BE the official
  // happy-hour page, not a third-party aggregator); (2) otherwise the first
  // listed source; (3) otherwise the venue's official site; (4) otherwise the
  // inKind listing. Hostname compare ignores a leading "www." so
  // "https://x.com" and "https://www.x.com/menu" still match.
  function hostnameOf(url) {
    try { return new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return null; }
  }
  function bestSourceUrl(venue, win) {
    var sources = (win && win.sources) || [];
    var officialHost = venue && venue.official_site ? hostnameOf(venue.official_site) : null;
    if (officialHost) {
      for (var i = 0; i < sources.length; i++) {
        if (hostnameOf(sources[i]) === officialHost) return sources[i];
      }
    }
    if (sources.length) return sources[0];
    if (venue && venue.official_site) return venue.official_site;
    return venue && venue.inkind_url;
  }

  // ---- C6: neighborhood nearest-centroid fallback ----
  // Small hand table of Nashville-metro neighborhood centroids, used only to
  // relabel venues whose neighborhood came from the old free-text heuristic
  // (see build script). Deterministic and testable; not meant to be precise
  // to the block/parcel level.
  var NEIGHBORHOOD_CENTROIDS = [
    { name: '12 South', lat: 36.1189, lon: -86.7902 },
    { name: 'The Gulch', lat: 36.1533, lon: -86.7853 },
    { name: 'Midtown', lat: 36.1500, lon: -86.8000 },
    { name: 'Downtown/SoBro', lat: 36.1627, lon: -86.7816 },
    { name: 'Germantown', lat: 36.1751, lon: -86.7908 },
    { name: 'East Nashville', lat: 36.1751, lon: -86.7539 },
    { name: 'Wedgewood-Houston', lat: 36.1385, lon: -86.7692 },
    { name: 'Sylvan Park/Charlotte', lat: 36.1500, lon: -86.8300 },
    { name: 'Berry Hill', lat: 36.1225, lon: -86.7778 },
    { name: 'Belle Meade/West', lat: 36.0870, lon: -86.8628 },
    { name: 'Bellevue', lat: 36.0723, lon: -86.9611 },
    { name: 'Franklin/Cool Springs', lat: 35.9300, lon: -86.8500 },
    { name: 'Brentwood', lat: 36.0331, lon: -86.7828 },
    { name: 'Murfreesboro', lat: 35.8456, lon: -86.3903 },
    { name: 'Hendersonville', lat: 36.3048, lon: -86.6200 },
    { name: 'Mt. Juliet', lat: 36.2001, lon: -86.5186 },
    { name: 'Smyrna', lat: 35.9828, lon: -86.5186 },
    { name: 'Gallatin', lat: 36.3883, lon: -86.4472 },
    { name: 'Antioch/Hermitage', lat: 36.1000, lon: -86.6300 },
  ];

  function haversineMiles(lat1, lon1, lat2, lon2) {
    var R = 3958.8;
    var toRad = function (d) { return d * Math.PI / 180; };
    var dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function nearestNeighborhood(lat, lon) {
    var best = null, bestDist = Infinity;
    for (var i = 0; i < NEIGHBORHOOD_CENTROIDS.length; i++) {
      var c = NEIGHBORHOOD_CENTROIDS[i];
      var d = haversineMiles(lat, lon, c.lat, c.lon);
      if (d < bestDist) { bestDist = d; best = c.name; }
    }
    return best;
  }

  // ---- ZONE model (v1.3): 8 zones grouping the 21 canonical hood keys ----
  // Two tiers per TJ's ruling: ZONE is the default filter/map-color granularity,
  // HOOD is the finer chip revealed on demand. Every venue's `hood` (see
  // data-src/assign_hood_zone.js) is one of the 21 keys below; `zone` is derived
  // from it via zoneOf so the data file and this table can never disagree
  // (validateVenues checks venue.zone === zoneOf(venue.hood)).
  var ZONES = [
    { key: 'downtown', label: 'Downtown', hue: 205, hoods: ['Downtown/SoBro'] },
    { key: 'gulch', label: 'Gulch & Midtown', hue: 275, hoods: ['The Gulch', 'Midtown'] },
    { key: 'north', label: 'Germantown & North', hue: 150, hoods: ['Germantown'] },
    { key: 'east', label: 'East', hue: 340, hoods: ['East Nashville'] },
    { key: 'south', label: 'South', hue: 95, hoods: ['12 South', 'Wedgewood-Houston', 'Berry Hill'] },
    { key: 'west', label: 'West', hue: 190, hoods: ['Sylvan Park/Charlotte', 'Belle Meade / West Nashville', 'Bellevue'] },
    { key: 'franklin', label: 'Franklin & Brentwood', hue: 235, hoods: ['Brentwood', 'Franklin/Cool Springs'] },
    { key: 'outer', label: 'Outer suburbs', hue: 35, hoods: ['Antioch/Hermitage', 'Smyrna', 'Murfreesboro', 'Mt. Juliet', 'Hendersonville', 'Gallatin', 'Dickson', 'Lewisburg'] },
  ];
  // The 6 "core" zones get a Voronoi cell on the map; "franklin" and "outer" render
  // as suburb tiles instead (C4). This is a zone-membership choice, not a raw
  // bbox-containment test -- see CHANGELOG for why (Brentwood's centroid falls
  // just inside the stated bbox despite being a suburb by design).
  var CORE_ZONE_KEYS = ['downtown', 'gulch', 'north', 'east', 'south', 'west'];

  function hoodKeys() {
    var out = [];
    ZONES.forEach(function (z) { z.hoods.forEach(function (h) { out.push(h); }); });
    return out;
  }

  function zoneOf(hood) {
    for (var i = 0; i < ZONES.length; i++) {
      if (ZONES[i].hoods.indexOf(hood) !== -1) return ZONES[i].key;
    }
    return null;
  }

  function isCoreHood(hood) {
    return CORE_ZONE_KEYS.indexOf(zoneOf(hood)) !== -1;
  }

  // Core-metro bbox for the map (C4): chosen to hold every core hood's centroid
  // with margin. Shared by index.html (rendering) and the tests (geometry checks)
  // so the two can never drift apart.
  var CORE_MAP_BBOX = { minLat: 36.03, maxLat: 36.26, minLon: -86.97, maxLon: -86.63 };

  // One lat/lon centroid per core hood, for the Voronoi map. Reuses
  // NEIGHBORHOOD_CENTROIDS (11 of its 19 entries are core hoods; the name differs
  // for exactly one -- the hood key is "Belle Meade / West Nashville" per C1,
  // the centroid is named "Belle Meade/West") plus that one rename.
  var CENTROID_RENAME = { 'Belle Meade/West': 'Belle Meade / West Nashville' };
  function coreHoodCentroids() {
    var out = [];
    NEIGHBORHOOD_CENTROIDS.forEach(function (c) {
      var hood = CENTROID_RENAME[c.name] || c.name;
      if (isCoreHood(hood)) out.push({ hood: hood, lat: c.lat, lon: c.lon });
    });
    return out;
  }

  // ---- C2 (v1.3): pure hood-filter model ----
  // filterState = { selected: Set<hoodKey> }. An empty Set is a legitimate "none
  // selected" state -- callers must not treat it as "unset".
  function applyHoodFilter(venues, filterState) {
    var selected = filterState && filterState.selected;
    if (!selected) return venues.slice();
    return venues.filter(function (v) { return selected.has(v.hood); });
  }

  // localStorage round-trip helpers (kept pure/testable; the try/catch around the
  // actual localStorage calls lives in index.html, matching the existing
  // hhradar-priority/hhradar-gridsort pattern -- see P4).
  function serializeHoodSelection(selected) {
    return Array.from(selected);
  }
  // Unknown keys are dropped silently. An empty array is a legitimate "none
  // selected" result (returns an empty Set, not null) -- only a non-array input
  // (missing/corrupt storage) returns null so the caller can fall back to "all".
  function deserializeHoodSelection(raw, knownKeys) {
    if (!Array.isArray(raw)) return null;
    var known = {};
    knownKeys.forEach(function (k) { known[k] = true; });
    var out = new Set();
    raw.forEach(function (k) { if (known[k]) out.add(k); });
    return out;
  }

  // ---- C4 (v1.3): Voronoi partition of the core-metro bbox, for the map ----
  // Pure 2D computational geometry -- no notion of the globe. Callers project
  // lat/lon to this plane first with projectLatLon (equirectangular: cos of mean
  // latitude scales x) so distances in this space approximate ground distance
  // closely enough, over a bbox this small, for a Voronoi diagram to be a sane
  // visual approximation of "nearest neighborhood."
  function projectLatLon(lat, lon, meanLatRad) {
    return [lon * Math.cos(meanLatRad), lat];
  }

  function polygonArea(poly) {
    var sum = 0;
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      sum += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(sum) / 2;
  }

  function pointInPolygon(pt, poly) {
    var x = pt[0], y = pt[1], inside = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
      var hit = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
      if (hit) inside = !inside;
    }
    return inside;
  }

  // Clips convex polygon `poly` to the half-plane {p : dot(p, n) <= c}
  // (Sutherland-Hodgman, one half-plane at a time).
  function clipHalfPlane(poly, n, c) {
    if (poly.length === 0) return poly;
    var out = [];
    for (var i = 0; i < poly.length; i++) {
      var curr = poly[i], prev = poly[(i - 1 + poly.length) % poly.length];
      var currDot = curr[0] * n[0] + curr[1] * n[1];
      var prevDot = prev[0] * n[0] + prev[1] * n[1];
      var currIn = currDot <= c + 1e-9;
      var prevIn = prevDot <= c + 1e-9;
      if (currIn) {
        if (!prevIn) out.push(intersectEdge(prev, curr, n, c));
        out.push(curr);
      } else if (prevIn) {
        out.push(intersectEdge(prev, curr, n, c));
      }
    }
    return out;
  }

  function intersectEdge(a, b, n, c) {
    var da = a[0] * n[0] + a[1] * n[1];
    var db = b[0] * n[0] + b[1] * n[1];
    var t = (c - da) / (db - da);
    return [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])];
  }

  // points: [{key, x, y}, ...] already projected. bbox: {minX, minY, maxX, maxY}
  // in the same projected plane. Returns [{key, polygon: [[x,y], ...]}, ...] --
  // one convex polygon per point, clipped to the bbox and to every other point's
  // perpendicular-bisector half-plane (the point's Voronoi cell inside the bbox).
  function voronoiCells(points, bbox) {
    var boxPoly = [
      [bbox.minX, bbox.minY], [bbox.maxX, bbox.minY],
      [bbox.maxX, bbox.maxY], [bbox.minX, bbox.maxY],
    ];
    return points.map(function (p) {
      var cell = boxPoly;
      points.forEach(function (q) {
        if (q === p) return;
        var n = [q.x - p.x, q.y - p.y];
        var mid = [(p.x + q.x) / 2, (p.y + q.y) / 2];
        var c = n[0] * mid[0] + n[1] * mid[1];
        cell = clipHalfPlane(cell, n, c);
      });
      return { key: p.key, polygon: cell };
    });
  }

  // ---- C5: WARN-level lint for research prose leaking into deal text ----
  // Not a schema error: validateVenues still returns [] (pass) when only lint
  // hits are present. Callers that want a hard failure pass strict:true.
  var LINT_DEAL_DESC_RE = /\b(source|sources|confirm|confirmed|likely|typo|per |verified|appears|re-check)\b/i;
  function lintDealDesc(desc) {
    var reasons = [];
    if (LINT_DEAL_DESC_RE.test(desc)) reasons.push('research-language');
    var parens = desc.match(/\(([^)]*)\)/g) || [];
    if (parens.some(function (p) { return p.length > 40; })) reasons.push('long-parenthetical');
    if (desc.length > 140) reasons.push('too-long');
    return reasons;
  }
  function lintVenues(data) {
    var warnings = [];
    (data.venues || []).forEach(function (v) {
      (v.windows || []).forEach(function (w, wi) {
        (w.deals || []).forEach(function (d, di) {
          var reasons = lintDealDesc(d.desc || '');
          if (reasons.length) {
            warnings.push(v.name + '.windows[' + wi + '].deals[' + di + ']: ' + reasons.join(',') + ': "' + d.desc + '"');
          }
        });
      });
    });
    return warnings;
  }

  function daysBetween(a, b) {
    // a, b: {year, month, day} plain calendar dates (no time-of-day component).
    var da = Date.UTC(a.year, a.month - 1, a.day);
    var db = Date.UTC(b.year, b.month - 1, b.day);
    return Math.round((db - da) / 86400000);
  }

  function isStale(lastVerified, todayDate) {
    if (!lastVerified) return true;
    var parts = lastVerified.split('-').map(Number);
    var lv = { year: parts[0], month: parts[1], day: parts[2] };
    return daysBetween(lv, todayDate) > 60;
  }

  function isUnverified(win) {
    return win.confidence === 'low';
  }

  function windowWarnings(venue, win) {
    var intervals = resolveWindow(venue, win);
    var set = {};
    for (var i = 0; i < intervals.length; i++) {
      for (var j = 0; j < intervals[i].warnings.length; j++) set[intervals[i].warnings[j]] = true;
    }
    return Object.keys(set);
  }

  function windowHasFood(win) {
    for (var i = 0; i < win.deals.length; i++) {
      if (win.deals[i].type === 'food') return true;
    }
    return false;
  }

  // ---- Schema + semantic validation (shared by validate.js and in-page load guard) ----
  function validateVenues(data) {
    var errors = [];
    function fail(msg) { errors.push(msg); }

    if (!data || typeof data !== 'object') { fail('root: not an object'); return errors; }
    if (data.schema_version !== 1) fail('schema_version must be 1');
    if (typeof data.generated !== 'string') fail('generated must be a string');
    if (!Array.isArray(data.venues)) { fail('venues must be an array'); return errors; }

    var seenIds = {};
    var seenTz = {};
    var knownHoods = hoodKeys();

    for (var vi = 0; vi < data.venues.length; vi++) {
      var v = data.venues[vi];
      var p = 'venues[' + vi + '] (' + (v && v.name) + ')';

      if (!v || typeof v !== 'object') { fail(p + ': not an object'); continue; }
      if (typeof v.id !== 'string' || !/^ik-\d+$/.test(v.id)) fail(p + ': id must match ik-<int>');
      if (seenIds[v.id]) fail(p + ': duplicate id ' + v.id);
      seenIds[v.id] = true;
      if (typeof v.name !== 'string' || !v.name) fail(p + ': name required');
      if (typeof v.lat !== 'number') fail(p + ': lat must be a number');
      if (typeof v.lon !== 'number') fail(p + ': lon must be a number');
      if (typeof v.hood !== 'string' || knownHoods.indexOf(v.hood) === -1) fail(p + ': hood must be a known hood key');
      else if (typeof v.zone !== 'string' || v.zone !== zoneOf(v.hood)) fail(p + ': zone must equal zoneOf(hood)');
      if (v.tz !== 'America/Chicago') fail(p + ': tz must be America/Chicago');
      seenTz[v.tz] = true;
      if (v.inkind !== true) fail(p + ': inkind must be true in v1');
      if (v.status !== 'open') fail(p + ': status must be "open"');
      if (!Array.isArray(v.windows)) { fail(p + ': windows must be an array'); continue; }
      if (typeof v.verified_no_hh !== 'boolean') fail(p + ': verified_no_hh must be boolean');
      if (v.verified_no_hh !== (v.windows.length === 0)) {
        fail(p + ': verified_no_hh must equal (windows.length === 0)');
      }

      for (var wi = 0; wi < v.windows.length; wi++) {
        var w = v.windows[wi];
        var wp = p + '.windows[' + wi + ']';
        if (!w || typeof w !== 'object') { fail(wp + ': not an object'); continue; }
        if (!Array.isArray(w.days) || w.days.length === 0) fail(wp + ': days must be non-empty array');
        else {
          var seenDay = {};
          var lastIdx = -1;
          for (var di = 0; di < w.days.length; di++) {
            var d = w.days[di];
            if (DAY_INDEX[d] === undefined) fail(wp + ': invalid day ' + d);
            else {
              if (seenDay[d]) fail(wp + ': duplicate day ' + d);
              seenDay[d] = true;
              if (DAY_INDEX[d] < lastIdx) fail(wp + ': days not in week order');
              lastIdx = DAY_INDEX[d];
            }
          }
        }
        if (typeof w.start !== 'string' || !HHMM_RE.test(w.start)) fail(wp + ': start must be HH:MM');
        if (!(w.end === 'close' || (typeof w.end === 'string' && HHMM_RE.test(w.end)))) {
          fail(wp + ': end must be HH:MM or "close"');
        }
        if (w.kind !== 'happy_hour' && w.kind !== 'special') fail(wp + ': kind invalid');
        if (!Array.isArray(w.deals)) fail(wp + ': deals must be an array');
        else {
          for (var deIdx = 0; deIdx < w.deals.length; deIdx++) {
            var deal = w.deals[deIdx];
            if (!deal || (deal.type !== 'food' && deal.type !== 'drink')) {
              fail(wp + '.deals[' + deIdx + ']: type must be food|drink');
            }
            if (!deal || typeof deal.desc !== 'string' || !deal.desc) {
              fail(wp + '.deals[' + deIdx + ']: desc required');
            }
          }
        }
        if (!Array.isArray(w.sources) || w.sources.length === 0) fail(wp + ': sources must be non-empty');
        if (w.confidence !== 'high' && w.confidence !== 'med' && w.confidence !== 'low') {
          fail(wp + ': confidence invalid');
        }
        if (typeof w.corroborated !== 'boolean') fail(wp + ': corroborated must be boolean');
      }
    }

    var tzSet = Object.keys(seenTz);
    if (tzSet.length > 1) fail('multiple distinct venue.tz values found: ' + tzSet.join(', '));

    return errors;
  }

  return {
    DAYS: DAYS,
    DAY_INDEX: DAY_INDEX,
    parseHM: parseHM,
    resolveWindow: resolveWindow,
    isActive: isActive,
    startsWithin: startsWithin,
    nextStart: nextStart,
    nextStartAcrossVenues: nextStartAcrossVenues,
    isStale: isStale,
    isUnverified: isUnverified,
    windowHasFood: windowHasFood,
    windowWarnings: windowWarnings,
    validateVenues: validateVenues,
    minutesSinceWeekStart: minutesSinceWeekStart,
    minutesUntilEnd: minutesUntilEnd,
    minutesUntilNextStart: minutesUntilNextStart,
    isAllDay: isAllDay,
    bestSourceUrl: bestSourceUrl,
    haversineMiles: haversineMiles,
    nearestNeighborhood: nearestNeighborhood,
    NEIGHBORHOOD_CENTROIDS: NEIGHBORHOOD_CENTROIDS,
    lintDealDesc: lintDealDesc,
    lintVenues: lintVenues,
    ZONES: ZONES,
    CORE_ZONE_KEYS: CORE_ZONE_KEYS,
    hoodKeys: hoodKeys,
    zoneOf: zoneOf,
    isCoreHood: isCoreHood,
    CORE_MAP_BBOX: CORE_MAP_BBOX,
    coreHoodCentroids: coreHoodCentroids,
    applyHoodFilter: applyHoodFilter,
    serializeHoodSelection: serializeHoodSelection,
    deserializeHoodSelection: deserializeHoodSelection,
    projectLatLon: projectLatLon,
    polygonArea: polygonArea,
    pointInPolygon: pointInPolygon,
    voronoiCells: voronoiCells,
  };
});
