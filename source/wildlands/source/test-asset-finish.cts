/** Native Forge finishes remain portable through catalog admission and actual Three resources. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import Ajv from 'ajv/dist/2020';
type Finish = LWAssetFinishContract.Finish;
type Pixels = LWAssetFinishContract.Pixels;
type Surface = {kind: string; seed: number; scale: number; strength: number};
interface MaterialOptions {
    color?: string; roughness?: number; metalness?: number; flatShading?: boolean;
    finish?: Finish; surface?: Surface;
}
interface FixtureNode {primitive: string; material: string; id?: string; mesh?: string; materialProps?: MaterialOptions;}
interface ActorFixture {
    materials: Record<string, MaterialOptions>;
    models: Record<string, {nodes: FixtureNode[]}>;
    behaviors: {appearances: Record<string, {model: string; materials: Record<string, string>}>};
}
interface Definition {
    format: string; schemaVersion: number; category: string; id: string; name: string;
    materials: Record<string, MaterialOptions> & {paint: MaterialOptions & {color: string; finish: Finish & {palette: string[]}}};
    meshes: {body: {positions: number[]; indices: number[]; normals: number[]; uvs: number[]}};
    models: {world: {nodes: FixtureNode[]}}; metadata: {radius: number};
}
/** Structural CPU ports for the pinned vendor; no test double replaces Three resources. */
interface Texture {
    colorSpace: string; repeat: {x: number; set(x: number, y: number): void}; image: {data: Uint8Array};
    addEventListener(event: 'dispose', listener: () => void): void; dispose(): void;
}
interface Material {
    map: Texture | null; normalMap: Texture | null; roughnessMap: Texture | null; metalnessMap: Texture | null;
    color: {getHexString(): string}; roughness: number; metalness: number;
    userData: {finish?: Finish; finishAlgorithm?: string}; dispose(): void;
}
interface Object3D {children: Object3D[]; add(child: Object3D): void; clear(): void;}
interface Geometry {getAttribute(name: string): {array: ArrayLike<number>};}
interface Mesh extends Object3D {geometry: Geometry; material: Material;}
interface Three {
    Group: new () => Object3D; Mesh: new (geometry: Geometry, material: Material) => Mesh;
    BoxGeometry: new () => Geometry; DataTexture: new (...args: unknown[]) => Texture; Texture: {prototype: Texture};
    MeshStandardMaterial: new (options?: MaterialOptions) => Material;
    SRGBColorSpace: string; NoColorSpace: string;
}
interface Kit {
    T: Three; mat(color: string, extra: MaterialOptions): Material; group(parent: Object3D): Object3D;
    piece(parent: Object3D, kind: string, x: number, y: number, z: number, sx: number, sy: number, sz: number, color: string, angle: number, extra: MaterialOptions): Mesh;
}
interface Instance {asset: Definition; handles: Map<string, Mesh>;}
interface Renderer {
    createMaterial(three: Three, color: string, options?: MaterialOptions): Material;
    createFromDefinition(kit: Kit, parent: Object3D, input: unknown, model?: string, options?: {materials: Record<string, string | MaterialOptions>}): Instance;
    disposeKit(kit: Kit): void;
}
interface Realm {
    serialized: string; input?: unknown; reads?: number;
    LWAssetRenderer?: Renderer; LWAssets?: {validate(input: unknown): Definition};
}
function body(instance: Instance): Mesh {
    const mesh = instance.handles.get('body'); assert.ok(mesh); return mesh;
}
const source = path.resolve(__dirname, '../source');
const results: {name: string; passed: boolean; error?: string}[] = [];
function test(name: string, work: () => void): void {
    try { work(); results.push({name, passed: true}); }
    catch (error) { results.push({name, passed: false, error: error instanceof Error ? error.stack ?? error.message : String(error)}); console.error(name, error instanceof Error ? error.message : String(error)); }
}
const recipe = (seed = 7): Finish & {palette: string[]} => ({version: 1, kind: 'painted-metal', seed, scale: 2, wear: .35, palette: ['#485239', '#736746', '#313b2b']});
function definition(): Definition {
    return {format: 'littlewild-3d-asset', schemaVersion: 1, category: 'pet', id: 'finish-fixture', name: 'Native finish fixture',
        materials: {paint: {color: '#ffffff', roughness: .9, metalness: .85, flatShading: false, finish: recipe()}},
        meshes: {body: {positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], indices: [0, 1, 2], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], uvs: [.1, .2, .9, .2, .1, .8]}},
        models: {world: {nodes: [{primitive: 'mesh', id: 'body', mesh: 'body', material: 'paint'}]}}, metadata: {radius: 1}};
}
function runtime() {
    const realm: Realm = {serialized: JSON.stringify([definition()])};
    vm.createContext(realm);
    vm.runInContext('globalThis.LWAssetDefinitions=JSON.parse(serialized);', realm);
    for (const file of ['content-provider', 'asset-catalog', 'asset-surface', 'asset-finish', 'asset-renderer'])
        vm.runInContext(fs.readFileSync(path.join(__dirname, file + '.js'), 'utf8'), realm, {filename: file + '.js'});
    const browser: {window?: unknown; THREE?: Three} = {}; browser.window = browser;
    vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, '../vendor/three.js'), 'utf8'), browser);
    const T = browser.THREE, R = realm.LWAssetRenderer, A = realm.LWAssets;
    assert.ok(T); assert.ok(R); assert.ok(A);
    function authored<V>(value: V): V {
        realm.serialized = JSON.stringify(value);
        vm.runInContext('globalThis.input=JSON.parse(serialized);', realm);
        return realm.input as V;
    }
    const owned: Material[] = [], parent = new T.Group();
    let allocations = 0;
    const kit: Kit = {T, mat(color, extra) { allocations++; const material = R.createMaterial(T, color, extra); owned.push(material); return material; },
        group(parent) { allocations++; const group = new T.Group(); parent.add(group); return group; },
        piece(parent, kind, x, y, z, sx, sy, sz, color, angle, extra) {
            allocations++; const mesh = new T.Mesh(new T.BoxGeometry(), kit.mat(color, extra)); parent.add(mesh); return mesh;
        }};
    function dispose() {
        for (const material of owned) material.dispose();
        R!.disposeKit(kit); parent.clear();
    }
    return {realm, T, R, A, authored, kit, owned, parent, dispose, allocations: () => allocations};
}

