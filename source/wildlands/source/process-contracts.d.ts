/** Versioned process data and command/query ports; no browser or persistence authority. */
declare namespace LWProcess {
 type Scalar = string | number | boolean | null;
 type Fields = Record<string, Scalar>;
 type Kind = 'start' | 'task' | 'timer' | 'decision' | 'fork' | 'join' | 'end';
 interface Scene { id: string; position: [number, number]; color: string; asset?: unknown; }
 /** A value a step requires before it can run. `op` and `value` come together; without them the field only has to be delivered. */
 interface Need { field: string; op?: Condition['op']; value?: Scalar; label?: string; }
 /** A bounded store of waiting work at a task or join. `pull` (joins only) limits work in the next task before more is released. */
 interface Backlog { capacity: number; order?: 'fifo' | 'lifo' | 'priority'; priority?: string; pull?: number; }
 interface Step {
  id: string; name: string; kind: Kind; scene: Scene; description?: string;
  duration?: number; until?: number; cost?: number; resources?: Record<string, number>; set?: Fields; add?: Record<string, number>; join?: string; needs?: Need[]; backlog?: Backlog;
 }
 /** Compares a case field to `value`, or to another case field named by `valueField` (exactly one; `value` is then absent at runtime). */
 interface Condition { field: string; op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte'; value: Scalar; valueField?: string; }
 interface Flow { id: string; from: string; to: string; label?: string; when?: Condition; }
 interface Resource { id: string; name: string; capacity: number; costPerMinute: number; }
 interface Arrival { at: number; count: number; interval: number; data: Fields; }
 interface Definition {
  $schema?: string; format: 'wildlands-process'; schemaVersion: 1; revision: number;
  id: string; name: string; description?: string; start: string;
  resources: Resource[]; steps: Step[]; flows: Flow[]; arrivals: Arrival[];
 }
 interface Diagnostic { path: string; code: string; message: string; }
 /** `ok` is strict: structurally valid and no diagnostics. `acceptable` is true when a definition was produced and a draft may be kept despite graph diagnostics. */
 interface Validation { ok: boolean; acceptable: boolean; diagnostics: Diagnostic[]; definition?: Definition; }
 interface Catalog {
  schema: Record<string, unknown>; validate(input: unknown, draft?: boolean): Validation;
  admit(input: unknown): Definition; fingerprint(input: unknown): string;
 }
 interface Case extends Record<string, unknown> {
  id: string; input: Fields; data: Fields; entered: number; finished: number | null;
  status: 'active' | 'completed' | 'failed'; transitions: number; error: string | null;
 }
 interface Token extends Record<string, unknown> {
  id: string; caseId: string; stepId: string; entered: number; started: number | null;
  input: Fields | null; remaining: number; status: 'routing' | 'queued' | 'active' | 'joining' | 'backlog' | 'held' | 'timer';
  fork: string | null; branch: string | null; target?: string; due?: number;
 }
 /** `waiting` timer tokens at a step and the earliest minute one is due (`null` when none wait). */
 interface TimerMetric { waiting: number; nextDue: number | null; }
 interface StepMetric { id: string; queued: number; active: number; timers: TimerMetric; visits: number; completed: number; waitMinutes: number; }
 interface PoolMetric { id: string; capacity: number; busy: number; busyMinutes: number; utilization: number; }
 interface Event { minute: number; kind: string; caseId: string; stepId: string; detail: string; }
 interface Receipt {
  id: string; caseId: string; stepId: string; started: number; finished: number;
  input: Fields; output: Fields; changes: Fields;
 }
 interface Snapshot {
  minute: number; status: 'ready' | 'running' | 'completed' | 'blocked' | 'limit';
  cases: Case[]; tokens: Token[]; receipts: Receipt[]; receiptsDropped: number; steps: StepMetric[]; resources: PoolMetric[]; events: Event[];
  metrics: { arrived: number; completed: number; failed: number; active: number; cost: number; meanCycleMinutes: number; throughputPerHour: number; };
 }
 /** `horizon` is the total run length in minutes; `null` means no clock limit (the run still ends when no work remains or can advance). */
 interface Session { query(): Snapshot; advance(minutes: number): Snapshot; horizon(): number | null; setHorizon(value: number | null): void; dispose(): void; }
 interface Limits { readonly cases: number; readonly minutes: number; readonly transitions: number; readonly events: number; readonly receipts: number; }
 interface Runtime { create(input: unknown, options?: {horizon?: number | null}): Session; limits: Limits; }
 interface Recipe {
  expectedRevision: number; expectedFingerprint: string;
  operations: ({op: 'putStep'; value: Step} | {op: 'putFlow'; value: Flow} | {op: 'putResource'; value: Resource} |
   {op: 'removeStep' | 'removeFlow' | 'removeResource'; id: string} |
   {op: 'setArrivals'; value: Arrival[]} | {op: 'setStart'; value: string} | {op: 'rename'; value: string})[];
 }
 interface Authoring {
  create(id: string, name: string): Definition;
  edit(input: unknown, recipe: unknown, draft?: boolean): {definition: Definition; fingerprint: string; diagnostics: Diagnostic[]};
  scenes(input: unknown): {id: string; stepId: string; name: string; position: [number, number]; connections: string[]}[];
 }
 interface EcsWorld {
  create(id: string): string; destroy(id: string): boolean;
  set<T extends Record<string, unknown>>(id: string, type: string, data: T): T;
  get<T extends Record<string, unknown>>(id: string, type: string): T | undefined;
  query(types: readonly string[]): string[];
 }
 interface Ecs { World: new () => EcsWorld; Scheduler: new () => {
  register(spec: {id: string; phase: 'pre' | 'simulate' | 'post'; order: number; query: readonly string[]; update: (world: EcsWorld, id: string, dt: number) => void}): unknown;
  step(world: EcsWorld, dt: number): void;
 }; }
}
declare namespace LWProcess {
 interface Clock extends Record<string, unknown> { minute: number; serial: number; forkSerial: number; arrival: number; cost: number; }
 interface Pool extends Record<string, unknown> { id: string; capacity: number; busy: number; busyMinutes: number; costPerMinute: number; }
 interface Station extends Record<string, unknown> { id: string; visits: number; completed: number; waitMinutes: number; }
 interface State {
  world: EcsWorld; definition: Definition; steps: Map<string, Step>; outgoing: Map<string, Flow[]>;
  clock: Clock; events: Event[]; receipts: Receipt[]; receiptsDropped: number; arrivals: {at: number; data: Fields}[];
  /** Clock-step failures recorded while the scheduler is locked; the next settle applies them. */
  failures: {caseId: string; message: string}[];
 }
 interface Systems { settle(s: State): void; work(s: State): void; admit(s: State): void; }
}
