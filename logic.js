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
  };
});