test('Finish v1 pixels stay byte-identical to native Model Forge across kinds seeds wear and palettes', () => {
    const engine = require('./asset-finish.js') as LWAssetFinishContract.Api;
    const file = path.resolve(source, '../../model-forge/src/kernel/application/finish-pattern.ts');
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS}}).outputText;
    const native: {exports: {finishAlgorithm?: string; generateFinish?: (finish: Finish) => Pixels}} = {exports: {}}; vm.runInNewContext(code, native);
    assert.ok(native.exports.generateFinish);
    assert.equal(engine.algorithmVersion, native.exports.finishAlgorithm);
    for (const kind of ['painted-metal', 'bare-metal', 'rubber'] as const)
        for (const seed of [0, 7, 65535]) for (const wear of [0, .35, 1])
            for (const palette of [undefined, ['#ffffff'], ['#000000', '#ffffff', '#485239', '#AbCdEf']]) {
                const finish: Finish = {version: 1, kind, seed, scale: seed === 7 ? 16 : 1, wear, ...(palette ? {palette} : {})};
                const actual = engine.generate(finish), expected = native.exports.generateFinish(finish);
                assert.equal(actual.width, 128); assert.equal(actual.height, 128);
                for (const channel of ['color', 'normal', 'orm'] as const) assert.deepEqual(Buffer.from(actual[channel]), Buffer.from(expected[channel]));
            }
    const absent: Finish = {...recipe()}; delete absent.palette;
    assert.equal(engine.key(absent), engine.key({...absent, palette: ['#ffffff']}));
});

test('Finish schema and runtime catalog reject malformed recipes and mutually exclusive detail', () => {
    const r = runtime();
    const validate = new Ajv({strict: false}).compile(JSON.parse(fs.readFileSync(path.join(source, 'assets/asset.schema.json'), 'utf8')));
    assert.equal(validate(definition()), true, JSON.stringify(validate.errors));
    assert.deepEqual(JSON.parse(JSON.stringify(r.A.validate(r.authored(definition())).materials.paint.finish)), recipe());
    const changes = [{version: 2}, {kind: ['painted-metal']}, {kind: 'shader'}, {seed: -1}, {seed: .5}, {seed: 65536},
        {scale: 0}, {scale: 17}, {wear: -1}, {wear: 1.01}, {palette: []}, {palette: ['red']},
        {palette: ['#ffffff', '#ffffff', '#ffffff', '#ffffff', '#ffffff']}, {url: 'https://example.org/image.png'}];
    for (const change of changes) {
        const input = definition(); Object.assign(input.materials.paint.finish, change);
        assert.equal(validate(input), false, JSON.stringify(change));
        assert.throws(() => r.A.validate(r.authored(input)), /3D asset:/, JSON.stringify(change));
    }
    const missing = definition(); Reflect.deleteProperty(missing.materials.paint.finish, 'version');
    const conflicting = definition(); conflicting.materials.paint.surface = {kind: 'cloth', seed: 0, scale: 1, strength: .2};
    for (const input of [missing, conflicting]) {
        assert.equal(validate(input), false); assert.throws(() => r.A.validate(r.authored(input)), /3D asset:/);
    }
    r.dispose();
});

