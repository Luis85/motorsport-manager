/* Scoped read and presentation-state ports for the isometric canvas renderer. */
declare namespace LWCanvasPorts {
  type Pair = readonly [number, number];
  interface Point { x: number; y: number; }
  interface Transform extends Point { dir: number; }
  interface Task { kind: string; phase: string; path: Point[]; elapsed: number; duration: number; }
  interface Actor {
    id: string; name: string; personality: string; creature: Transform; activeQuest?: unknown;
    task: Task | null; equipment: Record<string, string>; inventory: Record<string, number>;
    worldSupply?: unknown; needsDeposit?: boolean;
  }
  interface Node extends Point { id: string; kind: string; stock: number; }
  interface Storage { input: Record<string, number>; output: Record<string, number>; }
  interface Building extends Point { id: string; kind: string; level: number; storage?: Storage; }
  interface Order extends Point { id: string; type: string; kind: string; paused: boolean; paid: boolean; stage: number; }
  interface State {
    settings: { reducedMotion: boolean; follow: boolean }; nodes: Node[]; buildings: Building[];
    creature: Transform; task: Task | null; hour: number;
  }
  interface Engine {
    s: State; selected: Actor | null; creatures: Actor[];
    allOrders(): Order[]; orderIssue(order: Order): unknown; projectProgress(order: Order): number;
    canBuild(x: number, y: number, kind: string): boolean; placementIssue(kind: string, x: number, y: number): unknown;
    has(kind: string): boolean; mood(actor: Actor): string;
    buildingStatus(building: Building): { kind: string };
  }
  interface Hit extends Point { objectType?: string; objectId?: string | null; actorId?: string | null; }
  interface Target extends Point { id: string; w: number; h: number; }
  interface Decoration extends Point { kind: string; v: number; }
  interface Camera extends Point { z: number; }
  interface Particle extends Point { t: number; delay: number; off: number; type: string; }
  interface Bubble { actorId: string; text: string; time: number; type: string; }
  interface Feedback {
    actorId: string; type: string; x?: number; y?: number; kind?: string; otherId?: string;
    direction?: string; amount?: number; resource?: string; success?: boolean; text?: string;
  }
  interface Effect extends Feedback { x: number; y: number; expires: number; started: number; }
  interface View {
    canvas: HTMLCanvasElement; c: CanvasRenderingContext2D; engine: Engine; camera: Camera;
    ground: HTMLCanvasElement; decor: Decoration[]; hover: Hit | null; placement: string | null;
    showPath: boolean; time: number; bubble: Bubble | null; particles: Particle[]; effects: Effect[];
    resourceLens?: boolean; landSelected?: { type: string; id: string; x: number; y: number } | null | undefined;
    contextChoosing?: boolean; nameTargets: Target[]; landTargets: Target[];
    project(x: number, y: number): Point; transform(): Camera; toScreen(x: number, y: number): Point;
  }
  type SceneObject = (Node & { obj: 'node' }) | (Building & { obj: 'building' }) |
    (Point & { obj: 'pip'; actor: Actor }) | (Point & { obj: 'basket' | 'visitor' });
  interface Gear { color: string; visual: string; }
  interface Facade {
    SIZE: number; terrain(x: number, y: number): string; seeded(seed: number): () => number;
    clamp(value: number, low: number, high: number): number; BUILDINGS: Record<string, unknown>;
    colony: { profile(personality: string): { color: string; accent: string } | null;
      definition(id: string | undefined): Gear | null; item(id: string | undefined): { name: string } | null };
    WorldSystem: { sum(items: Record<string, number>): number };
  }
  interface WorldContent {
    node(kind: string): { mode: string; direct: boolean } | null;
    building(kind: string | null): { requiresNode?: string } | null;
  }
  interface Art {
    TW: number; TH: number;
    poly(c: CanvasRenderingContext2D, points: readonly Pair[], color: string): void;
    rect(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void;
    diamond(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string): void;
    shadow(c: CanvasRenderingContext2D, x: number, y: number, w?: number, h?: number): void;
    tree(c: CanvasRenderingContext2D, x: number, y: number, variant?: number, empty?: boolean): void;
    bush(c: CanvasRenderingContext2D, x: number, y: number, stock?: number): void;
    stone(c: CanvasRenderingContext2D, x: number, y: number): void;
    fiber(c: CanvasRenderingContext2D, x: number, y: number): void;
    pip(c: CanvasRenderingContext2D, x: number, y: number, scale?: number, frame?: number,
      mood?: string, dir?: number, kind?: string, moving?: boolean, actor?: Actor | null): void;
    box(c: CanvasRenderingContext2D, x: number, y: number, w?: number, h?: number, d?: number,
      top?: string, front?: string, side?: string): void;
  }
  interface Buildings { building(c: CanvasRenderingContext2D, x: number, y: number, kind: string, time?: number, ghost?: boolean): void; }
  interface Ground { create(createCanvas: () => HTMLCanvasElement): { ground: HTMLCanvasElement; decor: Decoration[] }; }
  interface Scene { draw(this: View, time: number, dt: number): void; }
  interface Root {
    LW: Facade; LWWorldContent: WorldContent; LWCanvasArt: Art; LWCanvasBuildings: Buildings;
    LWCanvasGround: Ground; LWCanvasScene: Scene; LWArt?: unknown;
  }
}
