/// <reference path="../process-contracts.d.ts" />
/**
 * Process Studio Present view suite (PR-11): **Full screen**, **Wide text** and the studio behind the presentation. The checks live
 * in the companion modules `process-present-screen-checks.ts` (full screen, Escape, disabled reasons, the studio behind) and
 * `process-present-wide-checks.ts` (the wider slide column and the layout in both fonts and at a 24 px root font); this entry
 * runs them on the shared fixture in its own browser, so the process-present-browser suite stays within its time budget.
 */
import {runSuite} from './process-browser-fixture';
import {presentScreenChecks} from './process-present-screen-checks';
import {presentWideChecks} from './process-present-wide-checks';
runSuite('process present screen browser harness', 'process-present-screen-browser-results.json', async studio => {
 await presentScreenChecks(studio);
 await presentWideChecks(studio);
 await studio.checkLifecycle('Process present screen browser lifecycle emits no runtime errors or network requests');
});