test('Finish admission returns detached frozen data and rejects accessors without executing them', () => {
    const r = runtime(), input = r.authored(definition());
    const accepted = r.A.validate(input), original = JSON.stringify(accepted);
    input.materials.paint.finish.palette[0] = '#ff0000';
    assert.equal(JSON.stringify(accepted), original);
    assert.equal(Object.isFrozen(accepted.materials.paint.finish), true);
    assert.equal(Object.isFrozen(accepted.materials.paint.finish.palette), true);
    vm.runInContext('globalThis.reads=0; Object.defineProperty(input.materials.paint.finish,"wear",{enumerable:true,get(){globalThis.reads++;return .5;}});', r.realm);
    assert.throws(() => r.A.validate(r.realm.input), /3D asset:/); assert.equal(r.realm.reads, 0);
    r.dispose();
});

test('Three finish maps share live owners preserve PBR multipliers and dispose only after the last owner', () => {
    const r = runtime(), {T, R} = r;
    const first = R.createMaterial(T, '#abcdef', {finish: recipe(), roughness: .9, metalness: .85});
    const second = R.createMaterial(T, '#123456', {finish: recipe(), roughness: .7, metalness: .6});
    assert.equal(first.map, second.map); assert.equal(first.normalMap, second.normalMap);
    assert.equal(first.roughnessMap, second.metalnessMap); assert.equal(first.roughnessMap, first.metalnessMap);
    assert.equal(first.map!.colorSpace, T.SRGBColorSpace);
    assert.equal(first.normalMap!.colorSpace, T.NoColorSpace); assert.equal(first.roughnessMap!.colorSpace, T.NoColorSpace);
    assert.equal(first.map!.repeat.x, 2); assert.equal(second.color.getHexString(), '123456');
    assert.equal(first.roughness, .9); assert.equal(first.metalness, .85); assert.equal(second.metalness, .6);
    assert.equal(first.userData.finishAlgorithm, 'forge-finish-v1');
    let releases = 0;
    for (const map of [first.map, first.normalMap, first.roughnessMap]) map!.addEventListener('dispose', () => releases++);
    first.dispose(); first.dispose(); assert.equal(releases, 0);
    second.dispose(); second.dispose(); assert.equal(releases, 3);
    const fresh = R.createMaterial(T, '#ffffff', {finish: recipe()}); assert.notEqual(fresh.map, first.map); fresh.dispose();
    r.dispose();
});

test('A failed material constructor releases its newly acquired finish maps exactly once', () => {
    const r = runtime(), {T, R} = r;
    const original = T.Texture.prototype.dispose; let releases = 0;
    T.Texture.prototype.dispose = function () { releases++; return original.call(this); };
    const broken: Three = {...T, MeshStandardMaterial: class extends T.MeshStandardMaterial {constructor() {super(); throw Error('Constructor fixture failure');}}};
    try {
        assert.throws(() => R.createMaterial(broken, '#ffffff', {finish: recipe()}), /Constructor fixture failure/);
        assert.equal(releases, 3);
        broken.MeshStandardMaterial = T.MeshStandardMaterial;
        const recovered = R.createMaterial(broken, '#ffffff', {finish: recipe()}); recovered.dispose();
        assert.equal(releases, 6);
        for (const at of [2, 3]) for (const stage of ['constructor', 'settings']) {
            let allocations = 0; const before: number = releases;
            const partial: Three = {...T, DataTexture: class extends T.DataTexture {
                constructor(...args: unknown[]) {
                    const fail = ++allocations === at;
                    if (fail && stage === 'constructor') throw Error('Texture fixture failure');
                    super(...args);
                    if (fail) this.repeat.set = () => {throw Error('Texture fixture failure');};
                }
            }};
            assert.throws(() => R.createMaterial(partial, '#ffffff', {finish: recipe()}), /Texture fixture failure/);
            assert.equal(releases - before, stage === 'constructor' ? at - 1 : at, stage + ' drains partial texture allocation');
            partial.DataTexture = T.DataTexture;
            const retry = R.createMaterial(partial, '#ffffff', {finish: recipe()}); retry.dispose();
            assert.equal(releases - before, (stage === 'constructor' ? at - 1 : at) + 3, 'Failed acquisition did not poison the pool');
        }
        const failingRelease = R.createMaterial(T, '#ffffff', {finish: recipe()});
        const before: number = releases;
        failingRelease.map!.addEventListener('dispose', () => {throw Error('Texture release fixture failure');});
        assert.throws(() => failingRelease.dispose(), /Texture release fixture failure|disposal failed/);
        assert.equal(releases - before, 3, 'One failed disposal must not strand other finish channels');
        failingRelease.dispose(); assert.equal(releases - before, 3, 'A failed drain still closes the owner');
        const retry = R.createMaterial(T, '#ffffff', {finish: recipe()});
        assert.notEqual(retry.map, failingRelease.map); retry.dispose();
    } finally { T.Texture.prototype.dispose = original; r.dispose(); }
});

