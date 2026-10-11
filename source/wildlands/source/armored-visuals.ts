/// <reference path="./image-data.ts" />
/** Offline Forge visual-pack admission before any renderer object or image is created.
 * V1 retains scalar PBR. V2 adds bounded inline RGBA maps with explicit color roles.
 * External images, decoders, skins and animations are never admitted. */
(function(inputRoot: unknown) {
    'use strict';
    type Data = Record<string, unknown>;
    const root = inputRoot as {LWImageData: LWImageDataContract.Api; LWArmoredVisualsAdmission?: {validate(input: unknown): unknown}};
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
    function scan(input: unknown, depth = 0, path: string[] = [], inline = false): void {
        if (++visited > 3000000) fail('aggregate data limit exceeded');
        if (depth > 40) fail('excessive nesting');
        if (input === null || typeof input === 'boolean' || typeof input === 'string') return;
        if (typeof input === 'number') { if (!Number.isFinite(input)) fail('non-finite value'); return; }
        if (Array.isArray(input)) {
            array(input, 3000000);
            const descriptors = Object.getOwnPropertyDescriptors(input);
            if (Object.keys(descriptors).length !== input.length + 1) fail('sparse array');
            for (let i = 0; i < input.length; i++) { const d = descriptors[String(i)]; if (!d || !('value' in d)) fail('array accessor'); scan(d!.value, depth + 1, [...path, String(i)], inline); }
            return;
        }
        const record = object(input);
        for (const key of Object.keys(record)) {
            const typedImage = inline && key === 'url' && path.length === 5 && path[0] === 'assets' && path[2] === 'object' && path[3] === 'images';
            if (['__proto__','constructor','prototype','url','uri','script','onLoad','onTick'].includes(key) && !typedImage) fail('unsupported field ' + key);
            const descriptor = Object.getOwnPropertyDescriptor(record, key);
            if (!descriptor || !('value' in descriptor)) fail('accessors are not data');
            scan(record[key], depth + 1, [...path, key], inline);
        }
    }
    function matrix(input: unknown): void {
        if (array(input, 16).length !== 16 || (input as unknown[]).some(n => typeof n !== 'number' || !Number.isFinite(n))) fail('invalid semantic matrix');
    }
    /** Closed Three DataTexture subset: no URL strings, image decoding, cubemaps or shader input. */
    function textures(model: Data, charge: (bytes: number) => void): Map<string, string> {
        const images = new Set<string>(), roles = new Map<string, string>(), usedImages = new Set<string>();
        const identity = (value: unknown): string => {
            if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,127}$/.test(value) || ['constructor','prototype'].includes(value)) return fail('invalid resource identity');
            return value;
        };
        const closed = (value: Data, keys: string[]): void => {
            if (Object.keys(value).some(key => !keys.includes(key))) fail('unsupported texture resource field');
        };
        const finite = (value: unknown, min: number, max: number): boolean => typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max;
        const pair = (value: unknown, min: number, max: number): boolean => Array.isArray(value) && value.length === 2 && value.every(n => finite(n, min, max));
        for (const value of array(model.images ?? [], 32)) {
            const image = object(value); closed(image, ['uuid','url']);
            const id = identity(image.uuid), pixels = object(image.url);
            if (images.has(id)) fail('duplicate image'); images.add(id);
            closed(pixels, ['data','width','height','type','encoding']);
            if (pixels.type !== 'Uint8Array' || pixels.width !== 128 || pixels.height !== 128) fail('expected 128 x 128 RGBA8 image');
            // Charge decoded storage, so a compact transport cannot evade the GPU budget.
            charge(root.LWImageData.validateRGBA(pixels.data, pixels.encoding));
        }
        for (const value of array(model.textures ?? [], 32)) {
            const texture = object(value), id = identity(texture.uuid), image = identity(texture.image);
            closed(texture, ['uuid','name','image','mapping','channel','repeat','offset','center','rotation','wrap','format','internalFormat','type','normalized','colorSpace','minFilter','magFilter','anisotropy','flipY','generateMipmaps','premultiplyAlpha','unpackAlignment']);
            if (roles.has(id) || !images.has(image)) fail('duplicate texture or missing image');
            if (texture.name !== undefined && (typeof texture.name !== 'string' || texture.name.length > 256)) fail('invalid texture name');
            if (texture.mapping !== 300 || texture.channel !== 0 || texture.format !== 1023 || texture.type !== 1009) fail('unsupported texture interpretation');
            if (texture.internalFormat !== undefined && texture.internalFormat !== null) fail('explicit internal texture format is unsupported');
            if (!['srgb',''].includes(String(texture.colorSpace)) || typeof texture.colorSpace !== 'string') fail('unsupported texture color space');
            if (!pair(texture.repeat, .0625, 16) || !pair(texture.offset, -16, 16) || !pair(texture.center, -16, 16) || !finite(texture.rotation, -Math.PI * 2, Math.PI * 2)) fail('invalid texture transform');
            if (!Array.isArray(texture.wrap) || texture.wrap.length !== 2 || texture.wrap.some(n => ![1000,1001,1002].includes(Number(n)) || typeof n !== 'number')) fail('invalid texture wrapping');
            if (![1003,1006,1008].includes(Number(texture.minFilter)) || typeof texture.minFilter !== 'number' || ![1003,1006].includes(Number(texture.magFilter)) || typeof texture.magFilter !== 'number') fail('invalid texture filtering');
            if (!finite(texture.anisotropy, 1, 16) || !Number.isInteger(texture.anisotropy)) fail('invalid texture anisotropy');
            if (texture.flipY !== false || texture.premultiplyAlpha !== false || texture.normalized !== false || texture.unpackAlignment !== 1 || typeof texture.generateMipmaps !== 'boolean') fail('unsupported texture upload state');
            if (texture.minFilter === 1008 && !texture.generateMipmaps) fail('mipmap filter requires mipmaps');
            roles.set(id, texture.colorSpace as string); usedImages.add(image);
        }
        if (usedImages.size !== images.size) fail('unreferenced image');
        return roles;
    }
    function validate(input: unknown): unknown {
        const version = input && typeof input === 'object' ? Object.getOwnPropertyDescriptor(input, 'version')?.value : undefined;
        visited = 0; scan(input, 0, [], version === 2);
        const pack = object(input);
        if (pack.format !== 'wildlands-armored-visuals' || ![1, 2].includes(Number(pack.version)) || typeof pack.version !== 'number' ||
            Object.keys(pack).some(k => !['format','version','assets'].includes(k))) fail('unsupported pack format/version');
        const assets = object(pack.assets), entries = Object.entries(assets);
        if (!entries.length || entries.length > 128) fail('expected 1..128 assets');
        let imageBytes = 0;
        for (const [id, value] of entries) {
            if (!/^[a-z][a-z0-9-]{0,63}$/.test(id)) fail('invalid asset identifier');
            const asset = object(value), model = object(asset.object), semantics = object(asset.semantics);
            if (Object.keys(asset).some(k => !['object','semantics'].includes(k))) fail('unknown asset field');
            if (Object.keys(model).some(k => !['metadata','geometries','materials','object', ...(version === 2 ? ['textures','images'] : [])].includes(k))) fail('unsupported Three asset section');
            const textureRoles = version === 2 ? textures(model, bytes => { imageBytes += bytes; if (imageBytes > 2097152) fail('pack image byte budget exceeded'); }) : new Map<string, string>();
            const geometryIds = new Set<string>(), materialIds = new Set<string>(), texturedMaterials = new Set<string>(), uvGeometry = new Set<string>();
            let vertices = 0;
            for (const value of array(model.geometries, 2048)) {
                const g = object(value);
                if (g.type !== 'BufferGeometry' || typeof g.uuid !== 'string' || geometryIds.has(g.uuid)) fail('unsupported or duplicate geometry');
                geometryIds.add(g.uuid as string);
                const data = object(g.data), attributes = object(data.attributes), position = object(attributes.position);
                const positions = array(position.array, 1500000);
                if (position.itemSize !== 3 || positions.length % 3) fail('invalid positions');
                const count = positions.length / 3; vertices += count;
                if (attributes.uv && object(attributes.uv).itemSize === 2) uvGeometry.add(g.uuid as string);
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
                for (const key of Object.keys(m).filter(k => /map$/i.test(k))) {
                    if (version !== 2) fail('texture maps require a versioned texture pack');
                    if (!['map','normalMap','roughnessMap','metalnessMap'].includes(key)) fail('unsupported material map');
                    const role = key === 'map' ? 'srgb' : '';
                    if (typeof m[key] !== 'string' || textureRoles.get(m[key] as string) !== role) fail('missing texture or incorrect color space');
                    texturedMaterials.add(m.uuid as string);
                }
                if (version === 2) {
                    for (const key of ['roughness','metalness']) if (m[key] !== undefined && (typeof m[key] !== 'number' || m[key] < 0 || m[key] > 1)) fail('invalid scalar PBR value');
                    if (m.normalMapType !== undefined && m.normalMapType !== 0) fail('only tangent-space normal maps are supported');
                    if (m.normalScale !== undefined && (!Array.isArray(m.normalScale) || m.normalScale.length !== 2 || m.normalScale.some(n => typeof n !== 'number' || n < -16 || n > 16))) fail('invalid normal map scale');
                }
                materialIds.add(m.uuid as string);
            }
            if (version === 2) {
                const referenced = new Set((model.materials as Data[]).flatMap(material => ['map','normalMap','roughnessMap','metalnessMap'].flatMap(key => typeof material[key] === 'string' ? [material[key] as string] : [])));
                if ([...textureRoles.keys()].some(id => !referenced.has(id))) fail('unreferenced texture');
            }
            const names = new Set<string>(); let nodes = 0;
            function visit(value: unknown): void {
                if (++nodes > 20000) fail('asset node budget exceeded');
                const node = object(value);
                if (!['Scene','Group','Object3D','Mesh'].includes(String(node.type))) fail('unsupported object type');
                if (typeof node.name === 'string' && node.name) { if (names.has(node.name)) fail('duplicate stable node path'); names.add(node.name); }
                if (node.type === 'Mesh') {
                    if (!geometryIds.has(String(node.geometry))) fail('missing mesh geometry');
                    for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
                        if (!materialIds.has(String(material))) fail('missing mesh material');
                        if (texturedMaterials.has(String(material)) && !uvGeometry.has(String(node.geometry))) fail('textured mesh requires UV coordinates');
                    }
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
