#!/usr/bin/env node
// fix27: the logic.js / hood_zone.js rules, for merge_v2zone.py and geocode_v2zone.py
// (Python has no require). One JSON object on stdin, one on stdout.
//   node v2zone_helper.js place     {items:[{lat, lon, addr_hood_text, text_hood}]} -> [{point_hood, addr_hood, zone...}]
//   node v2zone_helper.js ids       {items:[{name, address}]}                       -> ["nv-..."]
//   node v2zone_helper.js dup       {venue, others:[...]}                          -> {id, name} | null
//   node v2zone_helper.js validate  {path}                                         -> {errors, warnings}
'use strict';
const fs = require('fs');
const path = require('path');
const REPO = path.join(process.env.HOME, 'Documents', 'hh-radar');
const L = require(path.join(REPO, 'logic.js'));
const { hoodFromText } = require(path.join(REPO, 'data-src', 'hood_zone.js'));

const cmd = process.argv[2];
const input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}');
let out;
if (cmd === 'place') {
  out = input.items.map((it) => {
    const point = typeof it.lat === 'number' ? L.nearestNeighborhood(it.lat, it.lon) : null;
    const addr = hoodFromText(it.addr_hood_text) || hoodFromText(it.text_hood);
    return { point_hood: point, point_zone: point ? L.zoneOf(point) : null, addr_hood: addr, addr_zone: addr ? L.zoneOf(addr) : null };
  });
} else if (cmd === 'ids') {
  out = input.items.map((it) => L.nvIdFor(it.name, it.address));
} else if (cmd === 'dup') {
  const d = L.nvDuplicateOf(input.venue, input.others);
  out = d ? { id: d.id, name: d.name,
    by: L.normName(d.name) === L.normName(input.venue.name) ? 'name within ' + L.NV_DUP_MILES + ' mi' : 'street address and a similar name' } : null;
} else if (cmd === 'validate') {
  const data = JSON.parse(fs.readFileSync(input.path, 'utf8'));
  out = { errors: L.validateVenues(data), warnings: L.lintVenues(data) };
} else {
  console.error('usage: v2zone_helper.js place|ids|dup|validate < json');
  process.exit(2);
}
process.stdout.write(JSON.stringify(out));
