/// <reference path="../process-contracts.d.ts" />
/** Process definitions the Process Studio browser suites import or apply: pure data builders with no page access. */
export const timerFixture = (d: LWProcess.Definition) => {
 const scene = (id: string, x: number) => ({id: 'scene-' + id, position: [x, 0] as [number, number], color: '#91b9d5'});
 Object.assign(d, {id: 'timer-fixture', name: 'Timer fixture', description: 'Counter loop task, a duration timer, an until timer and an end.', start: 'begin', resources: [], arrivals: [{at: 0, count: 1, interval: 0, data: {}}],
  steps: [{id: 'begin', name: 'Begin', kind: 'start', scene: scene('begin', 0)}, {id: 'loop', name: 'Count a pass', kind: 'task', duration: 5, add: {iteration: 1}, scene: scene('loop', 14)},
   {id: 'wait', name: 'Wait for review window', kind: 'timer', duration: 30, add: {waits: 1}, scene: scene('wait', 28)}, {id: 'until', name: 'Hold until contract date', kind: 'timer', until: 200, scene: scene('until', 42)}, {id: 'finish', name: 'Finish', kind: 'end', scene: scene('finish', 56)}],
  flows: [{id: 'f1', from: 'begin', to: 'loop'}, {id: 'f2', from: 'loop', to: 'wait'}, {id: 'f3', from: 'wait', to: 'until'}, {id: 'f4', from: 'until', to: 'finish'}]});
};
export const scene = (id: string, x: number) => ({id: 'scene-' + id, position: [x, 0] as [number, number], color: '#ffbb73'});
export const autoLine = () => ({format: 'wildlands-process', schemaVersion: 1, revision: 1, id: 'auto-line', name: 'Automated line', start: 'start',
 resources: [{id: 'crew', name: 'Operators', capacity: 2, costPerMinute: 1}, {id: 'welding', name: 'Welding cell', capacity: 2, costPerMinute: 2, kind: 'machine'}, {id: 'runners', name: 'CI runners', capacity: 3, costPerMinute: 1, kind: 'system'}],
 steps: [{id: 'start', name: 'Start', kind: 'start', scene: scene('start', 0)}, {id: 'prep', name: 'Prepare parts', kind: 'task', duration: 5, cost: 2, resources: {crew: 1}, set: {prepared: true}, scene: scene('prep', 14)},
  {id: 'weld', name: 'Weld frame', kind: 'machine', duration: 10, cost: 3, resources: {welding: 1}, technology: 'Robot arm', set: {welded: true}, outputs: [{field: 'welded', label: 'Welded part'}], scene: scene('weld', 28)},
  {id: 'verify', name: 'Verify build', kind: 'system', duration: 4, resources: {runners: 1}, add: {checks: 1}, technology: 'CI pipeline', outputs: [{field: 'checks'}], scene: scene('verify', 42)}, {id: 'end', name: 'Done', kind: 'end', scene: scene('end', 56)}],
 flows: [{id: 'f1', from: 'start', to: 'prep'}, {id: 'f2', from: 'prep', to: 'weld'}, {id: 'f3', from: 'weld', to: 'verify'}, {id: 'f4', from: 'verify', to: 'end'}], arrivals: [{at: 0, count: 2, interval: 0, data: {}}]});
