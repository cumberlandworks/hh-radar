// Hood + zone assignment rules, shared by assign_hood_zone.js (the v1.16 migration) and
// refresh-20261102/build_leads.js / merge_v2zone.py (v2.0, fix27 C4: every Nashville happy
// hour). Split out of assign_hood_zone.js so the zone runs reuse the same rules.
'use strict';
const L = require('../logic.js');

const OUTLIER_OVERRIDES = {
  'ik-11286': 'Dickson',    // Just Love Coffee - Dickson; neighborhood field says "Bellevue"
  'ik-19233': 'Lewisburg',  // The Coffee House Lewisburg; neighborhood field says "Franklin/Cool Springs"
};

// v1.16 (fix16 C1): the aliases that only pointed at pre-v1.16 hood names
// ('Downtown/SoBro', 'Sylvan Park/Charlotte', 'Belle Meade / West Nashville', ...) are
// gone with those names. Only the two Franklin spellings still resolve to a live key.
const HAND_SET_ALIASES = {
  'Franklin (McEwen)': 'Franklin/Cool Springs',
  'Franklin (Cool Springs)': 'Franklin/Cool Springs',
};

const CENTROID_NAMES = new Set(L.NEIGHBORHOOD_CENTROIDS.map((c) => c.name));

function computeHood(venue, warnings) {
  // v1.16: hoods are set by hand from the street address; a valid one is never recomputed.
  if (L.zoneOf(venue.hood)) return venue.hood;
  if (OUTLIER_OVERRIDES[venue.id]) return OUTLIER_OVERRIDES[venue.id];
  if (HAND_SET_ALIASES[venue.neighborhood]) return HAND_SET_ALIASES[venue.neighborhood];
  if (CENTROID_NAMES.has(venue.neighborhood)) return venue.neighborhood;
  const nearest = L.nearestNeighborhood(venue.lat, venue.lon);
  warnings.push(venue.name + ': neighborhood "' + venue.neighborhood + '" unmapped -> nearestNeighborhood ' + nearest);
  return nearest;
}

// v2.0 (fix27 C4): how the happy hour guides write a neighborhood -> a hood key. A lead has
// no coordinates, so this is the only rule for it; the zone run re-places each venue from
// its own posted address (merge_v2zone.py). null = outside the core zones or too vague
// to place from text alone.
const GUIDE_TEXT_HOODS = {
  'downtown': 'Downtown & Printers Alley',
  'lower broadway': 'Lower Broadway',
  'sobro': 'SoBro',
  'the gulch': 'The Gulch',
  'gulch': 'The Gulch',
  'germantown': 'Germantown',
  'marathon village': 'Buchanan Arts District & North Nashville',
  'east nashville': 'Five Points & Main Street',
  'green hills': 'Green Hills',
  'sylvan park': 'Sylvan Park',
  'sylvan park/the nations': 'Sylvan Park',
  'the nations': 'The Nations',
  '12 south': '12 South',
  '12south': '12 South',
  '8th ave.': 'Wedgewood-Houston',
  'west end': 'West End',
  'west end/midtown': 'West End',
  'midtown': 'Midtown & Music Row',
  'music row': 'Midtown & Music Row',
  'hillsboro village': 'Hillsboro Village & Belmont',
  'hillsboro village/edgehill': 'Hillsboro Village & Belmont',
  'edgehill': 'Hillsboro Village & Belmont',
  'belle meade': 'Belle Meade',
  'wedgewood-houston': 'Wedgewood-Houston',
  'weho': 'Wedgewood-Houston',
  'berry hill': 'Berry Hill',
  'music valley': 'Donelson & Opry Mills',
  'south nashville': null,
  // fix33: the Franklin & Brentwood guides name the town (leads/raw/leads-raw-franklin.json).
  'franklin': 'Franklin/Cool Springs',
  'cool springs': 'Franklin/Cool Springs',
  'brentwood': 'Brentwood',
};
function hoodFromText(text) {
  const t = String(text || '').trim();
  if (!t) return null;
  if (L.zoneOf(t)) return t;
  if (HAND_SET_ALIASES[t]) return HAND_SET_ALIASES[t];
  const k = t.toLowerCase();
  return Object.prototype.hasOwnProperty.call(GUIDE_TEXT_HOODS, k) ? GUIDE_TEXT_HOODS[k] : null;
}

module.exports = { OUTLIER_OVERRIDES, HAND_SET_ALIASES, CENTROID_NAMES, computeHood, GUIDE_TEXT_HOODS, hoodFromText };
