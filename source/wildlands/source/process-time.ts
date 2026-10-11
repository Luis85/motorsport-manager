/// <reference path="./process-contracts.d.ts" />
/**
 * Shared wording of simulated time for Process Studio views, slides and Present (LWProcessTime). The engine counts whole
 * business minutes: the working time a definition models, not wall-clock time. Every view that prints a duration names that
 * unit the same way and adds an hours gloss once a value is long enough that minutes stop being readable. Pure functions over
 * plain numbers: no DOM, session, clock or storage, and no calendar (a minute is never converted to days or weeks here).
 */
declare namespace LWProcessTime {
 interface Api {
  /** The unit of every simulated time: 'business minutes'. */
  readonly UNIT: string;
  /** Durations from this many minutes up also show hours ('240 min (≈ 4 h)'); shorter ones stay in minutes. */
  readonly HOURS_FROM: number;
  /** Whole numbers with thousands separators ('119,928'); other numbers keep their decimals. */
  number(n: number): string;
  /** A duration in business minutes: '45 min', '19,007 min (≈ 316.8 h)'. Rounded to one decimal. */
  minutes(n: number): string;
  /** A duration, or '—' when there is none (`null`, or no value yet). */
  maybe(n: number | null | undefined): string;
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessTime?: LWProcessTime.Api};
 const UNIT = 'business minutes', HOURS_FROM = 120;
 function number(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  const [whole, fraction] = String(Math.abs(n)).split('.');
  return (n < 0 ? '-' : '') + whole!.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction !== undefined ? '.' + fraction : '');
 }
 const tenth = (n: number) => Math.round(n * 10) / 10;
 function minutes(n: number): string {
  const text = number(tenth(n)) + ' min';
  return Math.abs(n) >= HOURS_FROM ? `${text} (≈ ${number(tenth(n / 60))} h)` : text;
 }
 const maybe = (n: number | null | undefined): string => n === null || n === undefined || !Number.isFinite(n) ? '—' : minutes(n);
 root.LWProcessTime = Object.freeze({UNIT, HOURS_FROM, number, minutes, maybe});
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessTime;
})(globalThis);
