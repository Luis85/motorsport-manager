import type { Random } from '../domain/random.js';
import { type Area } from '../domain/schema-procedural.js';
/**
 * Deterministic 2D point distributions over [x, z]. Every coordinate is rounded to 1e-4
 * before it is tested or returned, so the reported points are exactly the points that
 * passed the spacing rules. The only randomness is the caller's keyed stream.
 */
export type Point2 = [number, number];
export interface Bounds2 {
    min: Point2;
    max: Point2;
}
/** Round to 1e-4 and normalize -0, so JSON output never depends on the sign of zero. */
export declare const round4: (value: number) => number;
export declare function areaBounds(area: Area): Bounds2;
/** Boundary points count as inside. Polygons use the even-odd rule. */
export declare function insideArea(area: Area, p: Point2): boolean;
export declare const insideBounds: (bounds: Bounds2, p: Point2) => boolean;
/**
 * Bridson Poisson-disk sampling inside bounds: no two points closer than minDistance.
 * Candidates around an active point are drawn uniformly from the square [-2r, 2r]^2 and
 * rejected unless r <= distance <= 2r (the annulus), which needs no trigonometry.
 */
export declare function poissonDisk(bounds: Bounds2, minDistance: number, random: Random): Point2[];
/** A grid centered in bounds with spacing step; jitter (0..1) moves points by up to step/2. */
export declare function gridLayout(bounds: Bounds2, step: number, jitter: number, random: Random): Point2[];
/**
 * The rect whose centered grid of spacing step holds exactly columns x rows points about
 * center: the outer points sit just under half a step inside it, so jitter stays inside.
 * Bounds are multiples of 1e-4, symmetric about the center rounded to 1e-4, and round
 * inward, so float noise never admits an extra row or column (steps below 0.0002 m leave
 * an empty rect, which the scatter schema refuses).
 */
export declare function gridArea(columns: number, rows: number, step: number, center?: Point2): Extract<Area, {
    type: 'rect';
}>;
export interface PathPoint {
    point: Point2;
    /** Degrees about +Y that turn +Z to the local path direction. */
    heading: number;
}
/** Points every spacing meters along a polyline, starting at its first point. */
export declare function pathLayout(points: readonly Point2[], spacing: number): PathPoint[];
/**
 * Uniform points in bounds until count of them lie inside the area, or 64 attempts per
 * point or the PROCEDURAL_MAX_CANDIDATES budget of attempts were spent. Returns every
 * attempt (never more than the budget); the caller counts the outside ones.
 */
export declare function uniformRandom(area: Area, count: number, random: Random): {
    points: Point2[];
    inside: number;
};
