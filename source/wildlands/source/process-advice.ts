/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-random-view.ts" />
/**
 * Non-blocking modelling advisories of a process definition (LWProcessAdvice). An advisory never blocks admission, never
 * changes a diagnostic and never changes a run: it points at a value that behaves differently from how it reads. Today it
 * reports whole-minute rounding bias (LWProcessRandomView.roundingNote) for every step timing, deadline timing and arrival
 * gap whose average draw is more than 5% away from its authored mean, in definition order (steps, then arrivals).
 * `process validate` and `process inspect` print the list as `advisories`; the inspector shows it as modelling notes. Pure: it
 * only reads a detached definition (one that passed the structural schema), with no DOM, session, clock or storage.
 */
declare namespace LWProcessAdvice {
 /** `path` is a JSON pointer such as '/steps/2/timing', '/steps/2/deadline/timing' or '/arrivals/0/gap'. */
 interface Advisory {path: string; message: string;}
 interface Api {advise(definition: LWProcess.Definition): Advisory[];}
}
(function(inputRoot: unknown) {
 'use strict';
 const root = inputRoot as {LWProcessRandomView: LWProcessRandomView.Api; LWProcessAdvice?: LWProcessAdvice.Api};
 function advise(definition: LWProcess.Definition): LWProcessAdvice.Advisory[] {
  const out: LWProcessAdvice.Advisory[] = [];
  const note = (path: string, dist: LWProcess.Dist | undefined) => {
   const message = root.LWProcessRandomView.roundingNote(dist);
   if (message) out.push({path, message});
  };
  (definition.steps ?? []).forEach((s, i) => {
   note('/steps/' + i + '/timing', s.timing);
   note('/steps/' + i + '/deadline/timing', s.deadline?.timing);
  });
  (definition.arrivals ?? []).forEach((a, i) => note('/arrivals/' + i + '/gap', a.gap));
  return out;
 }
 root.LWProcessAdvice = {advise};
 if (typeof module !== 'undefined' && module.exports) module.exports = root.LWProcessAdvice;
})(globalThis);
