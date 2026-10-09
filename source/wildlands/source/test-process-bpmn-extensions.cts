/// <reference path="./process-contracts.d.ts" />
/** Lossless round trips and malformed-input rejection for the Wildlands BPMN extensions (timers, automation, randomness, journeys, SIPOC). */
import assert from 'node:assert/strict';
import {catalog, bpmn} from './process-sdk.cjs';
import {test, stepOf, flowOf, cond, define, M, foreign, flow} from './test-process-bpmn-helpers.cjs';
const withTimer = (inner: string, event = 'intermediateCatchEvent') => foreign(`<bpmn:startEvent id="S"/><bpmn:${event} id="T">${inner}</bpmn:${event}><bpmn:endEvent id="E"/>${flow('A', 'S', 'T')}${flow('B', 'T', 'E')}`);
const duration = (text: string) => `<bpmn:timerEventDefinition><bpmn:timeDuration xsi:type="bpmn:tFormalExpression">${text}</bpmn:timeDuration></bpmn:timerEventDefinition>`;

test('BPMN round trip preserves timer steps, counters and field-to-field conditions losslessly', () => {
 const d = define([stepOf('start', 'start', 0), stepOf('work', 'task', 1, {duration: 3, add: {tries: 1, slack: -2}}), stepOf('wait', 'timer', 2, {duration: 90, add: {waits: 1}}), stepOf('gate', 'decision', 3),
  stepOf('hold', 'timer', 4, {until: 200}), stepOf('end', 'end', 5)],
 [flowOf('start', 'work'), flowOf('work', 'wait'), flowOf('wait', 'gate'), flowOf('gate', 'hold', cond({field: 'a', op: 'lt', valueField: 'b'})), flowOf('gate', 'end', cond({field: 'a', op: 'eq', value: 'b'})), flowOf('hold', 'end')], {a: 1, b: 2, tries: 0});
 d.flows.push({id: 'gate-end-literal', from: 'gate', to: 'end', when: cond({field: 'a', op: 'ne', valueField: 'true'})}, {id: 'gate-end-fallback', from: 'gate', to: 'end'});
 const xml = bpmn.export(d), back = bpmn.import(xml);
 assert(back.definition, JSON.stringify(back.diagnostics)); assert.deepEqual(back.warnings, []);
 assert.equal(catalog.fingerprint(back.definition), catalog.fingerprint(d)); assert.deepEqual(back.definition, d); assert.equal(bpmn.export(back.definition), xml);
 assert.match(xml, /<bpmn:intermediateCatchEvent id="Event_wait"[^>]*>[\s\S]*?<bpmn:timeDuration xsi:type="bpmn:tFormalExpression">PT90M<\/bpmn:timeDuration>/);
 assert.match(xml, /<bpmn:intermediateCatchEvent id="Event_hold"[\s\S]*?<bpmn:timeDate [^>]*>1970-01-01T03:20:00Z<\/bpmn:timeDate>/); assert.match(xml, /<wl:step id="hold" until="200"\/>/);
 assert.match(xml, /<wl:add name="tries" delta="1"\/>/); assert.match(xml, /<wl:when field="a" op="lt" valueField="b"\/>/);
 assert(xml.includes('${a &lt; b}') || xml.includes('${a < b}')); assert(xml.includes("'b'")); assert.doesNotMatch(xml, /\$\{a != true\}/);
 assert.match(xml, /<bpmndi:BPMNShape id="Event_wait_di"[\s\S]*?width="36" height="36"/);
 const expressionOnly = bpmn.import(xml.replace(/<bpmn:sequenceFlow id="Flow_gate-end-literal"[\s\S]*?<\/bpmn:sequenceFlow>/, '').replace(/<wl:when [^>]*\/>/g, '').replace(/<wl:add [^>]*\/>/g, '')).definition!.flows;
 assert.deepEqual(expressionOnly.find(f => f.id === 'gate-hold')?.when, {field: 'a', op: 'lt', valueField: 'b'}); assert.deepEqual(expressionOnly.find(f => f.id === 'gate-end')?.when, {field: 'a', op: 'eq', value: 'b'});
});