test('Combined finish and surface budgets reject a whole model before root or GPU allocation', () => {
    const r = runtime(), {T, R} = r, many = definition();
    many.models.world.nodes = [];
    for (let seed = 0; seed <= 256; seed++) {
        many.materials['role' + seed] = {color: '#ffffff', finish: recipe(seed)};
        many.models.world.nodes.push({primitive: 'box', material: 'role' + seed});
    }
    assert.throws(() => R.createFromDefinition(r.kit, r.parent, r.authored(many)), /256 active/);
    assert.equal(r.parent.children.length, 0); assert.equal(r.allocations(), 0);
    const existing: Material[] = [];
    try {
        existing.push(R.createMaterial(T, '#ffffff', {surface: {kind: 'cloth', seed: 0, scale: 1, strength: .2}}));
        for (let seed = 0; seed < 255; seed++) existing.push(R.createMaterial(T, '#ffffff', {finish: recipe(seed)}));
        const one = definition(); one.materials.paint.finish = recipe(255);
        assert.throws(() => R.createFromDefinition(r.kit, r.parent, r.authored(one)), /256 active/);
        assert.equal(r.parent.children.length, 0); assert.equal(r.allocations(), 0);
        one.materials.paint.finish = recipe(0);
        const made = R.createFromDefinition(r.kit, r.parent, r.authored(one));
        assert.equal(body(made).material.map, existing[1]!.map);
    } finally { for (const material of existing) material.dispose(); r.dispose(); }
});

test('Littlewild finish recipes instantiate through the generic renderer with authored UVs and appearance colors', () => {
    const r = runtime(), input = r.authored(definition());
    const made = r.R.createFromDefinition(r.kit, r.parent, input, 'world', {materials: {paint: '#667755'}});
    try {
        const mesh = body(made), expected = (require('./asset-finish.js') as LWAssetFinishContract.Api).generate(recipe());
        assert.equal(mesh.material.color.getHexString(), '667755');
        assert.deepEqual(JSON.parse(JSON.stringify(mesh.material.userData.finish)), recipe());
        assert.deepEqual(Buffer.from(mesh.material.map!.image.data), Buffer.from(expected.color));
        assert.deepEqual(Buffer.from(mesh.material.normalMap!.image.data), Buffer.from(expected.normal));
        assert.deepEqual(Buffer.from(mesh.material.roughnessMap!.image.data), Buffer.from(expected.orm));
        const uv = Array.from(mesh.geometry.getAttribute('uv').array);
        for (let i = 0; i < uv.length; i++) assert.ok(Math.abs(uv[i]! - definition().meshes.body.uvs[i]!) < 1e-6);
        assert.ok(mesh.geometry.getAttribute('tangent'));
        assert.equal(made.asset.materials.paint.color, '#ffffff', 'Appearance did not rewrite the definition.');
    } finally { r.dispose(); }
});

