/// <reference path="../process-contracts.d.ts" />
/**
 * Process Studio draft-actions suite: moving 2D cards into the draft (AUTH-11), Add step… and Tidy layout, the display-calendar
 * clock, the step list's blocked counts and the Activity feed after switching back. The checks live in the companion module
 * `process-browser-draft-checks.ts`; this entry runs them on the shared fixture in its own browser, apart from the
 * process-shell-browser suite so both stay well inside their time budgets.
 */
import {runSuite} from './process-browser-fixture';
import {draftChecks} from './process-browser-draft-checks';
runSuite('process draft browser harness', 'process-draft-browser-results.json', async studio => {
 await draftChecks(studio);
 await studio.checkLifecycle('Process draft browser lifecycle emits no runtime errors or network requests');
});
