/// <reference path="../process-contracts.d.ts" />
/**
 * Process Studio hostile-definition suite, editors and files part (ENG-16). The hostile definitions of `process-hostile-models.ts`
 * are opened in the step editor (every step) and the Definition editor (pasted into Raw JSON, with a diagnostic quoting hostile
 * text, then applied), given as names to Add step and New process, exported to BPMN (refused for controls XML cannot carry; the
 * XML-safe copy round-trips through the Import BPMN preview), listed in the export notes, read from a foreign BPMN file the
 * preview rejects, reopened from Download HTML and built as a game's own definitions whose draft is offered for recovery after a
 * reload. The views are the process-hostile-browser suite (`process-hostile-browser.ts`); the two run in parallel.
 *
 * Every page is probed (`process-hostile-probe.ts`) and served with a report-only policy; each check asserts that the page
 * stayed clean. The checks live in `process-hostile-editor-checks.ts` and `process-hostile-io-checks.ts`.
 */
import {runSuite} from './process-browser-fixture';
import {hostileKit} from './process-hostile-kit';
import {editorChecks} from './process-hostile-editor-checks';
import {ioChecks} from './process-hostile-io-checks';
runSuite('process hostile editors browser harness', 'process-hostile-editors-browser-results.json', async studio => {
 const kit = await hostileKit(studio);
 await studio.check('The probe sees a handler the test inserts run, reported by the policy and recorded, so a clean page ran nothing', kit.selfTest);
 await editorChecks(studio, kit);
 await ioChecks(studio, kit);
 await studio.checkLifecycle('Process hostile editors browser lifecycle emits no runtime errors, console errors or network requests');
});