export const automationFixture = (d: LWProcess.Definition) => {
 const scene = (id: string, x: number) => ({id: 'scene-' + id, position: [x, 0] as [number, number], color: '#91b9d5'});
 Object.assign(d, {id: 'automation-fixture', name: 'Automation fixture', description: 'A people task, a machine step and a system step.', start: 'begin', arrivals: [{at: 0, count: 4, interval: 0, data: {}}],
  resources: [{id: 'team', name: 'Team', capacity: 2, costPerMinute: 1}, {id: 'arm', name: 'Robot arm', capacity: 1, costPerMinute: 2, kind: 'machine'}, {id: 'ci', name: 'CI runners', capacity: 1, costPerMinute: 1, kind: 'system'}],
  steps: [{id: 'begin', name: 'Begin', kind: 'start', scene: scene('begin', 0)}, {id: 'plan', name: 'Plan the order', kind: 'task', duration: 10, resources: {team: 1}, scene: scene('plan', 14)},
   {id: 'pack', name: 'Pack boxes', kind: 'machine', technology: 'Robot arm', duration: 20, resources: {arm: 1}, scene: scene('pack', 28)}, {id: 'build', name: 'Build and test the release', kind: 'system', technology: 'CI/CD pipeline', duration: 20, resources: {ci: 1}, scene: scene('build', 42)},
   {id: 'finish', name: 'Finish', kind: 'end', scene: scene('finish', 56)}],
  flows: [{id: 'f1', from: 'begin', to: 'plan'}, {id: 'f2', from: 'plan', to: 'pack'}, {id: 'f3', from: 'pack', to: 'build'}, {id: 'f4', from: 'build', to: 'finish'}]});
};
export const randomLine = () => ({format: 'wildlands-process', schemaVersion: 1, revision: 1, id: 'random-line', name: 'Random line', start: 'start',
 resources: [{id: 'crew', name: 'Operators', capacity: 2, costPerMinute: 1}],
 steps: [{id: 'start', name: 'Start', kind: 'start', scene: scene('start', 0)}, {id: 'pack', name: 'Pack order', kind: 'task', duration: 12, cost: 1, resources: {crew: 1}, set: {packed: true}, scene: scene('pack', 14)},
  {id: 'cool', name: 'Cool down', kind: 'timer', duration: 30, scene: scene('cool', 28)}, {id: 'dock', name: 'Dock hold', kind: 'timer', until: 400, scene: scene('dock', 42)},
  {id: 'gate', name: 'Quality gate', kind: 'decision', scene: scene('gate', 56)}, {id: 'repack', name: 'Repack', kind: 'task', duration: 6, resources: {crew: 1}, add: {reworks: 1}, scene: scene('repack', 70)}, {id: 'end', name: 'Done', kind: 'end', scene: scene('end', 84)}],
 flows: [{id: 'f1', from: 'start', to: 'pack'}, {id: 'f2', from: 'pack', to: 'cool'}, {id: 'f3', from: 'cool', to: 'dock'}, {id: 'f4', from: 'dock', to: 'gate'}, {id: 'f5', from: 'gate', to: 'repack', when: {chance: 20}}, {id: 'f6', from: 'gate', to: 'end'}, {id: 'f7', from: 'repack', to: 'end'}],
 arrivals: [{at: 0, count: 6, interval: 0, data: {}}]});
export const journeyLine = () => ({format: 'wildlands-process', schemaVersion: 1, revision: 1, id: 'web-shop-journey', name: 'Web shop journey', genre: 'customer-journey', start: 'start',
 resources: [{id: 'crew', name: 'Support crew', capacity: 2, costPerMinute: 1}, {id: 'platform', name: 'Shop platform', capacity: 2, costPerMinute: 1, kind: 'system'}, {id: 'kiosk', name: 'Pickup kiosk', capacity: 1, costPerMinute: 1, kind: 'machine'}],
 steps: [{id: 'start', name: 'Start', kind: 'start', scene: scene('start', 0)},
  {id: 'ad', name: 'Sees an ad', kind: 'touchpoint', channel: 'social', phase: 'Awareness', emotion: 1, duration: 1, add: {mood: 1}, scene: scene('ad', 14)},
  {id: 'browse', name: 'Browses the shop', kind: 'touchpoint', channel: 'web', phase: 'Consideration', emotion: 1, duration: 3, resources: {platform: 1}, add: {mood: 1}, pain: 'Search results are slow.', scene: scene('browse', 28)},
  {id: 'intent', name: 'Wants to buy?', kind: 'decision', scene: scene('intent', 42)}, {id: 'checkout', name: 'Checks out', kind: 'touchpoint', channel: 'web', phase: 'Purchase', emotion: -1, duration: 4, add: {mood: -1}, scene: scene('checkout', 56)},
  {id: 'pack', name: 'Pack the order', kind: 'task', duration: 6, resources: {crew: 1}, set: {packed: true}, scene: scene('pack', 70)},
  {id: 'won', name: 'Parcel delivered', kind: 'end', scene: scene('won', 84)}, {id: 'lost', name: 'Left the shop', kind: 'end', scene: scene('lost', 98)}],
 flows: [{id: 'f1', from: 'start', to: 'ad'}, {id: 'f2', from: 'ad', to: 'browse'}, {id: 'f3', from: 'browse', to: 'intent'}, {id: 'f4', from: 'intent', to: 'lost', when: {chance: 30}}, {id: 'f5', from: 'intent', to: 'checkout'},
  {id: 'f6', from: 'checkout', to: 'pack'}, {id: 'f7', from: 'pack', to: 'won'}],
 arrivals: [{at: 0, count: 6, interval: 2, data: {}}]});
