/// <reference path="./legacy-task-records.d.ts" />
/** Current authoritative application records. These ports describe persisted values;
 * they do not copy state, add defaults, or grant callers ownership of a live engine. */
declare namespace LWApplication {
 type Numbers = Record<string, number>;
 type Flags = Record<string, boolean>;
 type Point = LWTaskPorts.Point;
 interface Lesson { id: string; progress: number; style: string; tuition: number; }
 interface Order {
  id: string; type: string; paused: boolean; priority: number; created: number;
  kind?: string; x?: number; y?: number; resource?: string | null; skillId?: string;
  amount?: number; done?: number; progress?: number; stage?: number; paid?: boolean;
  targetLevel?: number; approach?: string; contract?: number;
 }
 interface Task extends LWTaskPorts.Task {
  buildingId?: string; jobId?: string; saleId?: string; recipeId?: string;
  buffered?: boolean; forDelivery?: boolean; supplyFor?: string; worldGather?: boolean;
  insideBuildingId?: string;
 }
 interface Origin { islandId: string; islandName: string; offerId: string; playerLevel: number; creatureLevel: number; }
 interface QuestPlan extends Origin { questId: string; accepted: number; source: string; paused?: boolean; }
 interface Quest extends LWTaskPorts.Quest, Origin { paused?: boolean; }
 interface QuestReport extends LWTaskPorts.QuestReport, Origin {}
 interface Offer extends LWTaskPorts.Offer, Origin {}
 interface Memory {key:string;title:string;description:string;icon:string;day:number;hour:number;}
 interface Wish {stat:string;amount:number;title:string;thought:string;action:string;day:number;start:number;complete:boolean;}
 interface Actor {
  id: string; name: string; archetype: string; personality: string; traits: string[];
  creature: Point & { level: number; xp: number; coins: number; dir: number };
  bond: number; needs: LWTaskPorts.Needs; inventory: Numbers; skills: Flags; researched: Flags;
  orders: Order[]; task: Task | null; training: Lesson | null;
  learning: { queue: Lesson[]; style: string; fatigue: number; recovering: boolean; paused: boolean; practiceDay: number; practicedToday: Numbers; path: string };
  stockTargets: Numbers; practice: Numbers; specializations: Record<string,string>;
  equipment: Record<string,string|null>; equipQueue: string[];
  questPlan: QuestPlan | null; activeQuest: Quest | null; questHistory: QuestReport[];
  needsDeposit: boolean; socialIntent: string | null; unpackIntent: boolean;
  feelings: { anger: number; social: number; causes: { reason: string; joy: number; anger: number; time: number }[]; lastControl: number; coolingUntil: number; lastSocial: number; mood: string };
  rpg: { attributes: Numbers; cp: number; points: Numbers; practiceCredit: Numbers; rolls: LWTaskPorts.Check[]; rng: number };
  memory: { lastAchievement: number; lastPraise: number; lastGentleWarning: number; lastPlan: string; lastDecline: number };
  stats: LWTaskPorts.Statistics; cooldowns: Numbers;
  allowance: { limit: number; given: number; auto: boolean; reserve: number; sourcing: string };
  buildPolicy: { approach: string }; fieldStudies: { active: string | null; progress: Record<string,Numbers>; completed: string[] };
  metrics: { crafts: Numbers; gathered: Numbers; practices: Numbers; stages: number; upgrades: number; lessons: number };
  daily: { day: number; bonded: number }; focus: string;
  memories:Memory[];wish:Wish|null;salvage:(Point & {items:Numbers})[];
  lastNeedFeeling:number;lastTemperCheck:(LWTaskPorts.Roll & {time:number})|null;
  behavior: { trace: unknown; memory: object; lastAction: string };
  lastRoll: LWTaskPorts.Check | null; careVisual: { kind:string;time:number } | null;
  homeId: string | null;
  worldPickup: { buildingId: string; resource: string; amount: number } | null;
  worldSupply: { buildingId: string; recipeId?: string; resource: string; amount: number } | null;
  eventInteractions: { id: string; definition: string; trigger: string; created: number; expires: number }[];
  interactionCooldowns: Numbers;
 }
 interface Job {
  id: string; recipe: string; output: string; amount: number; cost: Numbers;
  duration: number; progress: number; workerId: string | null; originId: string;
  orderId: string | null; attempts: number;
 }
 interface Storage {
  input: Numbers; output: Numbers; job: Job | null; targets: Numbers; requests: Numbers;
  enabled: boolean; priority: number; emptyInputs: boolean; flushOutput?: boolean;
  completed: number; lastOutput: number; lastMessage: string;
 }
 interface Building extends Point {
  id: string; kind: string; level: number; quality: number; stock: number; regen: number;
  storage?: Storage; planAssignee?: string | null; marketInventory?: Numbers; door?: {dx:number;dy:number};
 }
 interface Sale {
  id: string; item: string; amount: number; remaining: number; sold: number;
  transit: Numbers; staged: Numbers; assignedId: string | null; status: string;
  paused: boolean; priority: number; unitPrice: number; created: number;
 }
 interface Control { paused?: boolean; stopped?: boolean; priority?: number; }
 interface PlannerHistory { time: number; key: string; name: string; actorId: string | null; action: string; }
 interface State {
  version: number; simTime: number; day: number; hour: number; nextId: number;
  player: { level:number; xp:number; coins:number }; rp: number;
  started: boolean; paused: boolean;
  buildings: Building[]; nodes: (LWTaskPorts.Place & {max:number})[];
  log: { text:string;icon:string;time:number;day:number;hour:number;actorId?:string|null }[];
  ledger: { label:string;guide:number;pocket:number;research:number;day:number;hour:number;actorId?:string|null }[];
  colony: { version:number;creatures: Actor[]; selectedId: string | null; nextCreatureId: number; purchased: number; rng: number; message: string;
   warehouse: { inventory: Numbers; transfers: { actorId:string;name:string;direction:string;items:Numbers;time:number }[] };
   relationships: Record<string,LWTaskPorts.Relationship>; board: { offers:Offer[];nextAt:number;misses:number;sequence:number } };
  market: { sequence:number;orders:Sale[];history:{id:string;item:string;amount:number;coins:number;time:number;actorId:string}[] };
  planning: { controls:Record<string,Control>;history:PlannerHistory[] };
  estate: { version:number;islands:{ix:number;iy:number;name?:string;biome?:string}[];purchases:number };
  progression: { version:number;prestige:number;earnedPrestige:number;slots:number;interactionSequence:number;research:Flags;features:Numbers;tutorial:{step:number;dismissed:boolean;complete:boolean} };
  atlas: { version:number;clocks:Record<string,{nextAt:number;misses:number;rng:number}>;history:(Origin&{questId:string;actorId:string;finished:number;outcome:string;prestige:number})[] };
  creatureInteractions?: { active: readonly unknown[] };
 }
 interface EngineDocument { app:string;version:number;state:State; }
 interface StoryEngine { s:State;creatures:Actor[];export():EngineDocument; }
}