test('BPMN import accepts duration timer events and rejects unsupported timer and event forms explicitly', () => {
 const minutes = (xml: string) => bpmn.import(xml).definition!.steps.find(s => s.kind === 'timer')!;
 const m = minutes(withTimer(duration('PT45M'))), h = minutes(withTimer(duration('PT2H')));
 assert.equal(m.duration, 45); assert.equal(m.until, undefined); assert.equal(h.duration, 120); assert.equal(m.id, 't');
 // Catch timers read ISO-8601 exactly like boundary timers and BPSim: business days and hours from the options, a week of 5 days, under one minute rounded up to 1 with a warning.
 type Options = Parameters<typeof bpmn.import>[1];
 const timer = (text: string, o: Options = {}) => { const r = bpmn.import(withTimer(duration(text)), o); return {minutes: r.definition!.steps.find(s => s.kind === 'timer')!.duration, warnings: r.warnings}; };
 const boundary = (text: string, o: Options = {}) => bpmn.import(foreign(`<bpmn:startEvent id="S"/><bpmn:task id="K"/><bpmn:boundaryEvent id="B" attachedToRef="K">${duration(text)}</bpmn:boundaryEvent><bpmn:endEvent id="E"/><bpmn:endEvent id="E2"/>${flow('A', 'S', 'K')}${flow('C', 'K', 'E')}${flow('D', 'B', 'E2')}`), o).definition!.steps.find(s => s.id === 'k')!.deadline!.after;
 for (const [text, want, o] of [['PT1H30M', 90, {}], ['PT1.5H', 90, {}], ['PT90M', 90, {}], ['P1D', 480, {}], ['P1W', 2400, {}], ['PT1.5M', 2, {}], ['P1D', 240, {minutesPerDay: 240}], ['PT2H', 60, {minutesPerHour: 30}], ['PT4H', 240, {}]] as const) {
  assert.equal(timer(text, o).minutes, want, text + JSON.stringify(o)); assert.equal(boundary(text, o), want, 'boundary ' + text + JSON.stringify(o)); assert(!timer(text, o).warnings.some(w => /under one minute/.test(w)), text);
 }
 for (const sub of ['PT30S', 'PT0M', 'PT0.5M']) {
  const read = timer(sub); assert.equal(read.minutes, 1, sub); assert.equal(boundary(sub), 1, sub);
  assert(read.warnings.includes('Timer duration "' + sub + '" is under one minute and is rounded up to 1 minute.'), sub + ': ' + JSON.stringify(read.warnings));
 }
 for (const bad of ['45', '', 'pt5m', 'Pt5M', 'P1Y', 'P1M', 'PT', 'P', 'P1DT', '-PT5M', 'PT-5M', 'PT1,5H', 'PT5M ago', '${minutes}']) {
  assert.throws(() => bpmn.import(withTimer(duration(bad))), /Timer T is not supported: duration .* is not an ISO-8601 duration/, bad);
  assert.throws(() => boundary(bad), /boundaryEvent B is not supported: duration .* is not an ISO-8601 duration/, 'boundary ' + bad);
 }
 const form = (name: string) => `<bpmn:timerEventDefinition><bpmn:${name}>2026-01-01T00:00:00Z</bpmn:${name}></bpmn:timerEventDefinition>`;
 assert.throws(() => bpmn.import(withTimer(form('timeDate'))), /Timer T is not supported: timeDate has no business-minute meaning/);
 assert.throws(() => bpmn.import(withTimer(form('timeCycle'))), /timeCycle has no business-minute meaning/);
 assert.throws(() => bpmn.import(withTimer('<bpmn:timerEventDefinition/>')), /define exactly one timeDuration/);
 assert.throws(() => bpmn.import(withTimer('<bpmn:errorEventDefinition/>')), /intermediateCatchEvent T is not supported: error catch events cannot be simulated/);
 assert.throws(() => bpmn.import(withTimer('')), /no event definition/);
 assert.throws(() => bpmn.import(withTimer(duration('PT5M') + '<bpmn:signalEventDefinition/>')), /intermediateCatchEvent T is not supported/);
 assert.throws(() => bpmn.import(withTimer(duration('PT5M'), 'intermediateThrowEvent')), /intermediateThrowEvent T is not supported/);
 assert.throws(() => bpmn.import(foreign(`<bpmn:startEvent id="S"/><bpmn:task id="K"/><bpmn:boundaryEvent id="B" attachedToRef="K">${duration('PT5M')}</bpmn:boundaryEvent><bpmn:endEvent id="E"/>${flow('A', 'S', 'K')}${flow('C', 'K', 'E')}`)), /boundaryEvent B is not supported/);
 assert.throws(() => bpmn.import(foreign(`<bpmn:startEvent id="S"/><bpmn:intermediateCatchEvent id="T">${duration('PT5M')}</bpmn:intermediateCatchEvent><bpmn:endEvent id="E"/><bpmn:endEvent id="E2"/>${flow('A', 'S', 'T')}${flow('B', 'T', 'E')}${flow('C', 'T', 'E2')}`)), /Timer T has 2 outgoing flows/);
 const field = (text: string) => foreign(`<bpmn:startEvent id="S"/><bpmn:exclusiveGateway id="G" default="C"/><bpmn:endEvent id="E"/><bpmn:endEvent id="E2"/>${flow('A', 'S', 'G')}${flow('B', 'G', 'E', `<bpmn:conditionExpression>${text}</bpmn:conditionExpression>`)}${flow('C', 'G', 'E2')}`);
 assert.deepEqual(bpmn.import(field('${a >= b}')).definition!.flows.find(f => f.id === 'b')!.when, {field: 'a', op: 'gte', valueField: 'b'});
 assert.deepEqual(bpmn.import(field("${a == 'b'}")).definition!.flows.find(f => f.id === 'b')!.when, {field: 'a', op: 'eq', value: 'b'});
 assert.deepEqual(bpmn.import(field('${a == true}')).definition!.flows.find(f => f.id === 'b')!.when, {field: 'a', op: 'eq', value: true});
 assert.throws(() => bpmn.import(field('${a == B_Upper}')), /unsupported condition/);
});
const automated = () => {
 const d = define([stepOf('start', 'start', 0), stepOf('weld', 'machine', 1, {duration: 4, cost: 2, resources: {arm: 1}, technology: 'Robot arm', set: {welded: true}, outputs: [{field: 'welded', label: 'Welded'}]}),
  stepOf('build', 'system', 2, {duration: 3, resources: {ci: 2}, technology: 'CI/CD pipeline', add: {builds: 1}, outputs: [{field: 'builds'}]}),
  stepOf('check', 'task', 3, {duration: 2, resources: {crew: 1}, set: {ok: true}, outputs: [{field: 'ok', label: 'Checked'}]}), stepOf('end', 'end', 4)],
 [flowOf('start', 'weld'), flowOf('weld', 'build'), flowOf('build', 'check'), flowOf('check', 'end')], {builds: 0});
 d.resources = [{id: 'arm', name: 'Arm', capacity: 1, costPerMinute: 1, kind: 'machine'}, {id: 'ci', name: 'CI', capacity: 2, costPerMinute: 0, kind: 'system'}, {id: 'crew', name: 'Crew', capacity: 1, costPerMinute: 1, kind: 'people'}];
 return d;
};
const fingerprint = (d: LWProcess.Definition) => catalog.fingerprint(d);

