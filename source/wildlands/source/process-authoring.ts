/// <reference path="./process-contracts.d.ts" />
/** Revision/fingerprint guarded, all-or-nothing definition edits. Draft diagnostics are explicit. */
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessCatalog: LWProcess.Catalog; LWProcessAuthoring?: LWProcess.Authoring};
 function create(id: string, name: string): LWProcess.Definition {
  return root.LWProcessCatalog.admit({format: 'wildlands-process', schemaVersion: 1, revision: 0, id, name, start: 'start', resources: [],
   steps: [{id: 'start', name: 'Intake', kind: 'start', scene: {id: 'scene-start', position: [0, 0], color: '#77b5a0'}},
    {id: 'work', name: 'Deliver work', kind: 'task', duration: 5, scene: {id: 'scene-work', position: [12, 0], color: '#ffbb73'}},
    {id: 'end', name: 'Handover', kind: 'end', scene: {id: 'scene-end', position: [24, 0], color: '#77b5a0'}}],
   flows: [{id: 'start-work', from: 'start', to: 'work'}, {id: 'work-end', from: 'work', to: 'end'}], arrivals: [{at: 0, count: 1, interval: 0, data: {}}]});
 }
 function edit(input: unknown, raw: unknown, draft = false): ReturnType<LWProcess.Authoring['edit']> {
  const base = root.LWProcessCatalog.validate(input, true);
  if (!base.ok) throw Error(base.diagnostics.map(e => e.path + ': ' + e.message).join('\n'));
  root.LWProcessCatalog.fingerprint(raw); // Enforce plain JSON and complexity bounds before reading fields.
  const recipe = raw as LWProcess.Recipe;
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe) || Object.keys(recipe).some(k => !['expectedRevision', 'expectedFingerprint', 'operations'].includes(k)) ||
   recipe.expectedRevision !== base.definition!.revision || recipe.expectedFingerprint !== root.LWProcessCatalog.fingerprint(base.definition)) throw Error('Stale or invalid edit guard; inspect the definition again.');
  if (!Array.isArray(recipe.operations) || recipe.operations.length < 1 || recipe.operations.length > 256) throw Error('An edit needs 1–256 operations.');
  const definition = base.definition!;
  for (const [index, operation] of recipe.operations.entries()) {
   if (!operation || typeof operation !== 'object' || Array.isArray(operation)) throw Error('Invalid operation ' + index);
   const remove = operation.op.startsWith('remove');
   if (Object.keys(operation).some(k => !['op', remove ? 'id' : 'value'].includes(k))) throw Error('Unknown operation field at ' + index);
   const collections = {putStep: 'steps', putFlow: 'flows', putResource: 'resources', removeStep: 'steps', removeFlow: 'flows', removeResource: 'resources'} as const;
   if (Object.hasOwn(collections, operation.op)) {
    const field = collections[operation.op as keyof typeof collections], list = definition[field] as {id: string}[];
    const id = 'id' in operation ? operation.id : 'value' in operation && operation.value && typeof operation.value === 'object' && 'id' in operation.value ? String(operation.value.id) : '';
    if (!id) throw Error('Operation needs an ID at ' + index);
    const at = list.findIndex(v => v.id === id);
    if (remove) { if (at < 0) throw Error('Cannot remove unknown ID ' + id); list.splice(at, 1); }
    else { const value = (operation as {value: {id: string}}).value; if (at < 0) list.push(value); else list[at] = value; }
   } else if (operation.op === 'setArrivals') definition.arrivals = operation.value;
   else if (operation.op === 'setStart') definition.start = operation.value;
   else if (operation.op === 'rename') definition.name = operation.value;
   else throw Error('Unknown operation at ' + index);
  }
  definition.revision++;
  const checked = root.LWProcessCatalog.validate(definition, draft);
  if (!checked.ok) throw Error(checked.diagnostics.map(e => e.path + ': ' + e.message).join('\n'));
  return {definition: checked.definition!, fingerprint: root.LWProcessCatalog.fingerprint(checked.definition), diagnostics: checked.diagnostics};
 }
 const scenes: LWProcess.Authoring['scenes'] = input => {
  const d = root.LWProcessCatalog.admit(input);
  return d.steps.map(s => ({id: s.scene.id, stepId: s.id, name: s.name, position: s.scene.position,
   connections: d.flows.filter(f => f.from === s.id).map(f => d.steps.find(s => s.id === f.to)!.scene.id)}));
 };
 root.LWProcessAuthoring = {create, edit, scenes};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessAuthoring;
})(globalThis);
