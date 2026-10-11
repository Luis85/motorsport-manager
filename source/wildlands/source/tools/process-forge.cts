/// <reference path="../process-contracts.d.ts" />
/** File adapter producing ordinary Scene Forge projects, one scene and editable model per step. */
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {catalog} from '../process-sdk.cjs';

/** Starter scene furnishings; Scene Forge remains the geometry authoring/compilation authority. */
export function model(step: LWProcess.Step): Record<string, unknown> {
 const nodes: Record<string, unknown>[] = [];
 const box = (id: string, position: number[], scale: number[], material: string) =>
  nodes.push({id, name: id, type: 'mesh', geometry: 'box', material, transform: {position, scale}});
 if (step.kind === 'task') {
  box('desk', [0, 1.05, -.6], [3.4, .18, 1.4], 'wood');
  box('left-leg', [-1.4, .5, -.6], [.15, 1, 1], 'frame'); box('right-leg', [1.4, .5, -.6], [.15, 1, 1], 'frame');
  box('monitor', [0, 1.62, -.8], [1, .7, .12], 'screen'); box('monitor-stand', [0, 1.23, -.8], [.15, .25, .15], 'frame');
  box('keyboard', [0, 1.17, -.1], [.8, .05, .25], 'frame'); box('chair', [0, .65, 1], [.8, .15, .8], 'accent');
  box('chair-back', [0, 1.1, 1.35], [.8, .9, .12], 'accent'); box('chair-leg', [0, .3, 1], [.16, .6, .16], 'frame');
  box('board', [-2.8, 1.1, -1.7], [1.2, 1.7, .1], 'screen');
 } else {
  box('podium', [0, .4, 0], [1.8, .8, 1.8], 'frame');
  box('marker', [0, 1.05, 0], [.7, .6, .7], 'accent');
 }
 return {schemaVersion: 1, kind: 'model', id: step.scene.id, name: step.name, category: 'Business process scenes', parameters: {},
  geometries: {box: {type: 'box', size: [1, 1, 1]}},
  materials: {wood: {color: '#8c725d', roughness: .8}, frame: {color: '#536379'}, screen: {color: '#91b9d5'}, accent: {color: step.scene.color}},
  nodes};
}
export function writeForgeProject(input: unknown, output: string): {output: string; scenes: number; assets: number; note: string} {
 const d = catalog.admit(input), target = path.resolve(output);
 if (fs.existsSync(target)) throw Error('Choose a new Scene Forge directory.');
 if (!fs.existsSync(path.dirname(target)) || !fs.statSync(path.dirname(target)).isDirectory()) {
  throw Error('Parent directory does not exist: ' + path.dirname(target));
 }
 const stage = target + '.' + randomUUID() + '.tmp';
 try {
  fs.mkdirSync(stage); fs.mkdirSync(path.join(stage, 'models')); fs.mkdirSync(path.join(stage, 'scenes')); fs.mkdirSync(path.join(stage, 'existing-assets'));
  const write = (file: string, value: unknown) => fs.writeFileSync(path.join(stage, file), JSON.stringify(value, null, 2) + '\n');
  for (const step of d.steps) {
   write('models/' + step.scene.id + '.model.json', model(step));
   write('scenes/' + step.scene.id + '.scene.json', {schemaVersion: 1, kind: 'scene', id: step.scene.id, name: step.name, revision: 0, units: 'meters',
    parameters: {}, geometries: {}, materials: {}, nodes: [{id: 'workstation', type: 'model', model: step.scene.id}]});
   // Imported geometry is preserved verbatim for Scene Forge's existing littlewild import command.
   if (step.scene.asset) write('existing-assets/' + step.scene.id + '.json', step.scene.asset);
  }
  write('forge.project.json', {schemaVersion: 1, name: d.name, activeScene: d.steps[0]!.scene.id,
   scenes: Object.fromEntries(d.steps.map(s => [s.scene.id, 'scenes/' + s.scene.id + '.scene.json'])),
   models: Object.fromEntries(d.steps.map(s => [s.scene.id, 'models/' + s.scene.id + '.model.json']))});
  write('littlewild.export.json', {schemaVersion: 1, kind: 'littlewild-export', target: './exports',
   assets: d.steps.map(s => ({id: s.scene.id, family: 'items', name: s.name, models: {world: {model: s.scene.id}}}))});
  write('process-scene-map.json', {format: 'wildlands-process-scenes', schemaVersion: 1, processId: d.id, fingerprint: catalog.fingerprint(d),
   scenes: d.steps.map(s => ({step: s.id, scene: s.scene.id, definition: 'exports/items/' + s.scene.id + '/definition.json'}))});
  const project = JSON.stringify(target);
  const exported = JSON.stringify(path.join(target, 'littlewild.export.json'));
  const readme = '# Process scene project\n\n'
   + 'Each process step has one Scene Forge scene and editable starter model.\n'
   + 'Existing attached assets are retained in existing-assets; import them with\n'
   + '`scene-forge -p ' + project + ' littlewild import --definition FILE` to edit the exact geometry.\n'
   + 'The starter models are not an automatic conversion of those attachments.\n\n'
   + 'Run `scene-forge -p ' + project + ' validate`, then\n'
   + '`scene-forge -p ' + project + ' littlewild sync --file ' + exported + '`.\n'
   + 'Attach each exported definition with `wildlands process attach` using fresh revision/fingerprint guards.\n';
  fs.writeFileSync(path.join(stage, 'README.md'), readme);
  fs.renameSync(stage, target);
 } finally {if (fs.existsSync(stage)) fs.rmSync(stage, {recursive: true, force: true});}
 const note = 'Editable scene scaffolds created; existing attachments retained verbatim for littlewild import.';
 return {output: target, scenes: d.steps.length, assets: d.steps.filter(s => s.scene.asset).length, note};
}