test('BPMN round trip preserves machine and system steps, technology, outputs and resource kinds losslessly', () => {
 const d = automated(), xml = bpmn.export(d), back = bpmn.import(xml);
 assert(back.ok && back.definition, JSON.stringify(back.diagnostics)); assert.deepEqual(back.warnings, []);
 assert.deepEqual(back.definition, catalog.validate(d, true).definition); assert.equal(fingerprint(back.definition), fingerprint(d));
 assert.match(xml, /<bpmn:serviceTask id="Activity_build"/); assert.match(xml, /<bpmn:task id="Activity_weld"/);
 assert.match(xml, /<wl:step id="weld" kind="machine"[^>]*technology="Robot arm"/); assert.match(xml, /<wl:output field="welded" label="Welded"\/>/);
 assert.match(xml, /<wl:resource id="arm"[^>]*kind="machine"\/>/);
 assert.match(xml, /<bpmndi:BPMNShape id="Activity_build_di"[\s\S]*?width="100" height="80"/);
 const again = bpmn.import(bpmn.export(back.definition)); assert.deepEqual(again.definition, back.definition);
});

test('BPMN import keeps foreign service tasks as tasks and reports inconsistent automated-step extensions explicitly', () => {
 const WL = 'xmlns:wl="urn:wildlands:process:1"', body = (el: string, ext: string, perf = '') => `<bpmn:startEvent id="S"/><bpmn:${el} id="K">${ext}${perf}</bpmn:${el}><bpmn:endEvent id="E"/>${flow('A', 'S', 'K')}${flow('B', 'K', 'E')}`;
 for (const el of ['serviceTask', 'scriptTask', 'sendTask', 'receiveTask', 'businessRuleTask']) {
  const r = bpmn.import(foreign(body(el, '')), {autoSystemPool: false});
  assert(r.ok && r.definition, el + JSON.stringify(r.diagnostics)); assert.equal(r.definition.steps.find(s => s.id === 'k')!.kind, 'task');
  assert(r.warnings.some(w => w.includes(el + ' K imports as a timed task')), el);
 }
 const doc = (el: string, step: string, resKind = 'machine') => `<?xml version="1.0"?><bpmn:definitions ${M} ${WL} id="D"><bpmn:resource id="R"><bpmn:extensionElements><wl:resource id="r" capacity="1" costPerMinute="0" kind="${resKind}"/></bpmn:extensionElements></bpmn:resource><bpmn:process id="P" name="P">` +
  body(el, `<bpmn:extensionElements>${step}</bpmn:extensionElements>`, '<bpmn:performer id="PF"><bpmn:resourceRef>R</bpmn:resourceRef></bpmn:performer>') + '</bpmn:process></bpmn:definitions>';
 const ok = bpmn.import(doc('serviceTask', '<wl:step id="k" kind="system" duration="3" technology="API"/><wl:output field="done"/><wl:set name="done" type="boolean" value="true"/>', 'system'));
 assert(ok.ok && ok.definition, JSON.stringify(ok.diagnostics)); const k = ok.definition.steps.find(s => s.id === 'k')!;
 assert.equal(k.kind, 'system'); assert.equal(k.technology, 'API'); assert.deepEqual(k.outputs, [{field: 'done'}]); assert.equal(ok.definition.resources[0]!.kind, 'system'); assert.deepEqual(ok.warnings.filter(w => w.includes('K')), []);
 const mismatch = bpmn.import(doc('userTask', '<wl:step id="k" kind="machine" duration="3"/>', 'people'));
 assert.equal(mismatch.ok, false); assert(mismatch.diagnostics.length > 0);
 assert(mismatch.warnings.some(w => w.includes('userTask but its Wildlands extension says machine')), mismatch.warnings.join('|'));
 const wrongPool = bpmn.import(doc('serviceTask', '<wl:step id="k" kind="system" duration="3"/>', 'machine'));
 assert.equal(wrongPool.ok, false); assert(wrongPool.diagnostics.length > 0, JSON.stringify(wrongPool.diagnostics));
 const techOnTask = bpmn.import(doc('task', '<wl:step id="k" duration="3" technology="Robot"/>', 'people'));
 assert.equal(techOnTask.ok, false); assert(techOnTask.diagnostics.length > 0);
 const badKind = bpmn.import(doc('task', '<wl:step id="k" kind="robot" duration="3"/>', 'people'));
 assert.equal(badKind.ok, false); assert(badKind.diagnostics.length > 0);
});
const randomised = () => {
 const d = define([stepOf('start', 'start', 0), stepOf('work', 'task', 1, {duration: 6, timing: {dist: 'triangular', min: 2, mode: 5, max: 12}, resources: {crew: 1}, draws: [{field: 'defect', kind: 'chance', percent: 20, whenTrue: 'yes', whenFalse: 'no'}, {field: 'grade', kind: 'choice', values: [{value: 'a', weight: 3}, {value: 7, weight: 1}, {value: true, weight: 2}]}, {field: 'size', kind: 'int', min: 1, max: 9}]}),
  stepOf('wait', 'timer', 2, {duration: 10, timing: {dist: 'exponential', mean: 10, max: 60}}), stepOf('gate', 'decision', 3), stepOf('fix', 'task', 4, {duration: 3, timing: {dist: 'uniform', min: 1, max: 5}}), stepOf('end', 'end', 5)],
 [flowOf('start', 'work'), flowOf('work', 'wait'), flowOf('wait', 'gate'), {id: 'gate-fix', from: 'gate', to: 'fix', when: {chance: 15}}, {id: 'gate-end', from: 'gate', to: 'end'}, flowOf('fix', 'end')]);
 d.seed = 4242; d.resources = [{id: 'crew', name: 'Crew', capacity: 2, costPerMinute: 1}];
 d.arrivals = [{at: 0, count: 3, interval: 5, gap: {dist: 'exponential', mean: 5, max: 30}, draws: [{field: 'rush', kind: 'chance', percent: 50}], data: {}}, {at: 10, until: 300, interval: 20, data: {a: 1}}, {at: 5, open: true, interval: 15, gap: {dist: 'uniform', min: 5, max: 25}, data: {}}];
 return d;
};

