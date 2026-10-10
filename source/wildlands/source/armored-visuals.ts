/** Offline Forge visual-pack admission before any renderer object or image is created.
 * V1 deliberately admits static indexed meshes, scalar PBR and semantic pivots only.
 * External image URIs, skins and animations require a subsequent explicit asset-pack version. */
(function(inputRoot: unknown) {
    'use strict';
    type Data = Record<string, unknown>;
    const root = inputRoot as {LWArmoredVisualsAdmission?: {validate(input: unknown): unknown}};
    const fail = (message: string): never => { throw Error('Armored visuals: ' + message); };
    function object(input: unknown): Data {
        if (!input || typeof input !== 'object' || Array.isArray(input) ||
            ![Object.prototype, null].includes(Object.getPrototypeOf(input))) return fail('expected plain data');
        return input as Data;
    }
    function array(input: unknown, max: number): unknown[] {
        if (!Array.isArray(input) || input.length > max) return fail('array exceeds resource limit');
        return input;
    }
    let visited = 0;
    function scan(input: unknown, depth = 0): void {
        if (++visited > 3000000) fail('aggregate data limit exceeded');
        if (depth > 40) fail('excessive nesting');
        if (input === null || typeof input === 'boolean' || typeof input === 'string') return;
        if (typeof input === 'number') { if (!Number.isFinite(input)) fail('non-finite value'); return; }
        if (Array.isArray(input)) {
            array(input, 3000000);
            const descriptors = Object.getOwnPropertyDescriptors(input);
            if (Object.keys(descriptors).length !== input.length + 1) fail('sparse array');
            for (let i = 0; i < input.length; i++) { const d = descriptors[String(i)]; if (!d || !('value' in d)) fail('array accessor'); scan(d!.value, depth + 1); }
            return;
        }
        const record = object(input);
        for (const key of Object.keys(record)) {
            if (['__proto__','constructor','prototype','url','uri','script','onLoad','onTick'].includes(key)) fail('unsupported field ' + key);
            const descriptor = Object.getOwnPropertyDescriptor(record, key);
            if (!descriptor || !('value' in descriptor)) fail('accessors are not data');
            scan(record[key], depth + 1);
        }
    }
    function matrix(input: unknown): void {
        if (array(input, 16).length !== 16 || (input as unknown[]).some(n => typeof n !== 'number' || !Number.isFinite(n))) fail('invalid semantic matrix');
    }
    function validate(input: unknown): unknown {
        visited = 0; scan(input);
        const pack = object(input);
        if (pack.format !== 'wildlands-armored-visuals' || pack.version !== 1 ||
            Object.keys(pack).some(k => !['format','version','assets'].includes(k))) fail('unsupported pack format/version');
        const assets = object(pack.assets), entries = Object.entries(assets);
        if (!entries.length || entries.length > 128) fail('expected 1..128 assets');
        for (const [id, value] of entries) {
            if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) fail('invalid asset identifier');
            const asset = object(value), model = object(asset.object), semantics = object(asset.semantics);
            if (Object.keys(asset).some(k => !['object','semantics'].includes(k))) fail('unknown asset field');
            if (Object.keys(model).some(k => !['metadata','geometries','materials','object'].includes(k))) fail('unsupported Three asset section');
            const geometryIds = new Set<string>(), materialIds = new Set<string>();
            let vertices = 0;
            for (const value of array(model.geometries, 2048)) {
                const g = object(value);
                if (g.type !== 'BufferGeometry' || typeof g.uuid !== 'string' || geometryIds.has(g.uuid)) fail('unsupported or duplicate geometry');
                geometryIds.add(g.uuid as string);
                const data = object(g.data), attributes = object(data.attributes), position = object(attributes.position);
                const positions = array(position.array, 1500000);
                if (position.itemSize !== 3 || positions.length % 3) fail('invalid positions');
                const count = positions.length / 3; vertices += count;
                if (vertices > 500000) fail('asset vertex budget exceeded');
                for (const [key, value] of Object.entries(attributes)) {
                    if (!['position','normal','uv','uv1','color','tangent'].includes(key)) fail('unsupported vertex channel');
                    const attribute = object(value), size = attribute.itemSize;
                    if (typeof size !== 'number' || !Number.isInteger(size) || size < 1 || size > 4) fail('invalid attribute size');
                    const values = array(attribute.array, 2000000);
                    if (!['Float32Array','Uint8Array','Uint16Array','Uint32Array','Int8Array','Int16Array','Int32Array'].includes(String(attribute.type))) fail('unsupported attribute array type');
                    const ranges: Record<string, [number, number]> = {Float32Array: [-1e20, 1e20], Uint8Array: [0,255], Uint16Array: [0,65535], Uint32Array: [0,4294967295], Int8Array: [-128,127], Int16Array: [-32768,32767], Int32Array: [-2147483648,2147483647]};
                    const range = ranges[String(attribute.type)]!;
                    if (values.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < range[0] || n > range[1] || (attribute.type !== 'Float32Array' && !Number.isInteger(n)))) fail('vertex value outside storage range');
                    if (key === 'position' && values.some(n => Math.abs(n as number) > 10000)) fail('position outside asset bounds');
                    if (values.length !== count * (size as number)) fail('attribute count mismatch');
                }
                if (data.index && !['Uint8Array','Uint16Array','Uint32Array'].includes(String(object(data.index).type))) fail('unsupported index type');
                if (data.index) for (const index of array(object(data.index).array, 3000000)) {
                    const limit = {Uint8Array: 255, Uint16Array: 65535, Uint32Array: 4294967295}[String(object(data.index).type)]!;
                    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= count || index > limit) fail('index outside geometry');
                }
            }
            for (const value of array(model.materials, 512)) {
                const m = object(value);
                if (m.type !== 'MeshStandardMaterial' || typeof m.uuid !== 'string' || materialIds.has(m.uuid)) fail('unsupported or duplicate material');
                if (Object.keys(m).some(k => /map$/i.test(k))) fail('texture maps require a versioned texture pack');
                materialIds.add(m.uuid as string);
            }
            const names = new Set<string>(); let nodes = 0;
            function visit(value: unknown): void {
                if (++nodes > 20000) fail('asset node budget exceeded');
                const node = object(value);
                if (!['Scene','Group','Object3D','Mesh'].includes(String(node.type))) fail('unsupported object type');
                if (typeof node.name === 'string' && node.name) { if (names.has(node.name)) fail('duplicate stable node path'); names.add(node.name); }
                if (node.type === 'Mesh') {
                    if (!geometryIds.has(String(node.geometry))) fail('missing mesh geometry');
                    for (const material of Array.isArray(node.material) ? node.material : [node.material]) if (!materialIds.has(String(material))) fail('missing mesh material');
                }
                if (node.matrix) matrix(node.matrix);
                for (const child of node.children ? array(node.children, 20000) : []) visit(child);
            }
            visit(model.object);
            if (semantics.format !== 'forge-semantic-bindings' || semantics.version !== 1) fail('missing semantic contract');
            const coordinates = object(semantics.coordinates);
            if (coordinates.unit !== 'metre' || coordinates.up !== '+Y' || coordinates.forward !== '+Z' || coordinates.matrix !== 'column-major') fail('coordinate mismatch');
            const roles = new Set<string>();
            for (const value of array(semantics.bindings, 256)) {
                const binding = object(value), role = String(binding.kind) + ':' + String(binding.role);
                if (!['articulation','socket','volume'].includes(String(binding.kind)) || roles.has(role)) fail('invalid or duplicate semantic role');
                if (binding.kind === 'volume') {
                    const bounds = object(binding.bounds), min = array(bounds.min, 3), max = array(bounds.max, 3);
                    if (min.length !== 3 || max.length !== 3 || min.some((n, i) => typeof n !== 'number' || typeof max[i] !== 'number' || n >= (max[i] as number))) fail('invalid semantic volume bounds');
                } else if (!names.has(String(binding.path))) fail('semantic binding lost its node');
                matrix(binding.localMatrix); matrix(binding.worldMatrix); roles.add(role);
            }
            for (const role of ['articulation:turret','articulation:gun','socket:muzzle']) if (!roles.has(role)) fail('required semantic role lost: ' + role);
        }
        return JSON.parse(JSON.stringify(input)) as unknown;
    }
    const api = Object.freeze({validate}); root.LWArmoredVisualsAdmission = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
