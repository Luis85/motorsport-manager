/// <reference path="../process-contracts.d.ts" />
/**
 * Process Studio Present brief-deck suite (PR-6): the Contents **Section slides only** switch. The check lives in the companion
 * module `process-present-brief-checks.ts`; this entry runs it on the shared fixture in its own browser, so the
 * process-present-browser suite stays within its time budget.
 */
import {runSuite} from './process-browser-fixture';
import {presentBriefChecks} from './process-present-brief-checks';
runSuite('process present brief browser harness', 'process-present-brief-browser-results.json', async studio => {
 await presentBriefChecks(studio);
 await studio.checkLifecycle('Process present brief browser lifecycle emits no runtime errors or network requests');
});
