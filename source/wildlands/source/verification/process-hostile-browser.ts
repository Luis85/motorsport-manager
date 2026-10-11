/// <reference path="../process-contracts.d.ts" />
/**
 * Process Studio hostile-definition suite, views part (ENG-16). Admitted definitions whose every free-text field holds markup,
 * attribute and URL breakers, CSS-breaking text, right-to-left and combining text, controls and one very long word
 * (`process-hostile-models.ts`) are imported as JSON and every view is visited without ticking: the shell and inspector, every
 * step in 2D and 3D, the SIPOC and Journey lenses, the Dashboard with every step focus, What-if and the CSV, Present (full and
 * brief decks, Contents), and Activity with its exports. The editors, dialogs and files are the process-hostile-editors-browser
 * suite (`process-hostile-editors-browser.ts`); the two run in parallel.
 *
 * Every page is probed (`process-hostile-probe.ts`): a payload that runs calls `__hit(n)`, error events, report-only Content
 * Security Policy violations and any script, image, frame or handler element made from data are recorded, and each check asserts
 * that the page stayed clean. The checks live in `process-hostile-views-checks.ts` and `process-hostile-dialog-checks.ts`.
 */
import {runSuite} from './process-browser-fixture';
import {hostileKit} from './process-hostile-kit';
import {viewChecks} from './process-hostile-views-checks';
import {dialogChecks} from './process-hostile-dialog-checks';
runSuite('process hostile browser harness', 'process-hostile-browser-results.json', async studio => {
 const kit = await hostileKit(studio);
 await studio.check('The probe sees a handler the test inserts run, reported by the policy and recorded, so a clean page ran nothing', kit.selfTest);
 await viewChecks(studio, kit);
 await dialogChecks(studio, kit);
 await studio.checkLifecycle('Process hostile browser lifecycle emits no runtime errors, console errors or network requests');
});
