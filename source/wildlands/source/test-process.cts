/// <reference path="./process-contracts.d.ts" />
/** Entry of the business-process suite: the modules register their checks in this order, then one result file is written. */
import fs from 'node:fs';
import path from 'node:path';
import {results} from './test-process-helpers.cjs';
import './test-process-engine.cjs';
import './test-process-authoring.cjs';
import './test-process-steps.cjs';
import './test-process-random.cjs';
import './test-process-journeys.cjs';
import './test-process-semantics.cjs';
import './test-process-slides.cjs';
import './test-process-slides-cli.cjs';
const report = {suite: 'business-process', passed: results.filter(r => r.passed).length, total: results.length, results};
fs.writeFileSync(path.join(__dirname, 'process-results.json'), JSON.stringify(report, null, 2) + '\n');
console.log(`${report.passed}/${report.total} process checks passed`); for (const r of results) if (!r.passed) console.error(r.name, r.error);
if (report.passed !== report.total) process.exitCode = 1;
