#!/usr/bin/env node
'use strict';
/** External-editor adapter. Runtime validation catches references beyond JSON Schema.
 * node tools/adventure-cli.cjs validate <file>
 * node tools/adventure-cli.cjs export | schema
 * stdout is always JSON. Exit 0 = valid, 1 = validation, 2 = usage/I/O. */
const fs = require('node:fs');
require('../simulation.cjs');
const A = require('../adventure-content.js');
try {
  const [command, filename, ...extra] = process.argv.slice(2);
  if (extra.length) throw Error('Unexpected extra arguments.');
  let result;
  if (command === 'export' && !filename) result = A.copy(A.content);
  else if (command === 'schema' && !filename) result = require('../content/adventure.schema.json');
  else if (['validate', 'diff'].includes(command) && filename) {
    const stat = fs.statSync(filename);
    if (!stat.isFile() || stat.size > 1500000) throw Error('Choose a JSON file smaller than 1.5 MB.');
    const validated = A.validate(fs.readFileSync(filename, 'utf8'));
    result = validated.ok ? { ok: true, fingerprint: A.hashOf(validated.content), ...validated.summary } : validated;
    if (!validated.ok) process.exitCode = 1;
    else if(command === 'diff') result = {ok:true,baseFingerprint:A.hash,candidateFingerprint:A.hashOf(validated.content),...A.diff(A.content, validated.content)};
  } else throw Error('Use validate <file>, diff <file>, export, or schema.');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.log(JSON.stringify({ ok: false, errors: [error.message] }, null, 2));
  process.exitCode = 2;
}
