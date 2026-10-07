#!/usr/bin/env node
'use strict';
/** Offline external-editor adapter. JSON stdout; no files are overwritten.
 * Usage: node tools/world-cli.cjs export|schema|validate <file>|diff <file>
 * Exit 0: accepted; 1: validation failed; 2: invalid usage or I/O.
 * Schemas check shape; runtime validation also checks references and dependency cycles.
 */
const {readJsonFile,helpRequested,emit}=require('./cli-io.cjs');
// Transitional: the bundled Littlewild game is installed (inside the JSON error boundary, after
// help) until game folders supply profiles.
const {installLittlewild}=require('../content-installers/littlewild-game.cjs');
try {
  const args=process.argv.slice(2);
  if(helpRequested(args)){emit({ok:true,usage:'world-cli.cjs export | schema | validate <file> | diff <file>'});process.exit(0);}
  const [command, filename, ...extra] = args;
  if (extra.length) throw Error('Unexpected extra arguments.');
  if(!['export','schema','validate','diff'].includes(command)||(['export','schema'].includes(command)?!!filename:!filename))throw Error('Use export, schema, validate <file>, or diff <file>.');
  installLittlewild();require('../simulation.cjs');const W = require('../world-content.js');
  let result;
  if (command === 'export' && !filename) result = W.clone(W.content);
  else if (command === 'schema' && !filename) result = W.clone(W.schema);
  else if (['validate', 'diff'].includes(command) && filename) {
    const candidate = W.validate(readJsonFile(filename,300000));
    if (!candidate.ok) { result = candidate; process.exitCode = 1; }
    else {
      result = {ok:true, fingerprint:W.hashOf(candidate.content), nodeKinds:candidate.content.nodes.length,
        buildingProfiles:candidate.content.buildings.length, sites:candidate.content.sites.length};
      if (command === 'diff') {
        const changes = W.diff(W.content, candidate.content);
        result = {ok:true, baseFingerprint:W.hash, candidateFingerprint:W.hashOf(candidate.content),
          changeCount:changes.length, truncated:changes.length>200, changes:changes.slice(0,200)};
      }
    }
  } else throw Error('Use export, schema, validate <file>, or diff <file>.');
  console.log(JSON.stringify(result,null,2));
} catch (error) {
  console.log(JSON.stringify({ok:false,errors:[error.message]},null,2));process.exitCode=2;
}
