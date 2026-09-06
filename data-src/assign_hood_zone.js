#!/usr/bin/env node
// One-time migration (BLOCK-hh-radar-fix3-20260906, C1): adds canonical `hood` and
// `zone` keys to every venue in venues.json, in place, preserving the existing
// 1-space JSON formatting exactly (JSON.stringify(data, null, 1), no trailing
// newline — matches the file as written by build_venues_20260905.py).
//
// Mapping priority (see BLOCK-hh-radar-fix3-20260906 C1 for the source rule):
//   1. OUTLIER_OVERRIDES by venue id — two venues (Dickson, Lewisburg) whose
//      `neighborhood` field already equals an unrelated centroid name (an artifact
//      of the original nearestNeighborhood fallback, which had no better option
//      before these two towns had their own hood keys) would otherwise never
//      reach rule 4 below. Checked first so they resolve to the outlier hoods the
//      block explicitly names instead of their mis-tagged neighborhood field.
//   2. HAND_SET_ALIASES — the block's explicit hand-set-name -> hood table.
//   3. neighborhood === a NEIGHBORHOOD_CENTROIDS name -> that name is the hood.
//   4. anything else -> nearestNeighborhood(lat, lon), plus a console WARN (lint).
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('../logic.js');

const VENUES_PATH = path.join(__dirname, '..', 'venues.json');

const OUTLIER_OVERRIDES = {
  'ik-11286': 'Dickson',    // Just Love Coffee - Dickson; neighborhood field says "Bellevue"
  'ik-19233': 'Lewisburg',  // The Coffee House Lewisburg; neighborhood field says "Franklin/Cool Springs"
};

const HAND_SET_ALIASES = {
  'Downtown (Fifth + Broadway)': 'Downtown/SoBro',
  'SoBro': 'Downtown/SoBro',
  'SoBro / Pie Town': 'Downtown/SoBro',
  'The Gulch / 8th Ave S': 'The Gulch',
  'Marathon Village': 'Germantown',
  'Sylvan Park': 'Sylvan Park/Charlotte',
  'Charlotte / Sylvan Park': 'Sylvan Park/Charlotte',
  'Franklin (McEwen)': 'Franklin/Cool Springs',
  'Franklin (Cool Springs)': 'Franklin/Cool Springs',
  'Belle Meade / West Nashville': 'Belle Meade / West Nashville', // kept as its own key
};

const CENTROID_NAMES = new Set(L.NEIGHBORHOOD_CENTROIDS.map((c) => c.name));

function computeHood(venue, warnings) {
  if (OUTLIER_OVERRIDES[venue.id]) return OUTLIER_OVERRIDES[venue.id];
  if (HAND_SET_ALIASES[venue.neighborhood]) return HAND_SET_ALIASES[venue.neighborhood];
  if (CENTROID_NAMES.has(venue.neighborhood)) return venue.neighborhood;
  const nearest = L.nearestNeighborhood(venue.lat, venue.lon);
  warnings.push(venue.name + ': neighborhood "' + venue.neighborhood + '" unmapped -> nearestNeighborhood ' + nearest);
  return nearest;
}

function main() {
  const raw = fs.readFileSync(VENUES_PATH, 'utf8');
  const data = JSON.parse(raw);
  const warnings = [];

  data.venues.forEach((venue) => {
    const hood = computeHood(venue, warnings);
    const zone = L.zoneOf(hood);
    if (!zone) warnings.push(venue.name + ': hood "' + hood + '" has no zone (zoneOf returned falsy)');

    // Rebuild key order so `hood`/`zone` land right after `neighborhood` instead
    // of at the end of the object (cosmetic only; keeps the diff readable).
    const rebuilt = {};
    Object.keys(venue).forEach((k) => {
      rebuilt[k] = venue[k];
      if (k === 'neighborhood') {
        rebuilt.hood = hood;
        rebuilt.zone = zone;
      }
    });
    Object.keys(rebuilt).forEach((k) => { venue[k] = rebuilt[k]; delete venue[k]; });
    Object.keys(rebuilt).forEach((k) => { venue[k] = rebuilt[k]; });
  });

  fs.writeFileSync(VENUES_PATH, JSON.stringify(data, null, 1));

  console.log('assign_hood_zone: wrote hood+zone for ' + data.venues.length + ' venues.');
  if (warnings.length) {
    console.log('assign_hood_zone: ' + warnings.length + ' lint warning(s):');
    warnings.forEach((w) => console.log('  ! ' + w));
  } else {
    console.log('assign_hood_zone: 0 lint warnings (every venue matched an alias or centroid name).');
  }
}

main();
