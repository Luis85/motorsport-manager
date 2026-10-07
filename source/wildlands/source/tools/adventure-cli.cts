#!/usr/bin/env node
'use strict';
/** External-editor adapter. Runtime validation catches references beyond JSON Schema.
 * node tools/adventure-cli.cjs validate <file>
 * node tools/adventure-cli.cjs export | schema
 * stdout is always JSON. Exit 0 = valid, 1 = validation, 2 = usage/I/O. */
const {readJsonFile,helpRequested,emit}=require('./cli-io.cjs');
// Transitional: the bundled Littlewild game is installed (inside the JSON error boundary, after
// help) until game folders supply profiles.
const {installLittlewild}=require('../test-support/littlewild-game.cjs');
try {
  const args=process.argv.slice(2);
  if(helpRequested(args)){emit({ok:true,usage:'adventure-cli.cjs export | schema | validate <file> | diff <file>'});process.exit(0);}
  const [command, filename, ...extra] = args;
  if (extra.length) throw Error('Unexpected extra arguments.');
  if(!['export','schema','validate','diff'].includes(command)||(['export','schema'].includes(command)?!!filename:!filename))throw Error('Use export, schema, validate <file>, or diff <file>.');
  installLittlewild();require('../simulation.cjs');const A = require('../adventure-content.js');
  let result;
  if (command === 'export' && !filename) result = A.copy(A.content);
  else if (command === 'schema' && !filename) result = require('../content/adventure.schema.json');
  else if (['validate', 'diff'].includes(command) && filename) {
    const validated = A.validate(readJsonFile(filename,1500000));
    result = validated.ok ? { ok: true, fingerprint: A.hashOf(validated.content), ...validated.summary } : validated;
    if (!validated.ok) process.exitCode = 1;
    else if(command === 'diff') result = {ok:true,baseFingerprint:A.hash,candidateFingerprint:A.hashOf(validated.content),...A.diff(A.content, validated.content)};
  } else throw Error('Use validate <file>, diff <file>, export, or schema.');
  console.log(JSON.stringify(result, null, 2));
} catch (error) {
  console.log(JSON.stringify({ ok: false, errors: [error.message] }, null, 2));
  process.exitCode = 2;
}
