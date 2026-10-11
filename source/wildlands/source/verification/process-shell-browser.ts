/// <reference path="../process-contracts.d.ts" />
/**
 * Process Studio shell suite: Run to end (UX-12), New process and Import as a new process (AUTH-2 slots), the BPMN export notes
 * (DOM-11), the plain studio copy (UX-15) and draft recovery across reloads (ENG-9). The checks live in the companion modules
 * `process-browser-shell-checks.ts` and `process-browser-recovery-checks.ts`; this entry runs them on the shared fixture, in its
 * own browser, after the business-process-browser suite's switching and import checks have their own page.
 */
import {runSuite} from './process-browser-fixture';
import {shellChecks} from './process-browser-shell-checks';
import {recoveryChecks} from './process-browser-recovery-checks';
runSuite('process shell browser harness', 'process-shell-browser-results.json', async studio => {
 await shellChecks(studio);
 await recoveryChecks(studio);
 await studio.checkLifecycle('Process shell browser lifecycle emits no runtime errors or network requests');
});
