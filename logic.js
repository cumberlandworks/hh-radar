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
  // Display names, here rather than in index.html because surprisePools composes
  // the Later label ("tomorrow — Sat", "Sunday") and the label is part of what the
  // pool means — the tests assert it.
  var DAY_SHORT = { MON: 'Mon', TUE: 'Tue', WED: 'Wed', THU: 'Thu', FRI: 'Fri', SAT: 'Sat', SUN: 'Sun' };
  var DAY_LONG = { MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday', FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday' };

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

  // ---- v1.4 C3: hand-authored zone map ----
  // v1.3 drew the map as a Voronoi partition of the 11 core-hood centroids. Those
  // centroids sit within ~1.5 mi of each other while the bbox spanned ~20 mi, so
  // the labels piled onto one spot and Belle Meade/Bellevue owned two-thirds of the
  // canvas: shards, not a city. v1.4 replaces the RENDERING with six hand-authored
  // polygons, one per core zone, drawn to enclose that zone's own venues and to
  // follow the obvious edges (the Cumberland, I-40, I-65/I-440, Charlotte Ave).
  // voronoiCells + its tests are deliberately kept: they remain the geometric
  // cross-check that the hood centroids partition sanely.
  //
  // EXTENT: the block specified lat 36.09-36.22 / lon -86.90..-86.70. Measured
  // against venues.json that is too small on the north-east: East Nashville's
  // "E+ROSE - East Nashville" is at 36.2311 and "Gregorys Coffee - Opry Mills" at
  // -86.6947, both outside it, so no East polygon inside the stated extent could
  // contain its own venues. Widened to 36.09..36.24 / -86.90..-86.69, which leaves
  // exactly the two Bellevue venues outside — the two the block already expected to
  // be off-map (represented by the West polygon's western edge + a caption).
  var MAP_EXTENT = { minLat: 36.09, maxLat: 36.24, minLon: -86.90, maxLon: -86.69 };
  var MAP_EXEMPT_HOODS = ['Bellevue'];
  var MAP_VIEW_W = 320;
  var MAP_MEAN_LAT_RAD = (MAP_EXTENT.minLat + MAP_EXTENT.maxLat) / 2 * Math.PI / 180;
  var MAP_X_SCALE = Math.cos(MAP_MEAN_LAT_RAD);
  var MAP_VIEW_H = MAP_VIEW_W *
    ((MAP_EXTENT.maxLat - MAP_EXTENT.minLat) / ((MAP_EXTENT.maxLon - MAP_EXTENT.minLon) * MAP_X_SCALE));

  // Equirectangular projection into the SVG viewBox. Shared by the renderer and by
  // the label-overlap test so the two can never measure different geometry.
  function projectToView(lat, lon) {
    var minX = MAP_EXTENT.minLon * MAP_X_SCALE, maxX = MAP_EXTENT.maxLon * MAP_X_SCALE;
    return [
      (lon * MAP_X_SCALE - minX) / (maxX - minX) * MAP_VIEW_W,
      (MAP_EXTENT.maxLat - lat) / (MAP_EXTENT.maxLat - MAP_EXTENT.minLat) * MAP_VIEW_H,
    ];
  }

  // Containment runs on raw (lon, lat). Projecting only scales x by a positive
  // constant, and that affine map preserves inside/outside, so a point is in the
  // projected polygon exactly when it is in the lat/lon one.
  function zoneContains(zoneKey, lat, lon) {
    var poly = ZONE_POLYGONS[zoneKey];
    if (!poly) return false;
    var xy = [];
    for (var i = 0; i < poly.length; i++) xy.push([poly[i][1], poly[i][0]]);
    return pointInPolygon([lon, lat], xy);
  }

  // Short names on the map: the full zone labels ("Germantown & North") are ~108px
  // wide at 6px/char on a 320-wide viewBox — a third of the map. The pills keep the
  // full label; the map gets the short one.
  var ZONE_MAP_LABELS = {
    downtown: 'Downtown', gulch: 'Gulch', north: 'Germantown',
    east: 'East', south: 'South', west: 'West',
  };
  // Approximate advance widths used by both the renderer's layout assumptions and
  // the label-overlap test (the block's "approximate 6px/char").
  var ZONE_LABEL_FONT_PX = 11, ZONE_LABEL_CHAR_W = 6;
  var ZONE_SUB_FONT_PX = 9, ZONE_SUB_LINE_GAP = 10, ZONE_SUB_CHAR_W = 5;
  // Worst case second line: "NN today" / "NN live" -> 8 characters.
  var ZONE_SUB_MAX_CHARS = 8;

  // The rendered label block for one zone, in view space: the name line plus the
  // count line beneath it. v1.5 C5 fixes a modelling bug here — the box used to be
  // sized from the NAME alone, but the count line is often the wider of the two
  // ("Gulch" measures 32.2 units, "15 today" measures 39.0), so the old box
  // understated the footprint of every short-named zone and the overlap test could
  // not see the Gulch/Downtown crowding at all.
  function zoneLabelBox(zoneKey) {
    var a = ZONE_LABEL_ANCHORS[zoneKey];
    if (!a) return null;
    var xy = projectToView(a[0], a[1]);
    var nameW = (ZONE_MAP_LABELS[zoneKey] || zoneKey).length * ZONE_LABEL_CHAR_W;
    var subW = ZONE_SUB_MAX_CHARS * ZONE_SUB_CHAR_W;
    var w = Math.max(nameW, subW);
    return {
      zone: zoneKey,
      x: xy[0] - w / 2, y: xy[1] - ZONE_LABEL_FONT_PX,
      w: w, h: ZONE_LABEL_FONT_PX + ZONE_SUB_LINE_GAP,
      nameW: nameW, subW: subW,
    };
  }

  // Signed clearance between two label blocks: positive = the gap between them on
  // whichever axis separates them; negative = they genuinely overlap (the depth of
  // the smaller overlap). Overlapping on one axis alone is fine — that is what the
  // Gulch/Downtown pair does, 0.9 units of horizontal overlap 9.7 units apart.
  function labelBlockClearance(a, b) {
    var dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
    var dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
    if (dx >= 0 || dy >= 0) return Math.max(dx, dy);
    return Math.max(dx, dy); // both negative -> real overlap, closest to 0 is the depth
  }
  function zoneLabelBoxes() {
    var out = [];
    for (var i = 0; i < CORE_ZONE_KEYS.length; i++) {
      var b = zoneLabelBox(CORE_ZONE_KEYS[i]);
      if (b) out.push(b);
    }
    return out;
  }
  function rectsIntersect(a, b) {
    return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  }

  // ==== BEGIN ZONE MAP DATA (v1.4 C3) ====
  // Vertices are [lat, lon]. Source: the venue coordinates in venues.json (every
  // core venue outside the two Bellevue ones must fall inside its own zone's
  // polygon — see tests/windows.test.js), snapped outward to the obvious edges:
  // the Cumberland River (downtown/north vs east), I-40 (gulch/midtown vs
  // germantown), I-65 and I-440 (the southern edge of the core), and Charlotte
  // Ave / Richland Creek (the west divide). See CHANGELOG v1.4 for the derivation.
  var ZONE_POLYGONS = {
    // Downtown/SoBro. The west edge carries the notch that keeps koshō and The
    // Herban Perk & Pantry in the Gulch while City Winery (south-west of both) and
    // Legendary Wings (north-east of both) stay Downtown — the data's own hood
    // labels interleave along this seam, so no straight boundary can split them.
    downtown: [
      [36.1735, -86.7830],
      [36.1735, -86.7745],
      [36.1620, -86.7700],
      [36.1560, -86.7640],
      [36.1490, -86.7600],
      [36.1465, -86.7680],
      [36.1465, -86.7790],
      [36.1531, -86.7778],
      [36.1537, -86.7724],
      [36.1573, -86.7757],
      [36.1600, -86.7815],
      [36.1655, -86.7860],
    ],
    // The Gulch & Midtown. Shares Downtown's notched edge vertex-for-vertex (in
    // reverse) so the two regions abut exactly, with no sliver between them.
    gulch: [
      [36.1655, -86.7860],
      [36.1600, -86.7815],
      [36.1573, -86.7757],
      [36.1537, -86.7724],
      [36.1531, -86.7778],
      [36.1465, -86.7790],
      [36.1450, -86.7860],
      [36.1330, -86.8000],
      [36.1500, -86.8150],
      [36.1645, -86.8150],
    ],
    // Germantown & North: I-40 at the south, the river at the east, Charlotte Ave /
    // Richland Creek (lon -86.815) at the west.
    north: [
      [36.2400, -86.8150],
      [36.2400, -86.7558],
      [36.2150, -86.7628],
      [36.1900, -86.7628],
      [36.1800, -86.7698],
      [36.1735, -86.7745],
      [36.1735, -86.7830],
      [36.1655, -86.7860],
      [36.1645, -86.8150],
    ],
    // East Nashville: everything east of the Cumberland, out to Opry Mills.
    // v1.5 C5: north of Downtown (lat >= 36.1735) the western edge is now the
    // RIVER polyline vertex-for-vertex, not a line ~0.0008 lon east of it. The
    // old offset left the river stroke drawn just inside Germantown instead of
    // on the seam (measured 1.22 view units on the 320-unit canvas, ~1.3 CSS px
    // at the 390px render). `north` and `downtown` carry the same five vertices
    // so all three regions still abut exactly, with no sliver between them.
    east: [
      [36.2400, -86.7558],
      [36.2150, -86.7628],
      [36.1900, -86.7628],
      [36.1800, -86.7698],
      [36.1735, -86.7745],
      [36.1620, -86.7700],
      [36.1560, -86.7640],
      [36.1490, -86.7600],
      [36.1300, -86.7560],
      [36.0900, -86.7430],
      [36.0900, -86.6900],
      [36.2400, -86.6900],
    ],
    // 12South, Wedgewood-Houston and Berry Hill, down past I-440 to the county line.
    south: [
      [36.1465, -86.7680],
      [36.1490, -86.7600],
      [36.1300, -86.7560],
      [36.0900, -86.7430],
      [36.0900, -86.8320],
      [36.1150, -86.8150],
      [36.1330, -86.8000],
      [36.1450, -86.7860],
      [36.1465, -86.7790],
    ],
    // Sylvan Park, Charlotte Ave and Belle Meade. Its western edge stands in for
    // Bellevue, which is off the map (see the '\u2190 Bellevue' caption).
    west: [
      [36.2400, -86.9000],
      [36.2400, -86.8150],
      [36.1645, -86.8150],
      [36.1500, -86.8150],
      [36.1330, -86.8000],
      [36.1150, -86.8150],
      [36.0900, -86.8320],
      [36.0900, -86.9000],
    ],
  };

  // Hand-set, not centroids: every one of these zones is L-shaped or wedge-shaped
  // enough that its centroid lands somewhere unhelpful.
  var ZONE_LABEL_ANCHORS = {
    downtown: [36.1610, -86.7745],
    // v1.5 C5: the Gulch block sat 2.5 view units from Downtown's name line and
    // its wider second line ("15 today") ran 0.9 units under Downtown's box.
    // Pulled west/south into the wide part of the Gulch polygon; the clearance
    // test below (labelBlockClearance) now enforces >= 4 units on every pair.
    gulch: [36.1415, -86.8075],
    north: [36.1950, -86.7900],
    east: [36.1750, -86.7150],
    south: [36.1150, -86.7800],
    west: [36.1300, -86.8600],
  };

  // The Cumberland, south -> north (the order the bank test relies on). Drawn as
  // the Downtown/Germantown vs East divider the block asked for, which puts it
  // within ~450 m of the true channel through downtown — close enough to orient
  // by, and it keeps the line and the zone seam as one edge instead of two.
  var RIVER = [
    [36.0900, -86.7420],
    [36.1180, -86.7460],
    [36.1300, -86.7570],
    [36.1490, -86.7610],
    [36.1560, -86.7650],
    [36.1620, -86.7710],
    [36.1735, -86.7745],
    [36.1800, -86.7698],
    [36.1900, -86.7628],
    [36.2150, -86.7628],
    [36.2400, -86.7558],
  ];

  // Thin grey hints only — recognisable, not surveyed.
  var INTERSTATES = {
    'I-40': [
      [36.1400, -86.9000],
      [36.1480, -86.8600],
      [36.1530, -86.8200],
      [36.1580, -86.7960],
      [36.1660, -86.7840],
      [36.1720, -86.7700],
      [36.1745, -86.7500],
      [36.1760, -86.7100],
      [36.1740, -86.6900],
    ],
    'I-65': [
      [36.0900, -86.7900],
      [36.1150, -86.7830],
      [36.1400, -86.7800],
      [36.1560, -86.7880],
      [36.1680, -86.7940],
      [36.1900, -86.7980],
      [36.2150, -86.8020],
      [36.2400, -86.8060],
    ],
    'I-24': [
      [36.2100, -86.8300],
      [36.1900, -86.8080],
      [36.1740, -86.7900],
      [36.1640, -86.7760],
      [36.1500, -86.7580],
      [36.1300, -86.7320],
      [36.1100, -86.7060],
      [36.0950, -86.6900],
    ],
  };
  // ==== END ZONE MAP DATA ====

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

  function windowHasDrink(win) {
    for (var i = 0; i < win.deals.length; i++) {
      if (win.deals[i].type === 'drink') return true;
    }
    return false;
  }

  // ---- v1.5 C4: day coverage, the three numbers under the Day Grid ----
  // A venue "has something on DAY" iff at least one of its windows resolves to an
  // interval that STARTS on DAY (the same rule the grid itself uses to decide
  // whether to draw a row — see index.html#dayIntervalsForVenue), so the count and
  // the rows on screen can never disagree.
  function hasIntervalOn(venue, day) {
    for (var i = 0; i < venue.windows.length; i++) {
      var win = venue.windows[i];
      if (win.days.indexOf(day) === -1) continue;
      var ivs = resolveWindow(venue, win);
      for (var j = 0; j < ivs.length; j++) {
        if (ivs[j].day === day) return true;
      }
    }
    return false;
  }

  // Splits `venues` (already zone-filtered by the caller) into the three groups the
  // v1.5 grid footer names. They partition the list exactly: onDay + otherDays +
  // none === venues.length, for every day. The old footer collapsed the last two
  // into one "N venues have nothing on DAY" number, which is what made the outside
  // reader read it as "nothing is ever available" (see CHANGELOG v1.5).
  function dayCoverageCounts(venues, day) {
    var onDay = 0, none = 0, otherList = [];
    for (var i = 0; i < venues.length; i++) {
      var v = venues[i];
      if (!v.windows || v.windows.length === 0) { none++; continue; }
      if (hasIntervalOn(v, day)) { onDay++; continue; }
      var nextDay = null;
      for (var k = 1; k <= 7; k++) {
        var d = DAYS[(DAY_INDEX[day] + k) % 7];
        if (hasIntervalOn(v, d)) { nextDay = d; break; }
      }
      otherList.push({ venue: v, nextDay: nextDay });
    }
    return {
      total: venues.length,
      onDay: onDay,
      otherDays: otherList.length,
      none: none,
      otherList: otherList,
    };
  }

  // ---- v1.7 C1: "Surprise me" = Now | Later ----
  // v1.5 built a tier ladder: live, else starting soon, else "tonight's earliest".
  // TJ, 2026-09-11: "I tested the roll again feature - doesn't change anything."
  // He was right, and the ladder was the reason. At a dead hour the third tier
  // narrowed to the ties at the SINGLE earliest start — live that is two Blue Sushi
  // rows at 11:00 — so Roll again flipped between two identical-looking cards. A
  // fallback with one candidate cannot roll.
  //
  // TJ's replacement design: "surprise me could be a now or a later option. If its
  // pushing the next live event that's not really a surprise." So there are two
  // pools and the reader picks which one to roll, and LATER is a uniform draw over
  // the whole remaining evening rather than the next thing up.
  //
  // Service day = bar time, not calendar time: it runs to 03:00 the next calendar
  // day, so 01:00 Saturday still belongs to Friday night. Every horizon below is
  // measured in minutes-from-now, which sidesteps the week-boundary wrap entirely.
  var SERVICE_DAY_END_HOUR = 3;

  function minutesUntilServiceEnd(dateInTz) {
    var t = dateInTz.hour * 60 + dateInTz.minute;
    var end = SERVICE_DAY_END_HOUR * 60;
    return t < end ? end - t : (1440 - t) + end;
  }

  // The day key the current service day is filed under (00:00-02:59 belongs to the
  // day before). Everything the card calls "today" means this, not the calendar day.
  function serviceDayOf(dateInTz) {
    var idx = DAY_INDEX[dateInTz.dayOfWeek];
    if (dateInTz.hour < SERVICE_DAY_END_HOUR) idx = (idx + 6) % 7;
    return DAYS[idx];
  }

  // Identity of one (venue, window, day) occurrence. Roll again excludes the current
  // pick by this key, so the same venue's OTHER night is still a legal draw.
  function candidateKey(c) {
    if (c && c.key) return c.key;
    var v = c.venue || {};
    return (v.id || v.name) + '|' + c.win.start + '-' + c.win.end + '|' + c.day;
  }

  function surpriseCandidate(venue, win, day, tier, startAbs) {
    return {
      key: (venue.id || venue.name) + '|' + win.start + '-' + win.end + '|' + day,
      venue: venue, win: win, day: day, tier: tier, startAbs: startAbs,
    };
  }

  // Every happy_hour occurrence on `day`, regardless of the clock. Used for the two
  // pools that are not bounded by "the rest of tonight": the rollover into tomorrow
  // and the Day Grid's selected day.
  function fullDayPool(venues, day, taken) {
    var out = [];
    for (var i = 0; i < venues.length; i++) {
      var venue = venues[i];
      var windows = venue.windows || [];
      for (var w = 0; w < windows.length; w++) {
        var win = windows[w];
        if (win.kind !== 'happy_hour') continue;
        if (win.days.indexOf(day) === -1) continue;
        var c = surpriseCandidate(venue, win, day, 'later', null);
        if (!taken || !taken[c.key]) out.push(c);
      }
    }
    return out;
  }

  // surprisePools(venues, now, {day}) -> {now, later, laterLabel, laterScope, laterDay}
  //
  //   now   = live this minute, or starting within 2h. Specials are out: "Surprise
  //           me" promises a happy hour, and an all-day special is not an event.
  //   later = everything else that still starts inside this service day. Not the
  //           earliest — the whole evening, so the roll has somewhere to go.
  //
  // Two fallbacks, in order:
  //   * `opts.day` (the Day Grid's selected day, when it is not today) replaces
  //     later with that day's full set — how a friend plans Saturday from a Tuesday
  //     couch.
  //   * an empty later (the service day is past its last start) rolls over to
  //     tomorrow's full set. Venues that are live RIGHT NOW are dropped from that
  //     rollover: being told to come back tomorrow to a bar that is open as you read
  //     it is the same non-surprise TJ complained about. This dataset makes that the
  //     common case, not a corner — nothing but Fri/Sat starts a happy hour after
  //     18:30, so any weekday afternoon lands here, and at 16:30 Tuesday 41 of the 53
  //     rollover candidates are open at that moment. If the drop empties the pool we
  //     keep the unfiltered set; a repeat beats an empty card.
  function surprisePools(venues, dateInTz, opts) {
    opts = opts || {};
    venues = venues || [];
    var t = minutesSinceWeekStart(dateInTz);
    var horizon = minutesUntilServiceEnd(dateInTz);
    var today = serviceDayOf(dateInTz);
    var gridDay = (opts.day && opts.day !== today) ? opts.day : null;

    var nowPool = [], laterPool = [], taken = {}, liveVenues = {};

    for (var i = 0; i < venues.length; i++) {
      var venue = venues[i];
      var windows = venue.windows || [];
      for (var w = 0; w < windows.length; w++) {
        var win = windows[w];
        if (win.kind !== 'happy_hour') continue;
        var intervals = resolveWindow(venue, win);

        var live = null;
        for (var a = 0; a < intervals.length; a++) {
          if (inIntervalWrapped(t, intervals[a].startAbs, intervals[a].endAbs)) { live = intervals[a]; break; }
        }
        if (live) {
          var lc = surpriseCandidate(venue, win, live.day, 'live', 0);
          nowPool.push(lc);
          taken[lc.key] = true;
          liveVenues[venue.id || venue.name] = true;
          continue; // live is Now, never Later
        }

        var soonest = null;
        for (var b = 0; b < intervals.length; b++) {
          var mins = minutesUntilWrapped(t, intervals[b].startAbs);
          if (soonest === null || mins < soonest.mins) soonest = { mins: mins, iv: intervals[b] };
        }
        if (!soonest) continue;
        if (soonest.mins <= 120) {
          var sc = surpriseCandidate(venue, win, soonest.iv.day, 'soon', soonest.mins);
          nowPool.push(sc);
          taken[sc.key] = true;
          continue;
        }
        if (gridDay) continue;
        if (soonest.mins <= horizon) {
          laterPool.push(surpriseCandidate(venue, win, soonest.iv.day, 'later', soonest.mins));
        }
      }
    }

    var laterScope = 'today', laterDay = null;
    if (gridDay) {
      laterPool = fullDayPool(venues, gridDay, taken);
      laterScope = 'day';
      laterDay = gridDay;
    } else if (!laterPool.length) {
      var tomorrow = DAYS[(DAY_INDEX[today] + 1) % 7];
      var all = fullDayPool(venues, tomorrow, taken);
      var fresh = all.filter(function (c) { return !liveVenues[c.venue.id || c.venue.name]; });
      laterPool = fresh.length ? fresh : all;
      laterScope = 'tomorrow';
      laterDay = tomorrow;
    }

    return {
      now: nowPool,
      later: laterPool,
      laterScope: laterScope,
      laterDay: laterDay,
      laterLabel: laterScope === 'today' ? 'later today'
        : laterScope === 'tomorrow' ? 'tomorrow — ' + DAY_SHORT[laterDay]
        : DAY_LONG[laterDay],
      horizonMinutes: horizon,
      serviceDay: today,
    };
  }

  // Uniform draw from ONE pool — the tier ladder is gone, the caller chose the pool.
  // `prefer` narrows to food (or drink) candidates when the pool has any, so a
  // drink-only venue never wins while a food one is available. `exclude` is the key
  // of the current pick: Roll again must move. poolSize is the honest count BEFORE
  // the exclusion, because "one of N candidates" is the line that makes the switch
  // legible; canRoll says whether Roll again has anywhere to go.
  function pickSurprise(candidates, rng, opts) {
    opts = opts || {};
    var prefer = opts.prefer === 'drink' ? 'drink' : 'food';
    var pool = (candidates || []).slice();
    if (!pool.length) return null;
    var matching = pool.filter(function (c) {
      return prefer === 'food' ? windowHasFood(c.win) : windowHasDrink(c.win);
    });
    if (matching.length) pool = matching;
    var draw = pool;
    if (opts.exclude) {
      var rest = pool.filter(function (c) { return candidateKey(c) !== opts.exclude; });
      if (rest.length) draw = rest;
    }
    var r = typeof rng === 'function' ? rng() : 0;
    var idx = Math.floor(r * draw.length);
    if (!(idx >= 0)) idx = 0;
    if (idx >= draw.length) idx = draw.length - 1;
    return { pick: draw[idx], poolSize: pool.length, canRoll: pool.length > 1 };
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

  // ---------- v1.6 C1: feedback note composition ----------
  // The optional mood chip is not a separate field on the form; it is a tag on the
  // front of the note text, so a plain-text inbox sorts itself with no schema change.
  // Pure and here (not in index.html) purely so it can be tested.
  var NOTE_MOODS = ['liked', 'idea', 'problem'];
  function composeNote(mood, text) {
    var body = String(text == null ? '' : text).trim();
    if (!body) return '';
    if (NOTE_MOODS.indexOf(mood) < 0) return body;
    return '[' + mood + '] ' + body;
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
    MAP_EXTENT: MAP_EXTENT,
    MAP_EXEMPT_HOODS: MAP_EXEMPT_HOODS,
    MAP_VIEW_W: MAP_VIEW_W,
    MAP_VIEW_H: MAP_VIEW_H,
    projectToView: projectToView,
    zoneContains: zoneContains,
    ZONE_POLYGONS: ZONE_POLYGONS,
    ZONE_LABEL_ANCHORS: ZONE_LABEL_ANCHORS,
    ZONE_MAP_LABELS: ZONE_MAP_LABELS,
    RIVER: RIVER,
    INTERSTATES: INTERSTATES,
    zoneLabelBox: zoneLabelBox,
    zoneLabelBoxes: zoneLabelBoxes,
    rectsIntersect: rectsIntersect,
    labelBlockClearance: labelBlockClearance,
    windowHasDrink: windowHasDrink,
    hasIntervalOn: hasIntervalOn,
    dayCoverageCounts: dayCoverageCounts,
    pickSurprise: pickSurprise,
    surprisePools: surprisePools,
    candidateKey: candidateKey,
    serviceDayOf: serviceDayOf,
    minutesUntilServiceEnd: minutesUntilServiceEnd,
    DAY_SHORT: DAY_SHORT,
    DAY_LONG: DAY_LONG,
    composeNote: composeNote,
  };
});
