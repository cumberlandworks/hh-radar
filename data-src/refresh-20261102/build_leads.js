#!/usr/bin/env node
// fix27 C3/C4: leads/raw/leads-raw.json -> leads-<zone>.json for the 7 core zones, plus
// inkind-overlap.json, inkind-crosscheck.md, outer-skipped.json and unzoned.json.
// v2.0.1: leads/raw/address-overrides.json places a lead the guides left unplaceable, from the
// address on the venue's own site: {name: {address, hood, source_url}}. hood null = not placeable.
// Usage: node build_leads.js <repo>/venues.json   (run from this folder)
'use strict';
const fs = require('fs');
const path = require('path');
const REPO = path.join(process.env.HOME, 'Documents', 'hh-radar');
const L = require(path.join(REPO, 'logic.js'));
const { hoodFromText } = require(path.join(REPO, 'data-src', 'hood_zone.js'));

const venuesPath = process.argv[2] || path.join(REPO, 'venues.json');
const ik = JSON.parse(fs.readFileSync(venuesPath, 'utf8')).venues.filter((v) => v.inkind === true);
const raw = JSON.parse(fs.readFileSync(path.join(__dirname, 'leads', 'raw', 'leads-raw.json'), 'utf8'));
const OUT = path.join(__dirname, 'leads');
const ovPath = path.join(OUT, 'raw', 'address-overrides.json');
const overrides = fs.existsSync(ovPath) ? JSON.parse(fs.readFileSync(ovPath, 'utf8')) : {};

// A lead matches an inKind venue on the normalized name (leads have no coordinates), or on
// the street when the guide gave an address.
function ikMatch(lead) {
  const n = L.normName(lead.name);
  const st = lead.address ? L.normStreet(lead.address) : '';
  return ik.find((v) => L.normName(v.name) === n || (st && L.normStreet(v.address) === st)) || null;
}

const byZone = {};
L.V2_ZONE_KEYS.forEach((k) => { byZone[k] = []; });
const overlap = [], crosscheck = [], outer = [], unzoned = [];
raw.forEach((lead) => {
  const rec = {
    name: lead.name, neighborhood_text: lead.neighborhood_text || null, address: lead.address || null,
    guides: lead.guides, site: lead.site || null,
  };
  const ov = overrides[lead.name];
  if (ov) { rec.address = ov.address; rec.address_source = ov.source_url; }
  const m = ikMatch(lead);
  if (m) {
    overlap.push(Object.assign({ ik_id: m.id, ik_name: m.name }, rec));
    if (m.verified_no_hh === true) crosscheck.push({ lead: rec, venue: m });
    return;
  }
  const hood = ov ? ov.hood : hoodFromText(lead.neighborhood_text);
  const zone = hood ? L.zoneOf(hood) : null;
  if (!zone) {
    const why = ov ? (ov.why || 'no address on the venue’s own site')
      : lead.neighborhood_text ? 'neighborhood text too vague to place' : 'no neighborhood given';
    unzoned.push(Object.assign({ why }, rec)); return;
  }
  if (zone === 'outer') { outer.push(Object.assign({ hood }, rec)); return; }
  byZone[zone].push(Object.assign({ hood_guess: hood, zone }, rec));
});

const dump = (f, o) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(o, null, 1) + '\n');
L.V2_ZONE_KEYS.forEach((k) => dump('leads-' + k + '.json', byZone[k]));
dump('inkind-overlap.json', overlap);
dump('outer-skipped.json', outer);
dump('unzoned.json', unzoned);
fs.writeFileSync(path.join(OUT, 'inkind-crosscheck.md'),
  '# inKind cross-check (fix27 C3)\n\nA guide lists a happy hour for these inKind venues, which venues.json marks ' +
  '`verified_no_hh: true`. Nothing was changed; re-check each at the next inKind refresh.\n\n' +
  (crosscheck.length ? crosscheck.map((c) => '- **' + c.venue.name + '** (`' + c.venue.id + '`): ' +
    c.lead.guides.map((g) => g.url + (g.confirmed ? ' (confirmed ' + g.confirmed + ')' : '')).filter((u, i, a) => a.indexOf(u) === i).slice(0, 3).join(', ')).join('\n')
    : '_None._') + '\n');

const counts = {};
L.V2_ZONE_KEYS.forEach((k) => { counts[k] = byZone[k].length; });
console.log(JSON.stringify({ raw: raw.length, per_zone: counts, inkind_overlap: overlap.length,
  crosscheck: crosscheck.length, outer_skipped: outer.length, unzoned: unzoned.length }));
L.V2_ZONE_KEYS.forEach((k) => { if (byZone[k].length > 80) console.log('NOTE: ' + k + ' has ' + byZone[k].length + ' leads (> 80)'); });
