/// <reference path="./process-contracts.d.ts" />
/// <reference path="./process-slides-contracts.d.ts" />
/// <reference path="./process-diff.ts" />
/** Public Node ports; no game installer and no ambient process definition. */
require('./ecs.js');
require('./asset-catalog.js');
require('./process-schema.js');
require('./process-random.js');
require('./process-needs.js');
require('./process-graph.js');
require('./process-catalog.js');
require('./process-xml.js');
require('./process-bpmn-expr.js');
require('./process-bpmn.js');
require('./process-bpmn-bpsim-write.js');
require('./process-bpmn-ext.js');
require('./process-bpmn-bpsim.js');
require('./process-bpmn-graph.js');
require('./process-bpmn-flow.js');
require('./process-bpmn-tail.js');
require('./process-bpmn-assemble.js');
require('./process-bpmn-import.js');
require('./process-bpmn-conformance-values.js');
require('./process-bpmn-conformance-model.js');
require('./process-bpmn-conformance-bpsim.js');
require('./process-bpmn-conformance.js');
require('./process-systems.js');
require('./process-session.js');
require('./process-authoring.js');
require('./process-diff.js');
require('./process-route.js');
require('./process-sipoc-model.js');
require('./process-random-view.js');
require('./process-terms.js');
require('./process-slides-text.js');
require('./process-slides.js');
const root = globalThis as unknown as {LWProcessCatalog: LWProcess.Catalog; LWProcessRuntime: LWProcess.Runtime; LWProcessAuthoring: LWProcess.Authoring; LWProcessBpmn: LWProcessBpmn.Api; LWProcessBpmnConformance: LWProcessBpmnConformance.Api;
 LWProcessSlides: LWProcessSlides.Api; LWProcessDiff: LWProcessDiff.Api};
export const catalog = root.LWProcessCatalog;
export const runtime = root.LWProcessRuntime;
export const authoring = root.LWProcessAuthoring;
export const bpmn = root.LWProcessBpmn;
export const conformance = root.LWProcessBpmnConformance;
export const slides = root.LWProcessSlides;
export const diff = root.LWProcessDiff;
