/// <reference path="../process-contracts.d.ts" />
/**
 * Process Studio working-hours suite (package RC): the Working hours group of Tune values and the run bar clock. The checks live
 * in the companion module `process-hours-checks.ts`; this entry runs them on the shared fixture in its own browser, so the suites
 * near their time budgets (business-process-browser, process-definition-browser) do not grow.
 */
import {runSuite} from './process-browser-fixture';
import {hoursChecks} from './process-hours-checks';
runSuite('process hours browser harness', 'process-hours-browser-results.json', async studio => {
 await hoursChecks(studio);
 await studio.checkLifecycle('Process hours browser lifecycle emits no runtime errors or network requests');
});
