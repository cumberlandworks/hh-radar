// Assigns hood/zone/neighborhood to venues that have none (new in the 2026-10-23 refresh),
// using the repo's own logic.js (nearestNeighborhood + zoneOf). Existing venues are untouched.
'use strict';
const fs = require('fs');
const L = require(process.argv[2]);
const data = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
for (const v of data.venues) {
  if (v.hood) continue;
  v.hood = L.nearestNeighborhood(v.lat, v.lon);
  v.zone = L.zoneOf(v.hood);
  v.neighborhood = v.hood;
  console.log('hood', v.name, '->', v.hood, '/', v.zone);
}
fs.writeFileSync(process.argv[4], JSON.stringify(data, null, 1));
