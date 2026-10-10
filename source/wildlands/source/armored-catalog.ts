/// <reference path="./armored-contracts.d.ts" />
/** Closed, bounded admission of armored v1 policy data. No defaults or executable recipes. */
(function(inputRoot: unknown) {
    'use strict';
    type RecordValue = Record<string, unknown>;
    const root = inputRoot as {LWArmoredCatalog?: LWArmoredData.CatalogApi};
    const fail = (path: string, message: string): never => { throw Error('Armored catalog ' + path + ': ' + message); };
    const identifier = /^[a-z][a-z0-9:-]{0,63}$/;
    function object(value: unknown, path: string, keys: string[]): RecordValue {
        if (!value || typeof value !== 'object' || Array.isArray(value) ||
            ![Object.prototype, null].includes(Object.getPrototypeOf(value))) return fail(path, 'expected a plain object');
        const record = value as RecordValue;
        for (const key of Object.keys(record)) if (!keys.includes(key)) fail(path, 'unknown field ' + key);
        for (const key of keys) {
            const descriptor = Object.getOwnPropertyDescriptor(record, key);
            if (!descriptor || !('value' in descriptor)) fail(path, 'missing data field ' + key);
        }
        return record;
    }
    function number(value: unknown, path: string, min: number, max: number): number {
        if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) return fail(path, 'expected finite number ' + min + '..' + max);
        return value;
    }
    function integer(value: unknown, path: string, min: number, max: number): number {
        const result = number(value, path, min, max);
        if (!Number.isSafeInteger(result)) fail(path, 'expected integer');
        return result;
    }
    function text(value: unknown, path: string, max = 256): string {
        if (typeof value !== 'string' || !value.length || value.length > max) return fail(path, 'expected nonempty bounded text');
        return value;
    }
    function id(value: unknown, path: string): string {
        const result = text(value, path, 64);
        if (!identifier.test(result)) fail(path, 'invalid identifier');
        return result;
    }
    function list(value: unknown, path: string, min: number, max: number): unknown[] {
        if (!Array.isArray(value) || value.length < min || value.length > max) return fail(path, 'expected ' + min + '..' + max + ' entries');
        return value;
    }
    function vector(value: unknown, path: string, positive = false): void {
        const record = object(value, path, ['x', 'y', 'z']);
        for (const axis of ['x', 'y', 'z']) number(record[axis], path + '.' + axis, positive ? .001 : -100000, 100000);
    }
    function unique(records: unknown[], path: string): Set<string> {
        const ids = records.map((value, index) => id((value as RecordValue)?.id, path + '[' + index + '].id'));
        if (new Set(ids).size !== ids.length) fail(path, 'duplicate identifier');
        return new Set(ids);
    }
    function validate(input: unknown): LWArmoredData.Catalog {
        let visited = 0;
        const inspect = (value: unknown, depth: number): void => {
            if (++visited > 2000000 || depth > 32) fail('', 'data complexity limit exceeded');
            if (value === null || typeof value === 'string' || typeof value === 'boolean') return;
            if (typeof value === 'number') { if (!Number.isFinite(value)) fail('', 'non-finite data'); return; }
            if (!value || typeof value !== 'object' || (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value)))) fail('', 'expected plain data');
            const descriptors = Object.getOwnPropertyDescriptors(value);
            if (Array.isArray(value) && Object.keys(descriptors).length !== value.length + 1) fail('', 'sparse array');
            for (const [key, descriptor] of Object.entries(descriptors)) {
                if (Array.isArray(value) && key === 'length') continue;
                if (!('value' in descriptor) || ['__proto__','constructor','prototype','toJSON'].includes(key)) fail('', 'non-data property');
                inspect(descriptor.value, depth + 1);
            }
        };
        inspect(input, 0);
        const data = object(input, '', ['format', 'version', 'vehicles', 'ammunition', 'surfaces', 'missions']);
        if (data.format !== 'wildlands-armored-catalog' || data.version !== 1) fail('', 'unsupported format/version');
        const ammo = list(data.ammunition, 'ammunition', 1, 64), vehicles = list(data.vehicles, 'vehicles', 1, 128);
        const surfaces = list(data.surfaces, 'surfaces', 1, 32), missions = list(data.missions, 'missions', 1, 128);
        const ammoIds = unique(ammo, 'ammunition'), vehicleIds = unique(vehicles, 'vehicles'), surfaceIds = unique(surfaces, 'surfaces');
        unique(missions, 'missions');
        for (const value of surfaces) {
            const s = object(value, 'surface', ['id', 'friction', 'rollingResistance']);
            number(s.friction, 'friction', .01, 2); number(s.rollingResistance, 'rollingResistance', 0, 1);
        }
        for (const value of ammo) {
            const a = object(value, 'ammunition', ['id', 'name', 'kind', 'velocity', 'mass', 'penetration', 'damage', 'drag', 'ricochetAngle', 'blastRadius', 'smokeSeconds']);
            text(a.name, 'ammunition.name');
            if (!['AP', 'HE', 'SMOKE'].includes(String(a.kind))) fail('ammunition.kind', 'unsupported ammunition');
            number(a.velocity, 'velocity', 1, 2000); number(a.mass, 'mass', .001, 100);
            number(a.penetration, 'penetration', 0, 1000); number(a.damage, 'damage', 0, 10000);
            number(a.drag, 'drag', 0, 1); number(a.ricochetAngle, 'ricochetAngle', 0, Math.PI / 2);
            number(a.blastRadius, 'blastRadius', 0, 100); number(a.smokeSeconds, 'smokeSeconds', 0, 300);
        }
        for (const value of vehicles) {
            const v = object(value, 'vehicle', ['id','name','asset','mass','length','width','height','engineForce','brakeForce','maxSpeed','reverseSpeed',
                'trackWidth','suspensionTravel','groundClearance','maxSlope','rollingResistance','turretSpeed','elevationSpeed','minElevation','maxElevation',
                'muzzleHeight','barrelLength','reloadSeconds','ammunition','ammoCapacity','armor','componentHealth','sightRange','aimSeconds','accuracy','repairKits','repairSeconds','repairRate']);
            text(v.name, 'vehicle.name'); id(v.asset, 'vehicle.asset');
            number(v.mass, 'mass', 100, 200000);
            for (const key of ['length','width','height','trackWidth','muzzleHeight','barrelLength']) number(v[key], key, .01, 30);
            if (Number(v.trackWidth) > Number(v.width)) fail('trackWidth', 'must fit hull width');
            for (const key of ['engineForce','brakeForce']) number(v[key], key, 1, 2000000);
            for (const key of ['maxSpeed','reverseSpeed']) number(v[key], key, .1, 50);
            number(v.suspensionTravel, 'suspensionTravel', 0, 2); number(v.groundClearance, 'groundClearance', .01, 3);
            number(v.maxSlope, 'maxSlope', 0, 1.5); number(v.rollingResistance, 'rollingResistance', 0, 1);
            for (const key of ['turretSpeed','elevationSpeed']) number(v[key], key, .001, 10);
            number(v.minElevation, 'minElevation', -Math.PI / 2, 0); number(v.maxElevation, 'maxElevation', 0, Math.PI / 2);
            number(v.reloadSeconds, 'reloadSeconds', .1, 120); integer(v.ammoCapacity, 'ammoCapacity', 1, 1000);
            const rounds = list(v.ammunition, 'vehicle.ammunition', 1, 16);
            if (new Set(rounds).size !== rounds.length || rounds.some(a => !ammoIds.has(String(a)))) fail('vehicle.ammunition', 'duplicate or unknown ammunition');
            const armor = object(v.armor, 'armor', ['front','side','rear','roof']);
            for (const key of Object.keys(armor)) number(armor[key], 'armor.' + key, 0, 1000);
            number(v.componentHealth, 'componentHealth', 1, 10000); number(v.sightRange, 'sightRange', 1, 5000);
            integer(v.repairKits, 'repairKits', 0, 20); number(v.repairSeconds, 'repairSeconds', .1, 300); number(v.repairRate, 'repairRate', .1, 10000);
            number(v.aimSeconds, 'aimSeconds', .1, 60); number(v.accuracy, 'accuracy', 0, 1);
        }
        for (const value of missions) validateMission(value, vehicleIds, surfaceIds);
        return JSON.parse(JSON.stringify(input)) as LWArmoredData.Catalog;
    }
    function validateMission(value: unknown, vehicleIds: Set<string>, surfaceIds: Set<string>): void {
        const m = object(value, 'mission', ['id','name','description','playerFaction','seed','terrain','obstacles','spawns','objectives','timeLimit']);
        text(m.name, 'mission.name'); text(m.description, 'mission.description', 4000); id(m.playerFaction, 'playerFaction');
        integer(m.seed, 'seed', 0, 0xffffffff); number(m.timeLimit, 'timeLimit', 0, 86400);
        const terrain = object(m.terrain, 'terrain', ['width','depth','cellSize','heights','surface']);
        const width = integer(terrain.width, 'terrain.width', 2, 512), depth = integer(terrain.depth, 'terrain.depth', 2, 512);
        number(terrain.cellSize, 'cellSize', .25, 100);
        const heights = list(terrain.heights, 'heights', width * depth, width * depth);
        for (const h of heights) number(h, 'terrain.height', -1000, 10000);
        if (!surfaceIds.has(String(terrain.surface))) fail('terrain.surface', 'unknown surface');
        const obstacles = list(m.obstacles, 'obstacles', 0, 2048), spawns = list(m.spawns, 'spawns', 1, 128);
        const objectives = list(m.objectives, 'objectives', 1, 64);
        const obstacleIds = unique(obstacles, 'obstacles'); unique(spawns, 'spawns'); unique(objectives, 'objectives');
        const mapPosition = (input: unknown, label: string): void => {
            vector(input, label); const p = input as RecordValue;
            number(p.x, label + '.x', 0, (width - 1) * Number(terrain.cellSize));
            number(p.z, label + '.z', 0, (depth - 1) * Number(terrain.cellSize));
        };
        let players = 0;
        for (const value of spawns) {
            const s = object(value, 'spawn', ['id','vehicle','faction','position','yaw','player']);
            if (s.id === 'armored-state' || String(s.id).startsWith('shell:') || String(s.id).startsWith('obstacle:') || String(s.id).startsWith('projectile:') || String(s.id).startsWith('smoke:') || obstacleIds.has(String(s.id).replace(/^obstacle:/, ''))) fail('spawn.id', 'reserved entity identity');
            if (!vehicleIds.has(String(s.vehicle))) fail('spawn.vehicle', 'unknown vehicle');
            id(s.faction, 'spawn.faction'); mapPosition(s.position, 'spawn.position'); number(s.yaw, 'spawn.yaw', -Math.PI * 2, Math.PI * 2);
            if (typeof s.player !== 'boolean') fail('spawn.player', 'expected boolean');
            if (s.player) { players++; if (s.faction !== m.playerFaction) fail('spawn', 'player must own controlled vehicle'); }
        }
        if (players !== 1) fail('spawns', 'exactly one initial controlled vehicle required');
        for (const value of obstacles) {
            const o = object(value, 'obstacle', ['id','position','size','material','destructible','health']);
            vector(o.position, 'obstacle.position'); vector(o.size, 'obstacle.size', true); id(o.material, 'obstacle.material');
            if (typeof o.destructible !== 'boolean') fail('obstacle.destructible', 'expected boolean');
            number(o.health, 'obstacle.health', 1, 100000);
        }
        for (const value of objectives) {
            const o = object(value, 'objective', ['id','name','kind','target','position','radius','required']);
            text(o.name, 'objective.name');
            if (!['eliminate','reach','survive'].includes(String(o.kind))) fail('objective.kind', 'unknown objective');
            if (typeof o.target !== 'string' || o.target.length > 64) fail('objective.target', 'expected bounded target');
            mapPosition(o.position, 'objective.position'); number(o.radius, 'objective.radius', 0, 10000);
            number(o.required, 'objective.required', 1, 86400);
            if (o.kind === 'eliminate') {
                const targets = spawns.filter(s => (s as RecordValue).faction === o.target && (s as RecordValue).faction !== m.playerFaction);
                if (!targets.length || Number(o.required) > targets.length || !Number.isInteger(o.required)) fail('objective', 'eliminate target/count cannot complete');
            }
        }
    }
    const api = Object.freeze({validate});
    root.LWArmoredCatalog = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
