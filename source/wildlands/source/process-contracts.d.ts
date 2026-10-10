/** Versioned process data and command/query ports; no browser or persistence authority. */
declare namespace LWProcess {
 type Scalar = string | number | boolean | null;
 type Fields = Record<string, Scalar>;
 type ResourceKind = 'people' | 'machine' | 'system';
 type Kind = 'start' | 'task' | 'touchpoint' | 'machine' | 'system' | 'timer' | 'decision' | 'fork' | 'join' | 'end';
 type Genre = 'process' | 'customer-journey' | 'user-journey';
 type Channel = 'web' | 'mobile' | 'store' | 'phone' | 'chat' | 'email' | 'social' | 'ads' | 'delivery' | 'document';
 /** A case field summarized by the run (mean/min/max at case finish, mean at every step entry); `label` defaults to the field name. */
 interface Track { field: string; label?: string; }
 /** A named external party of the SIPOC view; `supplies` (suppliers) or `receives` (customers) says what changes hands. Descriptive only. */
 interface Party { name: string; supplies?: string; receives?: string; }
 /** Authored SIPOC parties; inputs, process, outputs and measures are derived by views. No runtime effect. */
 interface Sipoc { suppliers?: Party[]; customers?: Party[]; }
 interface Scene { id: string; position: [number, number]; color: string; asset?: unknown; }
 /** A value a step requires before it can run. `op` and `value` come together; without them the field only has to be delivered. */
 interface Need { field: string; op?: Op; value?: Scalar; label?: string; }
 /** A bounded store of waiting work at a task or join. `pull` (joins only) limits work in the next task before more is released. */
 /** A declared result field of a working step (task, touchpoint, machine or system); an interface declaration only. */
 interface Output { field: string; label?: string; }
 interface Backlog { capacity: number; order?: 'fifo' | 'lifo' | 'priority'; priority?: string; pull?: number; }
 interface Step {
  id: string; name: string; kind: Kind; scene: Scene; description?: string;
  duration?: number; until?: number; cost?: number; resources?: Record<string, number>; set?: Fields; add?: Record<string, number>; join?: string; needs?: Need[]; backlog?: Backlog;
  /** Forks only: `inclusive` activates every outgoing flow whose condition holds (default flow otherwise); absent means parallel. */
  mode?: 'inclusive';
  /** Work steps only: run several items of this step; the step completes once when all are done. */
  instances?: Instances;
  /** Work steps only: a boundary timer that interrupts the work or escalates beside it. */
  deadline?: Deadline;
  /** Display-only equipment or software label; machine and system steps only. */
  technology?: string; outputs?: Output[];
  /** Realized-duration distribution drawn when work starts (timer: on arrival); `duration` stays the planning/mean value. Not allowed on `until` timers. */
  timing?: Dist;
  /** Display and analysis annotations, allowed on any step kind: journey stage or process milestone, expected feeling -3..3, a friction note and an improvement note. */
  phase?: string; emotion?: number; pain?: string; opportunity?: string;
  /** Touchpoints only: the interaction channel. `outcome` applies to end steps only: the case reached its goal or was lost. */
  channel?: Channel; outcome?: 'goal' | 'lost';
  /** Random case fields written at completion after `set` and before `add`. */
  draws?: Draw[];
 }
 /** `count` (2..50) or `field` (a case field holding 1..50 when the step is entered): exactly one; items run `parallel` or one after another (`sequential`). */
 interface Instances { count?: number; field?: string; mode: 'parallel' | 'sequential'; }
 /** Fires `after` minutes (or a drawn `timing`) after work started; `flow` names the flow with `on: 'deadline'` leaving the step. */
 interface Deadline { after?: number; timing?: Dist; mode: 'interrupt' | 'escalate'; flow: string; }
 /** An integer distribution of minutes: uniform {min,max}, triangular {min,mode,max}, exponential {mean,max?}, normal {mean,sd,min?,max?} or erlang {k,mean}. */
 interface Dist { dist: 'uniform' | 'triangular' | 'exponential' | 'normal' | 'erlang'; min?: number; mode?: number; max?: number; mean?: number; sd?: number; k?: number; }
 /** A random case field: `chance` {percent, whenTrue?, whenFalse?}, `choice` {values:[{value,weight}]} or `int` {min,max}. */
 interface Draw {
  field: string; kind: 'chance' | 'choice' | 'int'; percent?: number; whenTrue?: Scalar; whenFalse?: Scalar;
  values?: {value: Scalar; weight: number}[]; min?: number; max?: number;
 }
 type Op = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte';
 /** Compares a case field to a literal `value`. */
 interface ValueCondition { field: string; op: Op; value: Scalar; valueField?: undefined; chance?: undefined; all?: undefined; any?: undefined; not?: undefined; }
 /** Compares a case field to another case field named by `valueField`. */
 interface FieldCondition { field: string; op: Op; valueField: string; value?: undefined; chance?: undefined; all?: undefined; any?: undefined; not?: undefined; }
 /**
  * A comparison leaf: exactly one of `value` and `valueField`. `field !== undefined` narrows a `When` to it (every other form declares
  * `field?: undefined`), and `valueField !== undefined` then tells the two forms apart, so no cast is needed.
  */
 type Condition = ValueCondition | FieldCondition;
 /** A route taken by a keyed random draw (flow id, case, visit) below `chance` percent; decision flows only. */
 interface ChanceCondition { chance: number; field?: undefined; op?: undefined; value?: undefined; valueField?: undefined; all?: undefined; any?: undefined; not?: undefined; }
 /** Combinators: `all` (and), `any` (or) of 1..8 conditions, `not` of one. At most 3 levels and 8 leaves per `when`; exactly one form per node. */
 interface AllCondition { all: When[]; any?: undefined; not?: undefined; field?: undefined; op?: undefined; value?: undefined; valueField?: undefined; chance?: undefined; }
 interface AnyCondition { any: When[]; all?: undefined; not?: undefined; field?: undefined; op?: undefined; value?: undefined; valueField?: undefined; chance?: undefined; }
 interface NotCondition { not: When; all?: undefined; any?: undefined; field?: undefined; op?: undefined; value?: undefined; valueField?: undefined; chance?: undefined; }
 type When = Condition | ChanceCondition | AllCondition | AnyCondition | NotCondition;
 /** `on: 'deadline'` marks the single extra flow of a step with a `deadline`; it is not the step's normal outgoing flow. `when` applies to flows leaving decisions and inclusive forks. */
 interface Flow { id: string; from: string; to: string; label?: string; when?: When; on?: 'deadline'; }
 interface Resource { id: string; name: string; capacity: number; costPerMinute: number; kind?: ResourceKind; }
 /** Exactly one end rule: `count` (1..200), `until` (absolute minute) or `open: true`. `interval` is the spacing, or the planning mean when `gap` draws it. */
 interface Arrival { at: number; count?: number; until?: number; open?: true; interval: number; gap?: Dist; draws?: Draw[]; data: Fields; }
 /** Business minutes per working day (1..1440) and working days per week (1..7), for display only. */
 interface Calendar { minutesPerDay: number; daysPerWeek: number; }
 interface Definition {
  $schema?: string; format: 'wildlands-process'; schemaVersion: 1; revision: number;
  id: string; name: string; description?: string; start: string; seed?: number;
  /** Display preset only (terminology and default view); no runtime effect. Absent means `process`. */
  genre?: Genre; track?: Track[]; sipoc?: Sipoc;
  /** Display-only working calendar (added after v1): how views word durations; never read by a run. */
  calendar?: Calendar;
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
  input: Fields | null; remaining: number; status: 'routing' | 'queued' | 'active' | 'joining' | 'backlog' | 'held' | 'timer' | 'spent';
  fork: string | null; branch: string | null; target?: string; due?: number;
  /** Visit number of this case at the step; present only on steps with random timing, draws, instances or a random deadline. */
  visit?: number;
  /** Inclusive fork branch tokens: how many branches this fork occurrence activated (the join waits for exactly that many). */
  expected?: number;
  /** Multi-instance item tokens: `item` (1-based) of `items`, and `group` (id of the visit that owns them). */
  item?: number; items?: number; group?: string;
  /** Absolute minute at which a running work token's deadline fires; present while one is pending. */
  deadlineAt?: number;
  /** Token spawned by a non-interrupting deadline (it cannot escalate again). */
  escalated?: true;
 }
 /** `waiting` timer tokens at a step and the earliest minute one is due (`null` when none wait). */
 interface TimerMetric { waiting: number; nextDue: number | null; }
 /** Per tracked field: average of the case value on entry to the step (`mean` rounded to 3 decimals, `null` when no numeric value was seen). */
 interface TrackedEntry { n: number; mean: number | null; }
 /** Run-wide finish aggregate of a tracked field over completed cases; `mean`, `min` and `max` are `null` when `n` is 0. */
 interface TrackedFinish { label: string; n: number; mean: number | null; min: number | null; max: number | null; }
 /** `entered` equals `visits` (every entry); `reached` counts distinct cases that entered at least once. */
 interface StepMetric {
  id: string; queued: number; active: number; timers: TimerMetric; visits: number; completed: number; waitMinutes: number; entered: number; reached: number; tracked: Record<string, TrackedEntry>;
  /**
   * Read model: tokens at the step with status `held`, i.e. work that finished here and is blocked until the next step's backlog has
   * room (a subset of `queued`, which counts every token here that is neither active nor on a timer). Blocked time is not in `waitMinutes`.
   */
  held: number;
  /** Only on steps that declare a `deadline`: cumulative deadline outcomes. */
  deadlines?: {interrupted: number; escalated: number};
  /** Only on steps that declare `instances`: cumulative items started and finished (`queued` and `active` count items there). */
  items?: {started: number; finished: number};
  /**
   * Read model (LWProcessLedger, exact under pruning): `starts` counts work starts (every multi-instance item), the visits whose wait
   * is summed in `waitMinutes`; `meanWaitMinutes` is `waitMinutes / starts` rounded to 3 decimals, `null` before the first start.
   * `fixedCost` is the step's fixed `cost` charged at its starts; `workCost` adds the per-minute cost of the pool units occupied by
   * work at this step. The steps' `workCost` sums to `metrics.cost`.
   */
  starts: number; meanWaitMinutes: number | null; fixedCost: number; workCost: number;
 }
 /**
  * `workCost` (read model) is `busyMinutes × costPerMinute`, the pool's share of `metrics.cost` (the pools' `workCost` plus the steps'
  * `fixedCost` sum to `metrics.cost`); `capacityCost` is `capacity × costPerMinute × minute`, the pool's share of `metrics.capacityCost`.
  */
 interface PoolMetric {
  id: string; kind: ResourceKind; capacity: number; busy: number; busyMinutes: number; utilization: number; workCost: number; capacityCost: number;
 }
 interface Event { minute: number; kind: string; caseId: string; stepId: string; detail: string; }
 interface Receipt {
  id: string; caseId: string; stepId: string; started: number; finished: number;
  input: Fields; output: Fields; changes: Fields;
  /** Realized minutes the visit took (finished - started); present only on steps that declare `timing`. */
  duration?: number;
  /** Item count of a multi-instance visit; present only on steps that declare `instances` (one receipt per visit). */
  instances?: number;
 }
 interface Snapshot {
  minute: number; status: 'ready' | 'running' | 'completed' | 'blocked' | 'limit';
  cases: Case[]; tokens: Token[]; receipts: Receipt[]; receiptsDropped: number; steps: StepMetric[]; resources: PoolMetric[]; events: Event[];
  metrics: { arrived: number; completed: number; failed: number; dropped: number; active: number; cost: number; meanCycleMinutes: number;
   /** Read model: completed cases per 60 business minutes since minute 0 (`completed × 60 / minute`, unrounded); `null` at minute 0. */
   throughputPerHour: number | null;
   /**
    * Read model (exact under pruning and chunking): completed cases by cycle minutes. `edges` are the fixed lower bin edges 0, 1, 2, 5,
    * 10, ... 100,000; `counts[i]` counts cycles `c` with `edges[i] <= c < edges[i + 1]` (the last bin is open) and sums to `completed`.
    */
   cycleHistogram: {edges: number[]; counts: number[]};
   /** Read model: every pool unit charged for every minute so far, busy or idle (Σ capacity × costPerMinute × minute); `cost` stays the work cost. */
   capacityCost: number;
   /**
    * Read model: mean minutes since arrival of the cases still in progress (3 decimals); `null` when none is.
    * `meanCycleMinutes` covers finished cases only and is 0 until one finishes.
    */
   meanAgeMinutes: number | null;
   /** Completed cases that ended at a `goal` / `lost` end step; `conversion` is goals*1000/(goals+lost) rounded half up (permille), `null` when neither happened. */
   goals: number; lost: number; conversion: number | null; tracked: Record<string, TrackedFinish>; };
  /** Seed in use; every random draw is a pure function of it and a stable identity. */
  seed: number;
  /** Finished cases pruned from `cases` (oldest first) once more than `limits.retained` are kept; metrics stay exact. */
  retention: { finishedDropped: number };
 }
 /** `horizon` is the total run length in minutes; `null` means no clock limit (the run still ends when no work remains or can advance). */
 interface Session { query(): Snapshot; advance(minutes: number): Snapshot; horizon(): number | null; setHorizon(value: number | null): void; dispose(): void; }
 interface Limits { readonly cases: number; readonly minutes: number; readonly transitions: number; readonly events: number; readonly receipts: number; readonly active: number; readonly retained: number; }
 /**
  * `seed` overrides the definition's seed; `active` (1..limits.active) and `retained` (1..10,000) override the case caps.
  * `onEvent` receives every engine event in order (also those before the first advance and beyond the retained history) as a
  * detached copy; it must not call the session, and a sink that throws stops the session (later calls throw).
  */
 interface RunOptions { horizon?: number | null; seed?: number; active?: number; retained?: number; onEvent?: (event: Event) => void; }
 interface Runtime { create(input: unknown, options?: RunOptions): Session; limits: Limits; }
 interface Recipe {
  expectedRevision: number; expectedFingerprint: string;
  operations: ({op: 'putStep'; value: Step} | {op: 'putFlow'; value: Flow} | {op: 'putResource'; value: Resource} |
   {op: 'removeStep' | 'removeFlow' | 'removeResource'; id: string} |
   {op: 'setArrivals'; value: Arrival[]} | {op: 'setStart'; value: string} | {op: 'rename'; value: string} |
   /** Process settings: null removes the field; `setGenre` with `process` removes `genre`. All validation stays with the catalog. */
   {op: 'setDescription'; value: string | null} | {op: 'setSeed'; value: number | null} | {op: 'setGenre'; value: Genre} |
   {op: 'setSipoc'; value: Sipoc | null} | {op: 'setTrack'; value: Track[] | null} | {op: 'setCalendar'; value: Calendar | null})[];
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
 interface Clock extends Record<string, unknown> {
  minute: number; serial: number; forkSerial: number; arrival: number; cost: number;
  /** Exact running aggregates, independent of how many finished cases are retained. */
  arrived: number; completed: number; failed: number; dropped: number; cycle: number; pruned: number; goals: number; lost: number;
 }
 /** One arrival entry's lazy cursor: `k` arrivals consumed so far, `at` the next arrival minute (`null` when the stream has ended). */
 interface Stream { def: Arrival; index: number; k: number; at: number | null; }
 /** Exact running sum/count/extremes of a tracked value; kept outside the case store so pruning never changes it. */
 interface Aggregate { n: number; sum: number; min: number; max: number; }
 /** Read-model start and cost totals of one step (LWProcessLedger). */
 interface StepCosts { starts: number; fixedCost: number; workCost: number; }
 /**
  * Read-model running aggregates (LWProcessLedger): pool cost per minute of one unit of each step's work (`unit`), of the work running
  * at each step now (`rate`), per-step totals and the cycle histogram counts. Never read by the engine.
  */
 interface Ledger { unit: Map<string, number>; rate: Map<string, number>; steps: Map<string, StepCosts>; cycles: number[]; }
 interface Pool extends Record<string, unknown> { id: string; capacity: number; busy: number; busyMinutes: number; costPerMinute: number; }
 interface Station extends Record<string, unknown> { id: string; visits: number; completed: number; waitMinutes: number; reached: number; deadlines?: {interrupted: number; escalated: number}; items?: {started: number; finished: number}; }
 /** One multi-instance visit: items finished so far, the first item's start and input, and the visit number that keys its draws. */
 interface Group { id: string; count: number; done: number; started: number | null; input: Fields | null; visit: number; }
 interface State {
  world: EcsWorld; definition: Definition; steps: Map<string, Step>; outgoing: Map<string, Flow[]>;
  clock: Clock; events: Event[]; receipts: Receipt[]; receiptsDropped: number; streams: Stream[];
  seed: number; active: number; retained: number;
  /** Finished case ids, oldest first, awaiting pruning; per-case visit counters for keyed draws; cached ordered token list. */
  finished: string[]; visits: Map<string, Map<string, number>>; tokenList: Token[] | null; poolList: Pool[] | null;
  /** Clock-step failures recorded while the scheduler is locked; the next settle applies them. */
  failures: {caseId: string; message: string}[];
  /** Multi-instance visits in progress, escalations detected by the clock awaiting their token, and pending outcomes of cases that still wait for escalated tokens. */
  deadlines: Map<string, Flow>; groups: Map<string, Group>; spawns: {caseId: string; flow: string}[]; outcomes: Map<string, 'goal' | 'lost'>;
  /** Journey bookkeeping: steps each active case has entered (dropped when it finishes), finish aggregates by field, entry aggregates by `stepId|field`. */
  seen: Map<string, Set<string>>; finishAgg: Map<string, Aggregate>; entryAgg: Map<string, Aggregate>;
  /** Read-model aggregates and the streaming event sink; sessions always set `ledger`, hand-built test states may omit both. */
  ledger?: Ledger; sink?: ((event: Event) => void) | null;
 }
 interface Systems { settle(s: State): void; work(s: State): void; admit(s: State): void; nextArrival(s: State): number | null; progress(s: State): {tokens: number; running: boolean}; fastForward(s: State, target: number): void; }
}

declare namespace LWProcessRandom {
 interface Api {
  unit(seed: number, key: string): number;
  int(seed: number, key: string, min: number, max: number): number;
  chance(seed: number, key: string, percent: number): boolean;
  weighted<T>(seed: number, key: string, values: {value: T; weight: number}[]): T;
  sample(seed: number, key: string, dist: LWProcess.Dist): number;
 }
}
