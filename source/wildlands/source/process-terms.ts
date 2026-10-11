/// <reference path="./process-contracts.d.ts" />
/**
 * Wording that follows the process type (`definition.genre`). A business process talks about cases; a customer journey about
 * customers; a user journey about users. The same helper names the second 2D lens (SIPOC or Journey map) so the view switcher, the
 * inspector, the KPI strip, the Inputs and outputs panel and the activity list agree. Pure values: no DOM, session, clock or storage.
 * Ids, field names and exported data are never reworded; this is display text only.
 */
declare namespace LWProcessTerms {
 interface Terms {
  genre: LWProcess.Genre;
  /** True for customer and user journeys. */
  journey: boolean;
  /** 'case', 'customer', 'user' and their plural, lower case and capitalised. */
  one: string; many: string; One: string; Many: string;
  /** The plain name of the process type: 'Business process', 'Customer journey', 'User journey'. */
  label: string;
  /** Heading of the step list: 'Steps' or 'Touchpoints and steps'. */
  stepsHeading: string;
  /** KPI label for finished cases: 'Completed' or 'Finished'. */
  finished: string;
  /** Which second 2D lens the type uses. */
  lens: 'sipoc' | 'journey';
  /** Label of the lens button and its longer description for the title and screen readers. */
  lensLabel: string; lensTitle: string;
  /** '1 case', '12 customers'. */
  count(n: number): string;
 }
 interface Api {
  /** Terms for a genre name or a definition; anything unknown reads as a business process. */
  of(source: string | {genre?: string} | undefined): Terms;
  /** The lens a genre uses. */
  lens(source: string | {genre?: string} | undefined): 'sipoc' | 'journey';
 }
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessTerms?: LWProcessTerms.Api};
 type Base = Omit<LWProcessTerms.Terms, 'count' | 'One' | 'Many' | 'journey'>;
 const SIPOC = {lens: 'sipoc', lensLabel: 'SIPOC', lensTitle: 'SIPOC view: suppliers, inputs, process, outputs, customers'} as const;
 const JOURNEY = {lens: 'journey', lensLabel: 'Journey map', lensTitle: 'Journey map: stages, touchpoints, feeling, funnel'} as const;
 const TERMS: Record<LWProcess.Genre, Base> = {
  process: {genre: 'process', one: 'case', many: 'cases', label: 'Business process', stepsHeading: 'Steps', finished: 'Completed', ...SIPOC},
  'customer-journey': {
   genre: 'customer-journey', one: 'customer', many: 'customers', label: 'Customer journey', stepsHeading: 'Touchpoints and steps',
   finished: 'Finished', ...JOURNEY,
  },
  'user-journey': {
   genre: 'user-journey', one: 'user', many: 'users', label: 'User journey', stepsHeading: 'Touchpoints and steps', finished: 'Finished',
   ...JOURNEY,
  },
 };
 const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
 function of(source: string | {genre?: string} | undefined): LWProcessTerms.Terms {
  const name = typeof source === 'string' ? source : source?.genre;
  const base = (name !== undefined && Object.hasOwn(TERMS, name) ? TERMS[name as LWProcess.Genre] : undefined) ?? TERMS.process;
  return {...base, journey: base.genre !== 'process', One: cap(base.one), Many: cap(base.many), count: n => `${n} ${n === 1 ? base.one : base.many}`};
 }
 root.LWProcessTerms = {of, lens: source => of(source).lens};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessTerms;
})(globalThis);
