/// <reference path="../process-contracts.d.ts" />
/**
 * Shared page helpers of the process-step-editor-browser suite (owner: that suite): the entry and its companion check modules
 * each build them from the suite's page. They read the open dialog's text, ask the catalog whether a draft text is valid, and
 * cancel the step editor (confirming the discard when it asks) until no dialog is open. They register no checks.
 */
import type {Studio} from './process-browser-fixture';

/** The step editor helpers bound to one suite page. */
export function stepEditorKit(page: Studio['page']) {
 const dlgText = () => page.locator('dialog.pd-dialog[open]').innerText();
 const catalogOk = (text: string) =>
  page.evaluate(t => (globalThis as unknown as {LWProcessCatalog: LWProcess.Catalog}).LWProcessCatalog.validate(JSON.parse(t)).ok, text);
 const discard = async () => {
  await page.locator('#se-cancel').click();
  const confirm = page.locator('#se-discard');
  if (await confirm.count()) await confirm.click();
  await page.waitForFunction(() => document.querySelectorAll('dialog.pd-dialog[open]').length === 0);
 };
 return {dlgText, catalogOk, discard};
}
