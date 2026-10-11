/** Actual pinned Three CPU resource integration; this does not measure GPU allocation or frame rate. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

require('./image-data.js');
const admission = require('./armored-visuals.js') as {validate(value: unknown): any};
const resources = require('./visual-resources.js') as LWVisualResourceContract.Api;
const realm: any = {console}; realm.window = realm;
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../vendor/three.js'), 'utf8'), realm);
const T: any = realm.THREE;
const results: {name: string; passed: boolean; error?: string}[] = [];
function check(name: string, work: () => void): void {
    try { work(); results.push({name, passed: true}); console.log('PASS ' + name); }
    catch (error) { results.push({name, passed: false, error: String(error)}); console.error(name, error); }
}
const plain = <V,>(value: V): V => JSON.parse(JSON.stringify(value)) as V;
function fixture(textured = true): any {
    const group = new T.Group(); group.name = 'hull';
    const turret = new T.Group(); turret.name = 'turret'; group.add(turret);
    const gun = new T.Group(); gun.name = 'gun'; turret.add(gun);
    const muzzle = new T.Object3D(); muzzle.name = 'muzzle'; muzzle.position.z = 2; gun.add(muzzle);
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute([0,0,0, 1,0,0, 0,1,0], 3));
    geometry.setAttribute('normal', new T.Float32BufferAttribute([0,0,1, 0,0,1, 0,0,1], 3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute([0,0, 1,0, 0,1], 2));
    geometry.setIndex([0,1,2]);
    const material = new T.MeshStandardMaterial({color: '#65764b', roughness: .8, metalness: .6});
    if (textured) {
        const texture = (color: boolean, byte: number) => {
            const image = new T.DataTexture(Uint8Array.from({length: 128 * 128 * 4}, (_, index) => (byte + index) % 256), 128, 128);
            image.colorSpace = color ? T.SRGBColorSpace : T.NoColorSpace;
            image.wrapS = image.wrapT = T.RepeatWrapping; image.repeat.set(3, 3);
            image.minFilter = T.LinearMipmapLinearFilter; image.magFilter = T.LinearFilter;
            image.generateMipmaps = true; image.needsUpdate = true;
            return image;
        };
        material.map = texture(true, 90); material.normalMap = texture(false, 128);
        material.roughnessMap = material.metalnessMap = texture(false, 170);
    }
    const mesh = new T.Mesh(geometry, [material, material.clone()]); mesh.name = 'armor'; gun.add(mesh);
    group.updateMatrixWorld(true);
    const semantics = {
        format: 'forge-semantic-bindings', version: 1,
        coordinates: {unit: 'metre', up: '+Y', forward: '+Z', matrix: 'column-major'},
        bindings: [turret, gun, muzzle].map(node => ({kind: node === muzzle ? 'socket' : 'articulation', role: node.name, path: node.name, localMatrix: node.matrix.toArray(), worldMatrix: node.matrixWorld.toArray()}))
    };
    const pack = plain({format: 'wildlands-armored-visuals', version: textured ? 2 : 1, assets: {tank: {object: group.toJSON(), semantics}}});
    resources.disposeTrees([group]);
    return pack;
}
const asset = (pack: any): any => pack.assets.tank.object;
function encodedFixture(): any {
    const pack = fixture();
    for (const image of asset(pack).images) {
        image.url.data = Buffer.from(image.url.data).toString('base64'); image.url.encoding = 'base64';
    }
    return pack;
}
function rejects(mutations: ((value: any) => void)[], make = () => fixture()): void {
    for (const mutate of mutations) { const value = make(); mutate(value); assert.throws(() => admission.validate(value)); }
}
function watched(values: any[]): Map<any, number> {
    const counts = new Map<any, number>();
    for (const value of new Set(values)) {
        counts.set(value, 0); value.addEventListener('dispose', () => counts.set(value, counts.get(value)! + 1));
    }
    return counts;
}
function graphResources(tree: any): any[] {
    const values: any[] = [];
    tree.traverse((node: any) => {
        if (node.geometry) values.push(node.geometry);
        for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
            if (!material) continue; values.push(material);
            for (const value of Object.values(material)) if ((value as any)?.isTexture) values.push(value);
        }
    });
    return values;
}

check('Armored v2 typed textures realize with actual pinned Three and preserve detached pixel and material roles', () => {
    for (const make of [fixture, encodedFixture]) {
        const original = make(), admitted = admission.validate(original), json = asset(admitted);
        const expected = json.images.map((image: any) => Buffer.from(image.url.data, image.url.encoding));
        const parsed = resources.parseObject(T, json);
        try {
            const material = parsed.object.getObjectByName('armor').material[0];
            assert(material.map.isDataTexture); assert(material.normalMap.isDataTexture);
            assert.equal(material.map.colorSpace, T.SRGBColorSpace); assert.equal(material.normalMap.colorSpace, T.NoColorSpace);
            assert.equal(material.roughnessMap, material.metalnessMap);
            assert.equal(material.map.repeat.x, 3); assert.equal(material.map.image.data.length, 65536);
            for (const slot of ['map', 'normalMap', 'roughnessMap']) {
                const texture = json.textures.find((entry: any) => entry.uuid === json.materials[0][slot]);
                const index = json.images.findIndex((entry: any) => entry.uuid === texture.image);
                assert.deepEqual(Buffer.from(material[slot].image.data), expected[index], slot + ' preserves every authored byte');
            }
            const originalBytes = JSON.stringify(asset(original).images[0].url.data);
            if (Array.isArray(json.images[0].url.data)) json.images[0].url.data[0] = 255;
            else json.images[0].url.data = 'changed after realization';
            assert.deepEqual(Buffer.from(material.map.image.data), expected[0]);
            assert.equal(JSON.stringify(asset(original).images[0].url.data), originalBytes);
            assert.equal(material.map.image.width, 128); assert.equal(material.map.image.height, 128);
            assert.equal(parsed.object.getObjectByName('muzzle').parent.name, 'gun');
            assert.equal(realm.document, undefined, 'Typed realization must not require a document or image decoder');
        } finally { resources.disposeTrees([parsed.object], parsed.resources); }
    }
});
check('Armored scalar visual version one remains unchanged and rejects textured version two payloads', () => {
    const original = fixture(false), admitted = admission.validate(original);
    assert.deepEqual(admitted, original); assert.notEqual(admitted, original);
    const parsed = resources.parseObject(T, asset(admitted));
    try { assert.equal(parsed.object.getObjectByName('armor').material[0].map, null); }
    finally { resources.disposeTrees([parsed.object], parsed.resources); }
    rejects([value => value.version = 1]);
});
check('Armored typed image admission rejects external resources malformed bytes and accessors before allocation', () => {
    rejects([
        value => asset(value).images[0].url = 'https://example.com/map.png',
        value => asset(value).images[0].url = 'data:image/png;base64,AAAA',
        value => asset(value).images[0].url.type = 'Float32Array',
        value => asset(value).images[0].url.width = 129,
        value => asset(value).images[0].url.height = 0,
        value => asset(value).images[0].url.data.pop(),
        value => asset(value).images[0].url.data[0] = 256,
        value => asset(value).images[0].url.data[0] = .5,
        value => delete asset(value).images[0].url.data[0],
        value => asset(value).object.userData = {url: {data: [], width: 128, height: 128, type: 'Uint8Array'}}
    ]);
    rejects([
        value => asset(value).images[0].url.encoding = 'hex',
        value => delete asset(value).images[0].url.encoding,
        value => asset(value).images[0].url.data = [0],
        value => asset(value).images[0].url.data = 'https://example.com/map.png',
        value => asset(value).images[0].url.data = 'data:image/png;base64,' + asset(value).images[0].url.data,
        value => asset(value).images[0].url.data = asset(value).images[0].url.data.slice(4),
        value => asset(value).images[0].url.data += 'AAAA',
        value => asset(value).images[0].url.data = ' ' + asset(value).images[0].url.data.slice(1),
        value => asset(value).images[0].url.data = '-' + asset(value).images[0].url.data.slice(1),
        value => asset(value).images[0].url.data = asset(value).images[0].url.data.slice(0, -2) + 'AA',
        value => asset(value).images[0].url.data = asset(value).images[0].url.data.slice(0, -3) + 'B==',
        value => asset(value).images[0].url.data = 'A'.repeat(87380) + '=A=='
    ], encodedFixture);
    rejects([value => asset(value).images[0].url.encoding = 'base64']);
    let called = false; const value = fixture();
    Object.defineProperty(asset(value).images[0].url, 'data', {get() { called = true; throw Error('getter executed'); }});
    assert.throws(() => admission.validate(value)); assert.equal(called, false);
    const codec = require('./image-data.js') as LWImageDataContract.Api;
    const bytes = Array.from({length: 65536}, (_, index) => index % 256);
    let iterated = false;
    Object.defineProperty(bytes, Symbol.iterator, {value() {iterated = true; throw Error('Unexpected iterator');}});
    assert.deepEqual(Buffer.from(codec.decodeRGBA(bytes)), Buffer.from(Uint8Array.from({length: 65536}, (_, index) => index % 256)));
    assert.equal(iterated, false, 'Numeric realization reads validated own data without executing an iterator');
});
check('Armored texture resource closure rejects dangling duplicate orphaned resources and absent UV coordinates', () => {
    rejects([
        value => asset(value).textures[0].image = 'missing',
        value => asset(value).materials[0].map = 'missing',
        value => asset(value).images.push(plain(asset(value).images[0])),
        value => asset(value).textures.push(plain(asset(value).textures[0])),
        value => asset(value).images.push({...plain(asset(value).images[0]), uuid: 'orphan-image'}),
        value => asset(value).textures.push({...plain(asset(value).textures[0]), uuid: 'orphan-texture'}),
        value => delete asset(value).geometries[0].data.attributes.uv,
        value => asset(value).materials[0].emissiveMap = asset(value).textures[0].uuid
    ]);
});
check('Armored texture sampling color-space and normal interpretation reject unsafe material upload state', () => {
    rejects([
        value => asset(value).textures[0].channel = 1,
        value => asset(value).textures[0].mapping = 301,
        value => asset(value).textures[0].repeat = [0, 1],
        value => asset(value).textures[0].anisotropy = 17,
        value => asset(value).textures[0].minFilter = 1004,
        value => asset(value).textures[0].generateMipmaps = false,
        value => asset(value).textures[0].flipY = true,
        value => asset(value).textures[0].colorSpace = '',
        value => asset(value).materials[0].normalScale = ['bad', 1],
        value => asset(value).materials[0].normalMapType = 999,
        value => asset(value).materials[0].roughness = 2,
        value => asset(value).materials[0].metalness = -.1
    ]);
});
check('Armored aggregate image budget charges independent assets rather than only individual texture records', () => {
    for (const make of [fixture, encodedFixture]) {
        const value = make(), single = value.assets.tank; value.assets = {};
        for (let i = 0; i < 10; i++) value.assets['tank-' + i] = plain(single);
        assert.doesNotThrow(() => admission.validate(value), 'Thirty RGBA8 images fit the two MiB budget');
        value.assets['tank-10'] = plain(single);
        assert.throws(() => admission.validate(value), /image byte budget/, 'Thirty-three decoded images exceed the whole-pack budget');
    }
});
check('Visual disposal releases shared template clone array-material textures and extras exactly once per owner', () => {
    const parsed = resources.parseObject(T, asset(admission.validate(fixture()))), clone = parsed.object.clone(true);
    const extra = new T.BufferGeometry(), counts = watched([...parsed.resources, ...graphResources(clone), extra]);
    resources.disposeTrees([parsed.object, clone], [...parsed.resources, extra, extra]);
    assert(counts.size >= 7); for (const count of counts.values()) assert.equal(count, 1);
});
check('Visual cleanup drains remaining identities when one disposer fails', () => {
    const calls: string[] = [];
    const bad = {dispose() { calls.push('bad'); throw Error('expected disposal failure'); }};
    const good = {dispose() { calls.push('good'); }};
    assert.throws(() => resources.disposeTrees([], [bad, good, bad]), AggregateError);
    assert.deepEqual(calls, ['bad', 'good']);
});
check('Failed Three material construction releases already staged geometry textures and materials', () => {
    const counts = new Map<any, number>(); let materialCalls = 0;
    const retain = (value: any) => {
        for (const resource of Object.values(value) as any[]) {
            counts.set(resource, 0); resource.addEventListener('dispose', () => counts.set(resource, counts.get(resource)! + 1));
        }
        return value;
    };
    class FailingLoader extends T.ObjectLoader {
        parseGeometries(...args: any[]): any { return retain(super.parseGeometries(...args)); }
        parseTextures(...args: any[]): any { return retain(super.parseTextures(...args)); }
        parseMaterials(...args: any[]): any {
            if (++materialCalls === 2) throw Error('expected second material failure');
            return retain(super.parseMaterials(...args));
        }
    }
    assert.throws(() => resources.parseObject({...T, ObjectLoader: FailingLoader}, asset(admission.validate(fixture()))), /expected second material failure/);
    assert.equal(materialCalls, 2); assert.equal(counts.size, 5);
    for (const count of counts.values()) assert.equal(count, 1);
});

check('Armored world destruction is idempotent isolates surviving worlds and prevents resource resurrection', () => {
    const root = globalThis as any, previous = {THREE: root.THREE, document: root.document, resources: root.LWVisualResources};
    const parseRecords: any[][] = [];
    root.THREE = T;
    root.document = {createElement(name: string) {
        assert.equal(name, 'canvas');
        return {width: 0, height: 0, getContext(kind: string) {
            assert.equal(kind, '2d');
            return {createImageData(width: number, height: number) { return {data: new Uint8ClampedArray(width * height * 4)}; }, putImageData() {}};
        }};
    }};
    root.LWVisualResources = {...resources, parseObject(three: any, json: any) {
        const parsed = resources.parseObject(three, json); parseRecords.push(parsed.resources); return parsed;
    }};
    let first: any, second: any;
    try {
        require('./armored-world.js');
        const catalog = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/concepts/armored-platoon/content/catalog.json'), 'utf8'));
        const definition = catalog.vehicles[0]; definition.asset = 'tank';
        const mission = {...catalog.missions[0], terrain: {width: 2, depth: 2, cellSize: 100, heights: [0,0,0,0], surface: 'ground'}, obstacles: [], supplies: []};
        const models = admission.validate(fixture()).assets, scenes = [new T.Scene(), new T.Scene()];
        const transform = {position: {x: 20, y: 1, z: 20}, yaw: 0, pitch: 0, roll: 0};
        const snapshot = {tick: 0, vehicles: [{id: 'one', definition: definition.id, previous: transform, transform, weapon: {turretYaw: 0, elevation: 0, recoil: 0}, body: {velocity: {x: 0, y: 0, z: 0}}, damage: {status: 'operational'}}], depots: [], obstacles: [], projectiles: [], smoke: [], events: []};
        first = root.LWArmoredWorld.create(scenes[0], mission, models); first.update(snapshot, catalog, 1, 0);
        second = root.LWArmoredWorld.create(scenes[1], mission, models); second.update(snapshot, catalog, 1, 0);
        assert.equal(parseRecords.length, 2);
        const firstCounts = watched([...graphResources(scenes[0]), ...parseRecords[0]!]);
        const secondCounts = watched([...graphResources(scenes[1]), ...parseRecords[1]!]);
        assert([...firstCounts.keys()].every(resource => !secondCounts.has(resource)));
        first.dispose(); first.dispose(); first.update(snapshot, catalog, 1, 0);
        assert.equal(scenes[0].children.length, 0); assert.equal(first.vehicles.size, 0);
        for (const count of firstCounts.values()) assert.equal(count, 1);
        for (const count of secondCounts.values()) assert.equal(count, 0);
        second.update(snapshot, catalog, 1, 0); assert.equal(second.vehicles.size, 1);
        second.dispose(); for (const count of secondCounts.values()) assert.equal(count, 1);
    } finally {
        first?.dispose(); second?.dispose();
        root.THREE = previous.THREE; root.document = previous.document; root.LWVisualResources = previous.resources;
    }
});

const passed = results.filter(result => result.passed).length;
fs.writeFileSync(path.join(__dirname, 'armored-visual-resources-results.json'), JSON.stringify({passed, total: results.length, results}, null, 2) + '\n');
console.log(`${passed}/${results.length} armored visual resource checks passed`);
if (passed !== results.length) process.exitCode = 1;
