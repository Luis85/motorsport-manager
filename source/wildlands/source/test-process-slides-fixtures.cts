/// <reference path="./process-contracts.d.ts" />
/**
 * Shared fixtures of the slide checks: the bundled agency demos (file name and definition, sorted by file name) and the small
 * claims-desk definition. This module registers no checks, so suites can import it without running the slide checks again.
 */
import fs from 'node:fs';
import path from 'node:path';
import {stepOf, flowOf} from './test-process-helpers.cjs';

const CONTENT = path.resolve(__dirname, '../../../docs/concepts/agency-delivery/content');
export const demos = fs.readdirSync(CONTENT)
 .filter(f => f.endsWith('.process.json'))
 .sort()
 .map(f => [f, JSON.parse(fs.readFileSync(path.join(CONTENT, f), 'utf8')) as LWProcess.Definition] as const);

export function claims(): LWProcess.Definition {
 return {
  format: 'wildlands-process', schemaVersion: 1, revision: 1, seed: 3, id: 'small-claims', name: 'Small claims',
  description: 'A small claims desk used to check the slide model. All values are synthetic.', start: 'start',
  resources: [{id: 'clerks', name: 'Claims clerks', capacity: 2, costPerMinute: 1}],
  steps: [
   stepOf('start', 'start', {name: 'Claim received', phase: 'Intake'}, 0),
   stepOf('check', 'task', {
    name: 'Check the claim', phase: 'Intake', description: 'A clerk checks the claim form.', duration: 10, cost: 5,
    resources: {clerks: 1}, set: {checked: true}, deadline: {after: 15, mode: 'interrupt', flow: 'check-late'},
   }, 12),
   stepOf('supervisor', 'task', {name: 'Supervisor review', duration: 5, resources: {clerks: 1}, set: {checked: true}}, 24),
   stepOf('decide', 'decision', {name: 'Pay out?', phase: 'Decide'}, 36),
   stepOf('rejected', 'end', {name: 'Claim rejected'}, 48),
   stepOf('split', 'fork', {name: 'Pay and wait', phase: 'Payout', join: 'joined'}, 60),
   stepOf('pay', 'task', {name: 'Pay the claim', duration: 4, resources: {clerks: 1}, set: {paid: true}}, 72),
   stepOf('cooling', 'timer', {name: 'Cooling-off period', duration: 30}, 84),
   stepOf('joined', 'join', {name: 'Paid and closed'}, 96),
   stepOf('end', 'end', {name: 'Claim settled'}, 108),
  ],
  flows: [
   flowOf('start', 'check'), flowOf('check', 'decide'), {id: 'check-late', from: 'check', to: 'supervisor', on: 'deadline'},
   flowOf('supervisor', 'decide'),
   {id: 'decide-reject', from: 'decide', to: 'rejected', when: {chance: 20}, label: 'Not covered'},
   flowOf('decide', 'split'), flowOf('split', 'pay'), flowOf('split', 'cooling'),
   flowOf('pay', 'joined'), flowOf('cooling', 'joined'), flowOf('joined', 'end'),
  ],
  arrivals: [{at: 0, count: 3, interval: 5, data: {}}],
 };
}