test('Catalog admission rejects merged material conflicts and preserves valid node and actor palettes', () => {
    const r = runtime(), surface = {kind: 'cloth', seed: 0, scale: 1, strength: .2};
    const first = definition(); first.models.world.nodes[0]!.materialProps = {surface};
    assert.throws(() => r.A.validate(r.authored(first)), /combine surface and finish/);
    const reverse = definition(); delete (reverse.materials.paint as MaterialOptions).finish;
    reverse.materials.paint.surface = surface; reverse.models.world.nodes[0]!.materialProps = {finish: recipe()};
    assert.throws(() => r.A.validate(r.authored(reverse)), /combine surface and finish/);
    const valid = definition(); valid.models.world.nodes[0]!.materialProps = {finish: recipe(19), color: '#abcdef'};
    assert.equal(r.A.validate(r.authored(valid)).models.world.nodes[0]!.materialProps!.finish!.seed, 19);
    const accessor = r.authored(first); let reads = 0;
    Object.defineProperty(accessor.models.world.nodes[0]!.materialProps!, 'surface', {get() { reads++; return surface; }});
    assert.throws(() => r.A.validate(accessor)); assert.equal(reads, 0);
    const actor = (JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../docs/concepts/littlewild/assets/creatures/sproutling/definition.json'), 'utf8')) as {visual: ActorFixture}).visual;
    actor.materials.fur = {color: '#ffffff', finish: recipe()};
    assert.doesNotThrow(() => r.A.validate(r.authored(actor)));
    const selected = Object.values(actor.behaviors.appearances)[0]!;
    assert.equal(typeof selected.materials.fur, 'string');
    actor.models[selected.model]!.nodes.push({primitive: 'box', id: 'merged-conflict', material: 'fur', materialProps: {surface}});
    assert.throws(() => r.A.validate(r.authored(actor)), /combine surface and finish/);
    assert.equal(r.allocations(), 0);
});

test('Material and per-node surface-finish conflicts fail before resource allocation', () => {
    const r = runtime(), surface = {kind: 'cloth', seed: 0, scale: 1, strength: .2};
    assert.throws(() => r.R.createMaterial(r.T, '#ffffff', {finish: recipe(), surface}), /combine surface and finish/);
    const input = definition(); input.models.world.nodes[0]!.materialProps = {surface};
    assert.throws(() => r.R.createFromDefinition(r.kit, r.parent, r.authored(input)), /combine surface and finish/);
    assert.equal(r.parent.children.length, 0); assert.equal(r.allocations(), 0);
    for (const change of [{wear: 2}, {seed: '7'}, {kind: ['painted-metal']}, {url: 'https://example.com/finish'}]) {
        const finish = r.authored({...recipe(), ...change}) as Finish;
        assert.throws(() => r.R.createFromDefinition(r.kit, r.parent, r.authored(definition()), 'world', {materials: {paint: {color: '#ffffff', finish}}}));
        assert.equal(r.parent.children.length, 0); assert.equal(r.allocations(), 0, 'Malformed appearance finish fails before root, material or geometry allocation');
    }
    const accessor = r.authored(recipe()); let called = false;
    Object.defineProperty(accessor, 'wear', {get() {called = true; throw Error('Unexpected finish getter');}});
    assert.throws(() => r.R.createFromDefinition(r.kit, r.parent, r.authored(definition()), 'world', {materials: {paint: {color: '#ffffff', finish: accessor}}}));
    assert.equal(called, false); assert.equal(r.parent.children.length, 0); assert.equal(r.allocations(), 0);
    const inherited: Finish = {...recipe()}; delete inherited.palette;
    const expected = {...inherited}; let paletteReads = 0, serializations = 0;
    Object.setPrototypeOf(inherited, {
        get palette() {paletteReads++; throw Error('Unexpected inherited palette getter');},
        toJSON() {serializations++; throw Error('Unexpected inherited serializer');}
    });
    const engine = require('./asset-finish.js') as LWAssetFinishContract.Api;
    assert.deepEqual(engine.validate(inherited), expected);
    assert.equal(engine.key(inherited), engine.key({...expected, palette: ['#ffffff']}));
    const made = r.R.createFromDefinition(r.kit, r.parent, r.authored(definition()), 'world', {materials: {paint: {color: '#ffffff', finish: inherited}}});
    const material = body(made).material;
    assert.deepEqual(JSON.parse(JSON.stringify(material.userData.finish)), expected);
    assert.deepEqual(Buffer.from(material.map!.image.data), Buffer.from(engine.generate(expected).color));
    assert.equal(paletteReads, 0); assert.equal(serializations, 0, 'Inherited optional behavior is ignored through admission, generation and metadata projection');
    r.dispose();
});

const passed = results.filter(result => result.passed).length;
fs.writeFileSync(path.join(__dirname, 'asset-finish-results.json'), JSON.stringify({passed, total: results.length, results}, null, 2));
console.log(passed + '/' + results.length);
if (passed !== results.length) process.exitCode = 1;
