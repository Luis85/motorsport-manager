/* Pure 3d6 roll-under arithmetic. House-rule rewards and cozy needs live elsewhere.
 * No rendering, clocks, Math.random(), network or I/O. See RULES.md for the rules boundary. */
(function (inputRoot: unknown) {
    'use strict';

    const DIFFICULTY = { E: 0, A: -1, H: -2, VH: -3 } as const;
    const DEFAULT_DIFFICULTY = { E: -4, A: -5, H: -6, VH: -6 } as const;
    type Difficulty = keyof typeof DIFFICULTY;
    type Outcome = 'impossible' | 'critical-success' | 'critical-failure' | 'success' | 'failure';
    interface RollResult {
        target: number;
        dice: number[];
        total: number;
        margin: number;
        success: boolean;
        critical: boolean;
        outcome: Outcome;
    }
    interface OddsResult { success: number; critical: number; }
    interface EncumbranceResult {
        grams: number;
        kg: number;
        liftKg: number;
        ratio: number;
        level: number;
        label: string;
        move: number;
        overloaded: boolean;
        maximumKg: number;
    }
    interface RandomStep { seed: number; value: number; }
    interface RpgApi {
        resolve(target: number, dice: readonly number[]): RollResult;
        odds(target: number): OddsResult;
        rank(points: number): number;
        nextCost(points: number): number;
        skillLevel(attribute: number, difficulty: Difficulty, points: number): number;
        encumbrance(strength: number, grams: number): EncumbranceResult;
        next(seed: number): RandomStep;
    }
    interface LittlewildRoot { LWRPG?: RpgApi; }
  const root = inputRoot as LittlewildRoot;

    function resolve(target: number, dice: readonly number[]): RollResult {
        if (!Number.isFinite(target) || !Array.isArray(dice) || dice.length !== 3 || dice.some(n => !Number.isInteger(n) || n < 1 || n > 6))
            throw Error('A check needs a finite target and three six-sided dice.');
        target = Math.floor(target);
        const total = dice.reduce((a, b) => a + b, 0), margin = target - total;
        if (target < 3)
            return { target, dice: [...dice], total, margin, success: false, critical: false, outcome: 'impossible' };
        const criticalSuccess = total <= 4 || (total === 5 && target >= 15) || (total === 6 && target >= 16);
        const criticalFailure = total === 18 || (total === 17 && target <= 15) || margin <= -10;
        const success = criticalSuccess || (!criticalFailure && total !== 17 && total <= target);
        return { target, dice: [...dice], total, margin, success, critical: criticalSuccess || criticalFailure,
            outcome: criticalSuccess ? 'critical-success' : criticalFailure ? 'critical-failure' : success ? 'success' : 'failure' };
    }
    const oddsCache = new Map<number, OddsResult>();
    function odds(target: number): OddsResult {
        target = Math.floor(target);
        const cached = oddsCache.get(target);
        if (cached) return cached;
        let success = 0, critical = 0;
        for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) for (let c = 1; c <= 6; c++) {
            const result = resolve(target, [a, b, c]);
            if (result.success) success++;
            if (result.success && result.critical) critical++;
        }
        const result = { success: success / 216, critical: critical / 216 };
        if (oddsCache.size > 100) oddsCache.clear();
        oddsCache.set(target, result);
        return result;
    }
    function rank(points: number): number {
        return points < 1 ? -1 : points < 2 ? 0 : points < 4 ? 1 : points < 8 ? 2 : 3 + Math.floor((points - 8) / 4);
    }
    function nextCost(points: number): number {
        const currentRank = rank(points);
        return (currentRank < 0 ? 1 : currentRank === 0 ? 2 : currentRank === 1 ? 4 : 8 + (currentRank - 2) * 4) - points;
    }
    function skillLevel(attribute: number, difficulty: Difficulty, points: number): number {
        if (!Number.isFinite(attribute) || !Object.hasOwn(DIFFICULTY, difficulty) || !Number.isFinite(points) || points < 0)
            throw Error('Invalid skill values.');
        return Math.floor(attribute) + (points < 1 ? DEFAULT_DIFFICULTY[difficulty] : DIFFICULTY[difficulty] + rank(points));
    }
    function encumbrance(strength: number, grams: number): EncumbranceResult {
        if (!Number.isFinite(strength) || strength <= 0 || !Number.isFinite(grams) || grams < 0)
            throw Error('Invalid carried load.');
        const liftKg = strength * strength / 5 * .45359237, kg = grams / 1000, ratio = kg / liftKg;
        const level = ratio <= 1 ? 0 : ratio <= 2 ? 1 : ratio <= 3 ? 2 : ratio <= 6 ? 3 : 4;
        return { grams, kg, liftKg, ratio, level, label: ['Unencumbered', 'Light', 'Medium', 'Heavy', 'Extra-heavy'][level] ?? 'Extra-heavy',
            move: Math.max(.2, 1 - .2 * level), overloaded: ratio > 10, maximumKg: liftKg * 10 };
    }
    function next(seed: number): RandomStep {
        seed = (seed + 0x6D2B79F5) >>> 0;
        let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
        t ^= t + Math.imul(t ^ t >>> 7, 61 | t);
        return { seed, value: ((t ^ t >>> 14) >>> 0) / 4294967296 };
    }
    const api: RpgApi = { resolve, odds, rank, nextCost, skillLevel, encumbrance, next };
    root.LWRPG = api;
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