export const feedFixture = (extra: object = {}) => ({format: 'wildlands-process', schemaVersion: 1, revision: 1, id: 'feed-line', name: 'Feed line', start: 'start',
 resources: [{id: 'crew', name: 'Operators', capacity: 2, costPerMinute: 1}],
 steps: [{id: 'start', name: 'Start', kind: 'start', scene: scene('start', 0)}, {id: 'work', name: '=1+1, "x"', kind: 'task', duration: 3, resources: {crew: 1}, scene: scene('work', 14)}, {id: 'end', name: 'Done', kind: 'end', scene: scene('end', 28)}],
 flows: [{id: 'f1', from: 'start', to: 'work'}, {id: 'f2', from: 'work', to: 'end'}], arrivals: [{at: 0, open: true, interval: 1, data: {}}], ...extra});
export const journeyFixture = (d: LWProcess.Definition) => {
 const scene = (id: string, x: number, y = 0) => ({id: 'scene-' + id, position: [x, y] as [number, number], color: '#91b9d5'});
 const tp = (id: string, name: string, channel: string, phase: string, emotion: number, x: number, extra: Record<string, unknown> = {}) => ({id, name, kind: 'touchpoint', channel, phase, emotion, duration: 6, add: {mood: emotion}, scene: scene(id, x), ...extra});
 Object.assign(d, {id: 'journey-fixture', name: 'Journey fixture', genre: 'customer-journey', track: [{field: 'mood', label: 'Mood'}], start: 'start', resources: [{id: 'shop', name: 'Shop platform', capacity: 2, costPerMinute: 1, kind: 'system'}],
  steps: [{id: 'start', name: 'Visitor arrives', kind: 'start', phase: 'Awareness', emotion: 0, scene: scene('start', 0)}, tp('ad', 'Sees an advert', 'ads', 'Awareness', 1, 14, {pain: 'Adverts feel repetitive.'}),
   tp('browse', 'Browse the shop', 'web', 'Consideration', 1, 28, {pain: 'Search results are slow.', opportunity: 'Show best sellers first.'}), {id: 'intent', name: 'Interested?', kind: 'decision', phase: 'Consideration', scene: scene('intent', 42)},
   tp('support', 'Asks support in chat', 'chat', 'Consideration', -1, 56), tp('checkout', 'Checks out', 'web', 'Purchase', -2, 70, {resources: {shop: 1}, pain: 'Account creation is required.'}),
   {id: 'paid', name: 'Payment accepted?', kind: 'decision', phase: 'Purchase', scene: scene('paid', 84)}, tp('confirm', 'Reads the confirmation', 'email', 'Purchase', 2, 98), tp('delivery', 'Receives the parcel', 'delivery', 'Delivery', 3, 112, {duration: 10}),
   {id: 'won', name: 'Order delivered', kind: 'end', outcome: 'goal', phase: 'Delivery', scene: scene('won', 126)}, {id: 'lost', name: 'Left the shop', kind: 'end', outcome: 'lost', scene: scene('lost', 56, 14)}, tp('cart', 'Abandoned cart reminder', 'email', 'Purchase', -3, 84, {scene: scene('cart', 84, 14)})],
  flows: [{id: 'f1', from: 'start', to: 'ad'}, {id: 'f2', from: 'ad', to: 'browse'}, {id: 'f3', from: 'browse', to: 'intent'}, {id: 'f4', from: 'intent', to: 'lost', label: 'Bounces', when: {chance: 30}}, {id: 'f5', from: 'intent', to: 'support'}, {id: 'f6', from: 'support', to: 'checkout'},
   {id: 'f7', from: 'checkout', to: 'paid'}, {id: 'f8', from: 'paid', to: 'cart', when: {chance: 15}}, {id: 'f9', from: 'paid', to: 'confirm'}, {id: 'f10', from: 'cart', to: 'lost'}, {id: 'f11', from: 'confirm', to: 'delivery'}, {id: 'f12', from: 'delivery', to: 'won'}],
  arrivals: [{at: 0, count: 12, interval: 3, data: {mood: 0}}]});
};
export const roomsFixture = (d: LWProcess.Definition) => {
 const scene = (id: string, x: number) => ({id: 'scene-' + id, position: [x, 0] as [number, number], color: '#91b9d5'}), channels = ['web', 'mobile', 'store', 'phone', 'chat', 'email', 'social', 'ads', 'delivery', 'document', ''], moods = [-3, -2, -1, 0, 1, 2, 3];
 const tps = channels.map((c, i) => ({id: 'tp-' + (c || 'generic'), name: 'Touchpoint ' + (c || 'generic'), kind: 'touchpoint', ...(c ? {channel: c} : {}), ...(i < 7 ? {emotion: moods[i]} : {}), duration: 600, scene: scene('tp-' + (c || 'generic'), 28 + i * 14)}));
 Object.assign(d, {id: 'room-fixture', name: 'Touchpoint rooms', start: 'start', resources: [], arrivals: [{at: 5, count: 1, interval: 0, data: {}}],
  steps: [{id: 'start', name: 'Start', kind: 'start', scene: scene('start', 0)}, {id: 'fan', name: 'Fan', kind: 'fork', join: 'merge', scene: scene('fan', 14)}, ...tps, {id: 'merge', name: 'Merge', kind: 'join', scene: scene('merge', 200)}, {id: 'end', name: 'Done', kind: 'end', outcome: 'goal', phase: 'Done', scene: scene('end', 214)}],
  flows: [{id: 'f0', from: 'start', to: 'fan'}, ...tps.map(t => ({id: 'b-' + t.id, from: 'fan', to: t.id})), ...tps.map(t => ({id: 'j-' + t.id, from: t.id, to: 'merge'})), {id: 'fe', from: 'merge', to: 'end'}]});
};
// BPMN-class fixture: `rich` carries inclusive fork conditions, instances and deadline paths; the plain variant is what the step editor starts from.
export const claimsDesk = (rich: boolean, lateFirst = false) => {
 const scene = (id: string, x: number, y = 0) => ({id: 'scene-' + id, position: [x, y] as [number, number], color: '#91b9d5'});
 const late = {id: 'approve-late', from: 'approve', to: 'notify', on: 'deadline'}, normal = {id: 'f7', from: 'approve', to: 'done'};
 return {format: 'wildlands-process', schemaVersion: 1, revision: 1, id: 'claims-desk', name: 'Claims desk', start: 'start', seed: 7,
  resources: [{id: 'clerks', name: 'Clerks', capacity: 3, costPerMinute: 1}, {id: 'auditors', name: 'Auditors', capacity: 2, costPerMinute: 2}],
  steps: [{id: 'start', name: 'Start', kind: 'start', scene: scene('start', 0)},
   {id: 'intake', name: 'Take in the claim', kind: 'task', duration: 8, timing: {dist: 'uniform', min: 4, max: 14}, resources: {clerks: 1}, set: {registered: true}, ...rich ? {deadline: {after: 11, mode: 'interrupt', flow: 'intake-late'}} : {}, scene: scene('intake', 14)},
   {id: 'route', name: 'Route the claim', kind: 'fork', join: 'merge', ...rich ? {mode: 'inclusive'} : {}, scene: scene('route', 28)},
   {id: 'insure', name: 'Check insurance', kind: 'task', duration: 5, resources: {clerks: 1}, set: {insuredChecked: true}, scene: scene('insure', 42, -8)}, {id: 'gift', name: 'Check gift wrap', kind: 'task', duration: 5, resources: {clerks: 1}, set: {wrapped: true}, scene: scene('gift', 42, 8)},
   {id: 'merge', name: 'Merge checks', kind: 'join', scene: scene('merge', 56)},
   {id: 'inspect', name: 'Inspect the lines', kind: 'task', duration: 4, resources: {auditors: 1}, set: {inspected: true}, ...rich ? {instances: {field: 'lines', mode: 'parallel'}} : {backlog: {capacity: 5}}, scene: scene('inspect', 70)},
   {id: 'approve', name: 'Approve the payout', kind: 'task', duration: 30, resources: {clerks: 1}, set: {approved: true}, deadline: {after: 20, mode: 'escalate', flow: 'approve-late'}, scene: scene('approve', 84)},
   {id: 'notify', name: 'Notify the manager', kind: 'task', duration: 15, resources: {clerks: 1}, scene: scene('notify', 98, 8)}, {id: 'alert', name: 'Escalated', kind: 'end', scene: scene('alert', 112, 8)}, {id: 'done', name: 'Paid out', kind: 'end', outcome: 'goal', scene: scene('done', 98, -4)},
   ...rich ? [{id: 'timeout', name: 'Timed out', kind: 'end', outcome: 'lost', scene: scene('timeout', 28, 12)}] : []],
  flows: [{id: 'f1', from: 'start', to: 'intake'}, ...rich ? [{id: 'intake-late', from: 'intake', to: 'timeout', on: 'deadline'}] : [], {id: 'f2', from: 'intake', to: 'route'},
   {id: 'to-insure', from: 'route', to: 'insure', ...rich ? {when: {field: 'insured', op: 'eq', value: true}} : {}}, {id: 'to-gift', from: 'route', to: 'gift', ...rich ? {when: {all: [{field: 'gift', op: 'eq', value: true}, {not: {field: 'insured', op: 'eq', value: true}}]}} : {}}, ...rich ? [{id: 'to-merge', from: 'route', to: 'merge'}] : [],
   {id: 'f3', from: 'insure', to: 'merge'}, {id: 'f4', from: 'gift', to: 'merge'}, {id: 'f5', from: 'merge', to: 'inspect'}, {id: 'f6', from: 'inspect', to: 'approve'}, ...lateFirst ? [late, normal] : [normal, late], {id: 'f8', from: 'notify', to: 'alert'}],
  arrivals: [{at: 0, count: 6, interval: 6, data: {lines: 3}, draws: [{field: 'insured', kind: 'chance', percent: 50}, {field: 'gift', kind: 'chance', percent: 50}]}]};
};
/** A fast step feeding a slow step whose one-item backlog fills, so finished work is held (blocked) upstream. */
export const blockedLine = (d: LWProcess.Definition) => {
 const scene = (id: string, x: number) => ({id: 'scene-' + id, position: [x, 0] as [number, number], color: '#91b9d5'});
 Object.assign(d, {id: 'blocked-line', name: 'Blocked line', description: 'A fast step feeds a slow step with a one-item backlog.', start: 'begin',
  arrivals: [{at: 0, count: 6, interval: 0, data: {}}],
  resources: [{id: 'crew', name: 'Crew', capacity: 4, costPerMinute: 1}, {id: 'expert', name: 'Expert', capacity: 1, costPerMinute: 1}],
  steps: [{id: 'begin', name: 'Begin', kind: 'start', scene: scene('begin', 0)},
   {id: 'make', name: 'Make the part', kind: 'task', duration: 2, resources: {crew: 1}, scene: scene('make', 14)},
   {id: 'check', name: 'Check the part', kind: 'task', duration: 120, resources: {expert: 1}, backlog: {capacity: 1}, scene: scene('check', 28)},
   {id: 'finish', name: 'Finish', kind: 'end', scene: scene('finish', 42)}],
  flows: [{id: 'f1', from: 'begin', to: 'make'}, {id: 'f2', from: 'make', to: 'check'}, {id: 'f3', from: 'check', to: 'finish'}]});
};
