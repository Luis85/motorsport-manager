/// <reference path="./process-contracts.d.ts" />
/** Public Node ports; no game installer and no ambient process definition. */
require('./ecs.js');
require('./asset-catalog.js');
require('./process-schema.js');
require('./process-needs.js');
require('./process-graph.js');
require('./process-catalog.js');
require('./process-systems.js');
require('./process-session.js');
require('./process-authoring.js');
const root = globalThis as unknown as {LWProcessCatalog: LWProcess.Catalog; LWProcessRuntime: LWProcess.Runtime; LWProcessAuthoring: LWProcess.Authoring};
export const catalog = root.LWProcessCatalog;
export const runtime = root.LWProcessRuntime;
export const authoring = root.LWProcessAuthoring;
