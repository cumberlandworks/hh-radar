#!/usr/bin/env node
// Node stdlib-only validator for venues.json. Exits non-zero on any schema/semantic
// violation. Shares its checking logic with index.html via logic.js — no duplication.
'use strict';
const fs = require('fs');
const path = require('path');
const { validateVenues } = require('./logic.js');

const target = process.argv[2] || path.join(__dirname, 'venues.json');

let raw;
try {
  raw = fs.readFileSync(target, 'utf8');
} catch (e) {
  console.error('validate.js: cannot read ' + target + ': ' + e.message);
  process.exit(1);
}

let data;
try {
  data = JSON.parse(raw);
} catch (e) {
  console.error('validate.js: ' + target + ' is not valid JSON: ' + e.message);
  process.exit(1);
}

const errors = validateVenues(data);
if (errors.length === 0) {
  console.log('validate.js: OK — ' + target + ' (' + data.venues.length + ' venues, ' +
    data.venues.reduce((n, v) => n + v.windows.length, 0) + ' windows)');
  process.exit(0);
} else {
  console.error('validate.js: ' + errors.length + ' problem(s) in ' + target + ':');
  for (const e of errors) console.error('  - ' + e);
  process.exit(1);
}
