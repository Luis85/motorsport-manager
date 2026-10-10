/** Public data boundaries reject malformed input before runtime/resource construction. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const catalog = require('./armored-catalog.js') as LWArmoredData.CatalogApi;
const visuals = require('./armored-visuals.js') as {validate(input: unknown): unknown};
const data = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/concepts/armored-platoon/content/catalog.json'), 'utf8'));
const pack = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/concepts/armored-platoon/content/visuals.json'), 'utf8'));
const results: {name: string; passed: boolean; error?: string}[] = [];
function check(name: string, work: () => void): void {
    try { work(); results.push({name, passed: true}); }
    catch (error) { results.push({name, passed: false, error: String(error)}); }
}
check('Armored content admits detached original policy and Forge semantic assets', () => {
    const admitted = catalog.validate(data); admitted.vehicles[0]!.mass++;
    assert.notEqual(admitted.vehicles[0]!.mass, data.vehicles[0].mass);
    assert.deepEqual(visuals.validate(pack), pack);
});
check('Armored catalog rejects executable descriptors sparse arrays and unknown fields', () => {
    let called = false; const copy = structuredClone(data);
    Object.defineProperty(copy.vehicles[0], 'id', {get() { called = true; return 'bad'; }});
    assert.throws(() => catalog.validate(copy)); assert.equal(called, false);
    const sparse = structuredClone(data); delete sparse.missions[0].terrain.heights[1]; assert.throws(() => catalog.validate(sparse));
    const unknown = structuredClone(data); unknown.missions[0].execute = 'bad'; assert.throws(() => catalog.validate(unknown));
});
check('Armored catalog rejects reserved identities impossible goals and off-map deployment', () => {
    for (const mutate of [
        (c: any) => c.missions[0].spawns[0].id = 'armored-state',
        (c: any) => c.missions[0].spawns[0].position.x = -1,
        (c: any) => c.missions[0].spawns[0].id = 'shell:000001',
        (c: any) => c.missions[0].objectives[0].target = 'missing',
        (c: any) => c.missions[0].objectives[0].required = 500,
        (c: any) => c.missions[0].terrain.heights.pop(),
        (c: any) => c.vehicles[0].ammunition.push('missing')
    ]) { const copy = structuredClone(data); mutate(copy); assert.throws(() => catalog.validate(copy)); }
});
check('Armored visuals reject external resources corrupt geometry and missing required pivots', () => {
    for (const mutate of [
        (a: any) => a.object.images = [{url: 'https://example.com/image.png'}],
        (a: any) => a.object.geometries[0].data.attributes.position.array.push(0),
        (a: any) => a.object.geometries[0].data.attributes.position.type = 'MissingArrayConstructor',
        (a: any) => a.object.geometries[0].data.attributes.position.array[0] = 'not-a-number',
        (a: any) => a.object.geometries[0].data.attributes.position.array[0] = 1e100,
        (a: any) => a.semantics.bindings = a.semantics.bindings.filter((b: any) => b.role !== 'muzzle'),
        (a: any) => a.semantics.coordinates.up = '+Z',
        (a: any) => a.semantics.bindings.find((b: any) => b.kind === 'articulation').path = 'missing'
    ]) { const copy = structuredClone(pack); mutate(Object.values(copy.assets)[0]); assert.throws(() => visuals.validate(copy)); }
});
const passed = results.filter(r => r.passed).length;
fs.writeFileSync(__dirname + '/armored-admission-results.json', JSON.stringify({passed, total: results.length, results}, null, 2) + '\n');
console.log(passed + '/' + results.length + ' armored admission checks passed');
if (passed !== results.length) process.exitCode = 1;
