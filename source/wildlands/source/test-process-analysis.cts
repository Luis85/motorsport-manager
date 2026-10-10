/// <reference path="./process-contracts.d.ts" />
/**
 * Entry of the business-process-analysis suite: the checks added for the analytics read model, the CLI analysis commands, the
 * display calendar, rounding advisories, per-process application slots and structural editing. They share the business-process
 * harness (test-process-helpers.cts) but run as their own suite, so each suite stays well inside its time budget.
 */
import fs from 'node:fs';
import path from 'node:path';
import {results} from './test-process-helpers.cjs';
// The studio's escaping module, loaded before the checks that render inspector markup (as the studio page loads it first).
import './process-html.js';
import './test-process-analytics.cjs';
import './test-process-analytics-cli.cjs';
import './test-process-calendar.cjs';
import './test-process-advice.cjs';
import './test-process-application.cjs';
import './test-process-structure.cjs';
import './test-process-html.cjs';
import './test-process-random-calendar.cjs';
import './test-process-readmodel.cjs';
import './test-process-series.cjs';
import './test-process-slices.cjs';
import './test-process-route.cjs';
import './test-process-work-state.cjs';
import './test-process-slides-brief.cjs';
import './test-process-dashboard.cjs';
import './test-process-dashboard-render.cjs';
import './test-process-bpmn-schema.cjs';
import './test-process-palette.cjs';
import './test-process-work-derivation.cjs';
import './test-process-dashboard-wire.cjs';
import './test-process-statistics.cjs';
const report = {suite: 'business-process-analysis', passed: results.filter(r => r.passed).length, total: results.length, results};
fs.writeFileSync(path.join(__dirname, 'process-analysis-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.passed}/${report.total} process analysis checks passed`);
for (const r of results) if (!r.passed) console.error(r.name, r.error);
if (report.passed !== report.total) process.exitCode = 1;