test('BPMN round trip preserves seeds, random timing, draws, chance routes and open or until arrivals losslessly', () => {
 const d = randomised(), checked = catalog.validate(d, true); assert(checked.definition, JSON.stringify(checked.diagnostics));
 const xml = bpmn.export(d), back = bpmn.import(xml);
 assert(back.definition, JSON.stringify(back.diagnostics)); assert.deepEqual(back.warnings, []);
 assert.equal(catalog.fingerprint(back.definition), catalog.fingerprint(d)); assert.deepEqual(back.definition, checked.definition); assert.equal(bpmn.export(back.definition), xml);
 assert.match(xml, /<wl:process [^>]*seed="4242"/); assert.match(xml, /<wl:timing dist="triangular" min="2" mode="5" max="12"\/>/); assert.match(xml, /<wl:timing dist="exponential" max="60" mean="10"\/>/);
 assert.match(xml, /<wl:arrival at="0" count="3" interval="5">/); assert.match(xml, /<wl:arrival at="10" until="300" interval="20">/); assert.match(xml, /<wl:arrival at="5" open="true" interval="15">/);
 assert.doesNotMatch(xml, /count="undefined"/); assert.doesNotMatch(xml, /<wl:arrival at="10"[^>]*count=/);
 assert.match(xml, /<wl:when chance="15"\/>/); assert.match(xml, /language="urn:wildlands:process:1#chance">15%<\/bpmn:conditionExpression>/);
 const noDefault = xml.replace(/ seed="4242"/, ''); assert.equal(bpmn.import(noDefault).definition!.seed, undefined);
 // The expression alone carries a chance; the extension alone carries the exact value.
 const exprOnly = bpmn.import(xml.replace(/<wl:when chance="15"\/>/, '')).definition!, extOnly = bpmn.import(xml.replace(/<bpmn:conditionExpression[^>]*chance">15%<\/bpmn:conditionExpression>/, '')).definition!;
 assert.deepEqual(exprOnly.flows.find(f => f.id === 'gate-fix')!.when, {chance: 15}); assert.deepEqual(extOnly.flows.find(f => f.id === 'gate-fix')!.when, {chance: 15});
 const plain = define([stepOf('start', 'start', 0), stepOf('end', 'end', 1)], [flowOf('start', 'end')]);
 assert.equal(catalog.fingerprint(bpmn.import(bpmn.export(plain)).definition!), catalog.fingerprint(plain));
});

test('BPMN import rejects malformed random extensions with explicit diagnostics', () => {
 const xml = bpmn.export(randomised()), bad = (from: RegExp | string, to: string, message: RegExp) => assert.throws(() => bpmn.import(xml.replace(from, to)), message, String(from) + ' -> ' + to);
 bad(/seed="4242"/, 'seed="4.5"', /Process: seed "4\.5" must be a whole number/);
 bad(/dist="triangular"/, 'dist="weibull"', /dist "weibull" must be uniform, triangular, exponential, normal or erlang/);
 bad(/<wl:timing dist="triangular" min="2"/, '<wl:timing dist="triangular" min="x"', /min "x" must be a whole number/);
 bad(/<wl:timing dist="triangular" min="2"/, '<wl:timing speed="2" dist="triangular" min="2"', /unknown attribute speed/);
 bad(/<wl:timing dist="exponential"[^>]*\/>/, '$&<wl:timing dist="uniform" min="1" max="2"/>', /2 timing elements/);
 bad(/kind="chance" percent="20"/, 'kind="coin" percent="20"', /kind "coin" must be chance, choice or int/);
 bad(/<wl:choice weight="3"/, '<wl:choice ', /choice needs a weight/);
 bad(/<wl:choice weight="3"/, '<wl:choice weight="1.5"', /weight "1\.5" must be a whole number/);
 bad(/<wl:whenTrue [^>]*\/>/, '<wl:whenTrue type="string" value="a"/><wl:whenTrue type="string" value="b"/>', /2 whenTrue elements/);
 bad(/<wl:when chance="15"\/>/, '<wl:when chance="15.5"/>', /chance "15\.5" must be a whole number/);
 bad(/<wl:when chance="15"\/>/, '<wl:when chance="20"/>', /chance extension 20 disagrees with expression 15%/);
 bad(/>15%</, '>fifteen%<', /chance expression "fifteen%" must be a whole percent such as 15%/);
 bad(/<wl:when chance="15"\/>/, '<wl:when chance="15" field="a" op="eq" type="number" value="1"/>', /unknown attribute field/);
 bad(/(<bpmn:conditionExpression[^>]*chance">15%<\/bpmn:conditionExpression>)/, '$1<bpmn:conditionExpression>a == 1</bpmn:conditionExpression>', /2 conditionExpression elements/);
 bad(/ language="urn:wildlands:process:1#chance"/, '', /cannot also carry the field condition "15%"|chance route/);
 bad(/<wl:arrival at="10" until="300"/, '<wl:arrival at="10" until="300" count="2"', /Arrival 2: declare exactly one of count, until or open \(found 2\)/);
 bad(/<wl:arrival at="10" until="300" interval="20"/, '<wl:arrival at="10" interval="20"', /Arrival 2: declare exactly one of count, until or open \(found 0\)/);
 bad(/open="true"/, 'open="yes"', /open "yes" must be true or absent/);
 bad(/<wl:arrival at="10"/, '<wl:arrival bogus="1" at="10"', /unknown attribute bogus/);
 bad(/<wl:gap dist="exponential"[^>]*\/>/, '$&<wl:gap dist="uniform" min="1" max="2"/>', /2 gap elements/);
 // Chance only belongs after an exclusive gateway.
 const wrongSource = foreign(`<bpmn:startEvent id="S"/><bpmn:task id="K"/><bpmn:endEvent id="E"/>${flow('A', 'S', 'K')}${flow('B', 'K', 'E', '<bpmn:conditionExpression language="urn:wildlands:process:1#chance">10%</bpmn:conditionExpression>')}`);
 assert.throws(() => bpmn.import(wrongSource), /chance route but leaves K, which is not an exclusive gateway/);
 // Range errors are the engine validator's, returned as diagnostics rather than repaired.
 const range = bpmn.import(xml.replace(/<wl:when chance="15"\/>/, '<wl:when chance="150"/>').replace(/>15%</, '>150%<'));
 assert.equal(range.ok, false); assert(range.diagnostics.length > 0);
});
const journey = () => {
 const d = define([stepOf('start', 'start', 0, {phase: 'Awareness', emotion: 0}), stepOf('ad', 'touchpoint', 1, {duration: 2, channel: 'ads', phase: 'Awareness', emotion: 1, pain: 'Too "loud" & vague', opportunity: 'Clearer <offer>', set: {seen: true}}),
  stepOf('shop', 'touchpoint', 2, {duration: 4, channel: 'web', phase: 'Consider', emotion: -2, resources: {agent: 1}, add: {mood: -1}, outputs: [{field: 'mood'}]}), stepOf('visit', 'touchpoint', 3, {duration: 3, channel: 'store', emotion: 3}),
  stepOf('gate', 'decision', 4, {phase: 'Decide', pain: 'Price shock'}), stepOf('buy', 'end', 5, {outcome: 'goal', emotion: 2, phase: 'Purchase'}), stepOf('leave', 'end', 6, {outcome: 'lost', emotion: -3, opportunity: 'Win back'})],
 [flowOf('start', 'ad'), flowOf('ad', 'shop'), flowOf('shop', 'visit'), flowOf('visit', 'gate'), {id: 'gate-leave', from: 'gate', to: 'leave', when: {chance: 30}}, {id: 'gate-buy', from: 'gate', to: 'buy'}], {mood: 0});
 d.genre = 'customer-journey'; d.track = [{field: 'mood', label: 'Mood'}, {field: 'seen'}]; d.resources = [{id: 'agent', name: 'Agent', capacity: 1, costPerMinute: 1}];
 return d;
};

test('BPMN round trip preserves journey genre, touchpoints, channels, phases, emotions, outcomes and tracked fields losslessly', () => {
 const d = journey(), checked = catalog.validate(d, true); assert(checked.definition, JSON.stringify(checked.diagnostics));
 const xml = bpmn.export(d), back = bpmn.import(xml);
 assert(back.ok && back.definition, JSON.stringify(back.diagnostics)); assert.deepEqual(back.warnings, []);
 assert.equal(catalog.fingerprint(back.definition), catalog.fingerprint(d)); assert.deepEqual(back.definition, checked.definition); assert.equal(bpmn.export(back.definition), xml);
 assert.match(xml, /<bpmn:userTask id="Activity_shop"/); assert.doesNotMatch(xml, /Gateway_shop|Gateway_ad/); assert.match(xml, /<bpmn:endEvent id="EndEvent_buy"/);
 assert.match(xml, /<wl:step id="ad" kind="touchpoint"[^>]*channel="ads"/); assert.match(xml, /<wl:step id="buy"[^>]*outcome="goal"/); assert.match(xml, /emotion="-2"/);
 assert.match(xml, /<wl:process [^>]*genre="customer-journey"/); assert.match(xml, /<wl:track field="mood" label="Mood"\/>/); assert.match(xml, /<wl:track field="seen"\/>/);
 for (const genre of ['process', 'user-journey'] as const) { const g = {...d, genre}; assert.equal(catalog.fingerprint(bpmn.import(bpmn.export(g)).definition!), catalog.fingerprint(g)); }
 const plain = define([stepOf('start', 'start', 0), stepOf('t', 'task', 1, {duration: 2}), stepOf('end', 'end', 2)], [flowOf('start', 't'), flowOf('t', 'end')]);
 const plainBack = bpmn.import(bpmn.export(plain)).definition!; assert.equal(plainBack.genre, undefined); assert.equal(plainBack.track, undefined);
 const foreignUser = bpmn.import(foreign(`<bpmn:startEvent id="S"/><bpmn:userTask id="U"/><bpmn:endEvent id="E"/>${flow('A', 'S', 'U')}${flow('B', 'U', 'E')}`));
 assert.equal(foreignUser.definition!.steps.find(s => s.id === 'u')!.kind, 'task');
});

test('BPMN import rejects malformed journey extensions with explicit diagnostics', () => {
 const xml = bpmn.export(journey()), bad = (from: RegExp | string, to: string, message: RegExp) => assert.throws(() => bpmn.import(xml.replace(from, to)), message, String(from) + ' -> ' + to);
 bad(/channel="ads"/, 'channel="fax"', /Step StartEvent_start|Step Activity_ad: channel "fax" must be web, mobile/);
 bad(/outcome="goal"/, 'outcome="won"', /outcome "won" must be goal or lost/);
 bad(/emotion="-2"/, 'emotion="4"', /emotion "4" must be between -3 and 3/);
 bad(/emotion="-2"/, 'emotion="-4"', /must be between -3 and 3/);
 bad(/emotion="-2"/, 'emotion="1.5"', /emotion "1\.5" must be a whole number/);
 bad(/genre="customer-journey"/, 'genre="saga"', /genre "saga" must be process, customer-journey, user-journey/);
 bad(/<wl:track field="seen"\/>/, '<wl:track field="mood"/>', /duplicate field mood/);
 bad(/<wl:track field="seen"\/>/, '<wl:track label="x"/>', /Track 2: field is required/);
 bad(/<wl:track field="seen"\/>/, '<wl:track field="seen" colour="red"/>', /unknown attribute colour/);
 // Kind and element must agree; the extension wins and engine admission judges the rest.
 const mismatch = bpmn.import(xml.replace('<bpmn:userTask id="Activity_ad"', '<bpmn:task id="Activity_ad"').replace('</bpmn:userTask>', '</bpmn:task>'));
 assert(mismatch.warnings.some(w => w.includes('task but its Wildlands extension says touchpoint')), mismatch.warnings.join('|'));
 // Engine rules for applicability stay diagnostics, never repaired.
 const wrongKind = bpmn.import(xml.replace(/<wl:step id="ad" kind="touchpoint"/, '<wl:step id="ad"'));
 assert.equal(wrongKind.ok, false); assert(wrongKind.diagnostics.length > 0);
 const outcomeOnTask = bpmn.import(xml.replace('<wl:step id="gate"', '<wl:step id="gate" outcome="goal"'));
 assert.equal(outcomeOnTask.ok, false); assert(outcomeOnTask.diagnostics.length > 0);
});
const sipocDef = () => {
 const d = define([stepOf('start', 'start', 0), stepOf('t', 'task', 1, {duration: 2}), stepOf('end', 'end', 2)], [flowOf('start', 't'), flowOf('t', 'end')]);
 d.sipoc = {suppliers: [{name: 'Zeta Mills', supplies: 'Flour & "yeast" <bulk>'}, {name: 'Alpha Farm'}], customers: [{name: 'Walk-in guest', receives: 'Fresh bread'}, {name: 'Cafe'}]};
 return d;
};

test('BPMN round trip preserves the SIPOC suppliers and customers losslessly', () => {
 const d = sipocDef(), checked = catalog.validate(d, true); assert(checked.definition, JSON.stringify(checked.diagnostics));
 const xml = bpmn.export(d), back = bpmn.import(xml);
 assert(back.ok && back.definition, JSON.stringify(back.diagnostics)); assert.deepEqual(back.warnings, []);
 assert.equal(catalog.fingerprint(back.definition), catalog.fingerprint(d)); assert.deepEqual(back.definition.sipoc, d.sipoc); assert.equal(bpmn.export(back.definition), xml);
 assert.match(xml, /<wl:supplier name="Zeta Mills" supplies="Flour &amp; &quot;yeast&quot; &lt;bulk&gt;"\/>/); assert.match(xml, /<wl:customer name="Cafe"\/>/);
 assert(xml.indexOf('Zeta Mills') < xml.indexOf('Alpha Farm'));
 const one = {...d, sipoc: {customers: [{name: 'Only', receives: 'x'}]}}, oneBack = bpmn.import(bpmn.export(one)).definition!;
 assert.equal(catalog.fingerprint(oneBack), catalog.fingerprint(one)); assert.equal(oneBack.sipoc!.suppliers, undefined);
 const plain = {...d}; delete plain.sipoc; assert.equal(bpmn.import(bpmn.export(plain)).definition!.sipoc, undefined);
});

test('BPMN import rejects malformed SIPOC extensions with explicit diagnostics', () => {
 const xml = bpmn.export(sipocDef()), bad = (from: RegExp | string, to: string, message: RegExp) => assert.throws(() => bpmn.import(xml.replace(from, to)), message, String(from) + ' -> ' + to);
 bad(/<wl:supplier name="Alpha Farm"\/>/, '<wl:supplier name="Alpha Farm" colour="red"/>', /Supplier 2: unknown attribute colour/);
 bad(/<wl:customer name="Cafe"\/>/, '<wl:customer name="Cafe" supplies="x"/>', /Customer 2: unknown attribute supplies/);
 bad(/<wl:supplier name="Alpha Farm"\/>/, '<wl:supplier name="Alpha Farm"><wl:note/></wl:supplier>', /Supplier 2: unknown element note/);
 bad(/<wl:supplier name="Alpha Farm"\/>/, '<wl:supplier supplies="x"/>', /Supplier 2: name is required/);
 bad(/<wl:supplier name="Alpha Farm"\/>/, '<wl:supplier name="Zeta Mills"/>', /Supplier 2: duplicate supplier name Zeta Mills/);
 bad(/<wl:customer name="Cafe"\/>/, '<wl:customer name="Walk-in guest"/>', /Customer 2: duplicate customer name Walk-in guest/);
 bad(/<wl:supplier name="Alpha Farm"\/>/, '<wl:supplier name="' + 'n'.repeat(61) + '"/>', /Supplier 2: name must be at most 60 characters/);
 bad(/<wl:customer name="Cafe"\/>/, '<wl:customer name="Cafe" receives="' + 'r'.repeat(161) + '"/>', /Customer 2: receives must be 1 to 160 characters/);
 bad(/<wl:customer name="Cafe"\/>/, '<wl:customer name="Cafe" receives=""/>', /Customer 2: receives must be 1 to 160 characters/);
 const nine = Array.from({length: 7}, (_, n) => '<wl:supplier name="S' + n + '"/>').join('');
 bad(/<wl:supplier name="Alpha Farm"\/>/, '<wl:supplier name="Alpha Farm"/>' + nine, /at most 8 suppliers are allowed; found 9/);
});

test('BPMN import rejects unknown or invalid Wildlands extension attributes, elements and values instead of coercing them', () => {
 const d = define([stepOf('start', 'start', 0), stepOf('t', 'task', 1, {duration: 3, resources: {crew: 1}, set: {done: true}, instances: {count: 3, mode: 'sequential'}, deadline: {after: 5, mode: 'escalate', flow: 'late'}}),
  stepOf('gate', 'decision', 2), stepOf('end', 'end', 3), stepOf('alert', 'task', 2, {duration: 1}), stepOf('end2', 'end', 3)],
 [flowOf('start', 't'), flowOf('t', 'gate'), flowOf('gate', 'end', cond({field: 'x', op: 'eq', value: 1})), {id: 'gate-end-b', from: 'gate', to: 'end'}, {id: 'late', from: 't', to: 'alert', on: 'deadline'}, flowOf('alert', 'end2')], {x: 1});
 d.resources = [{id: 'crew', name: 'Crew', capacity: 2, costPerMinute: 1}];
 const xml = bpmn.export(d), back = bpmn.analyze(xml); assert(back.ok, JSON.stringify(back.rejections)); assert.equal(catalog.fingerprint(back.definition!), catalog.fingerprint(d));
 const bad = (from: string, to: string, message: RegExp) => {
  assert(xml.includes(from), from); const r = bpmn.analyze(xml.replace(from, to));
  assert.equal(r.definition, undefined, to); assert.match(r.rejections.map(x => x.message).join('\n'), message, to);
 };
 bad('mode="escalate"', 'mode="esclate"', /Deadline Boundary_t: mode "esclate" must be interrupt or escalate\./);
 bad('<wl:deadline mode="escalate"', '<wl:deadline bogus="1" mode="escalate"', /Deadline Boundary_t deadline: unknown attribute bogus\./);
 bad('mode="sequential"', 'mode="sequental"', /Step Activity_t instances: mode "sequental" must be parallel or sequential\./);
 bad('<wl:instances count="3"', '<wl:instances size="2" count="3"', /Step Activity_t instances: unknown attribute size\./);
 bad('<wl:when field="x" op="eq"', '<wl:when colour="red" field="x" op="eq"', /Flow Flow_gate-end: unknown attribute colour\./);
 bad('<wl:when field="x" op="eq"', '<wl:when field="x" op="equals"', /Flow Flow_gate-end: op "equals" must be eq or ne or gt or gte or lt or lte\./);
 bad('op="eq" type="number" value="1"', 'op="eq" type="integer" value="1"', /Value type "integer" must be string, number, boolean or null\./);
 bad('type="boolean" value="true"', 'type="boolean" value="yes"', /A boolean value must be true or false, not "yes"\./);
 bad('<wl:step id="t"', '<wl:step colour="red" id="t"', /Step Activity_t step: unknown attribute colour\./);
 bad('<wl:step id="t" duration="3"/>', '<wl:step id="t" duration="3.5"/>', /Step Activity_t: duration "3.5" must be a whole number\./);
 bad('<wl:scene id="scene-t"', '<wl:widget/><wl:scene id="scene-t"', /Step Activity_t: unknown Wildlands element widget\./);
 bad('<wl:scene id="scene-t" x="12"', '<wl:scene id="scene-t" x="twelve"', /Step Activity_t scene: x "twelve" must be a number\./);
 bad('<wl:set name="done" type="boolean" value="true"/>', '<wl:set name="done" type="boolean" value="true"><wl:note/></wl:set>', /Step Activity_t set: unknown element note\./);
 bad('<wl:demand quantity="1"/>', '<wl:demand quantity="1" share="2"/>', /Step Activity_t performer demand: unknown attribute share\./);
 bad('<wl:resource id="crew" capacity="2"', '<wl:resource id="crew" kind="robot" capacity="2"', /Resource Resource_crew: kind "robot" must be people or machine or system\./);
 bad('<wl:flow id="late"/>', '<wl:flow id="late" on="deadline"/>', /Flow Flow_late flow: unknown attribute on\./);
 bad('<wl:lane resource="crew"/>', '<wl:lane resource="crew" colour="red"/>', /Lane Lane_crew lane: unknown attribute colour\./);
 bad('<wl:process id="timed" revision="0"/>', '<wl:process id="timed" revision="0" owner="x"/>', /Process process: unknown attribute owner\./);
 bad('<wl:data name="x" type="number" value="1"/>', '<wl:data name="x" type="number" value="1" unit="m"/>', /Arrival 1 data: unknown attribute unit\./);
 bad('<wl:process id="timed" revision="0"/>', '<wl:process id="timed" revision="0" empty="steps"/>', /Process: empty "steps" must name one of track, sipoc, suppliers, customers\./);
});

test('BPMN export keeps descriptions and empty containers exactly, writes only safe standard expressions and refuses text XML cannot carry', () => {
 const d = define([stepOf('start', 'start', 0), stepOf('t', 'task', 1, {duration: 2, description: '', set: {}, needs: [], resources: {}, outputs: [], draws: []}), stepOf('gate', 'decision', 2), stepOf('end', 'end', 3)],
  [flowOf('start', 't'), flowOf('t', 'gate'), flowOf('gate', 'end', cond({field: 'note', op: 'eq', value: 'it\'s "x"'})), {id: 'gate-end-b', from: 'gate', to: 'end'}], {note: 'a'});
 Object.assign(d, {description: '  padded\nline\twith tab\r\n', track: [], sipoc: {suppliers: []}}); d.arrivals[0]!.draws = []; d.steps[3]!.description = 'Tab\tand quotes \'"';
 const xml = bpmn.export(d), back = bpmn.analyze(xml); assert(back.ok && !back.warnings.length, JSON.stringify([back.warnings, back.diagnostics]));
 assert.deepEqual(back.definition, d); assert.equal(catalog.fingerprint(back.definition!), catalog.fingerprint(d)); assert.equal(bpmn.export(back.definition!), xml);
 assert.match(xml, /<wl:step id="t" duration="2" empty="set resources needs outputs draws"\/>/); assert.match(xml, /<wl:process id="timed" revision="0" empty="track suppliers"\/>/); assert.match(xml, /<wl:arrival [^>]*empty="draws">/);
 // A carriage return in text and tabs or line breaks in attributes travel as references, so a conforming reader cannot normalise them away.
 assert(xml.includes('<bpmn:documentation>  padded\nline\twith tab&#13;\n</bpmn:documentation>')); assert(xml.includes('<bpmn:documentation></bpmn:documentation>'));
 const named = bpmn.export({...d, name: 'Two\nlines\tand\rreturn'}); assert(named.includes('name="Two&#10;lines&#9;and&#13;return"')); assert.equal(bpmn.import(named).definition!.name, 'Two\nlines\tand\rreturn');
 // Text holding both quote kinds has no standard expression (the extension carries it); one quote kind uses the other as delimiter.
 assert.doesNotMatch(xml, /conditionExpression[^>]*>\$\{note/);
 const quoted = (value: string) => /<bpmn:conditionExpression[^>]*>([^<]*)</.exec(bpmn.export({...d, flows: d.flows.map(f => f.id === 'gate-end' ? {...f, when: cond({field: 'note', op: 'eq', value})} : f)}))?.[1];
 assert.equal(quoted("it's"), '${note == "it\'s"}'); assert.equal(quoted('say "hi"'), '${note == \'say "hi"\'}');
 // A field named like a literal, an operator word or and/or/not gets no expression; the extension stays exact and nothing disagrees.
 for (const field of ['and', 'or', 'not', 'eq', 'gte', 'le', 'true', 'null']) {
  const words = {...d, flows: d.flows.map(f => f.id === 'gate-end' ? {...f, when: cond({field, op: 'eq', value: 1})} : f), arrivals: [{at: 0, count: 1, interval: 0, data: {[field]: 1}}]};
  const out = bpmn.export(words), again = bpmn.analyze(out); assert.doesNotMatch(out, /<bpmn:conditionExpression/, field); assert(again.ok && !again.warnings.length, field); assert.equal(catalog.fingerprint(again.definition!), catalog.fingerprint(words), field);
 }
 const other = {...d, flows: d.flows.map(f => f.id === 'gate-end' ? {...f, when: cond({field: 'note', op: 'eq', valueField: 'or'})} : f)}; assert.doesNotMatch(bpmn.export(other), /<bpmn:conditionExpression/);
 // C0 control characters other than tab, line feed and carriage return cannot be written as XML 1.0 at all: export refuses them by name.
 for (const ch of ['\u0001', '\u001f', '\u000b']) assert.throws(() => bpmn.export({...d, steps: d.steps.map(s => s.id === 'gate' ? {...s, name: 'Gate' + ch + 'one'} : s)}), /contains the character U\+00(01|1F|0B), which XML 1\.0 cannot represent; remove it before exporting\./);
 assert.throws(() => bpmn.export({...d, description: 'lone \ud800 surrogate'}), /U\+D800/);
});
