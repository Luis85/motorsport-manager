/* Production definition and status policy. These queries inspect authoritative records;
 * they neither reserve inputs nor advance/settle work. Physical transactions own mutation. */
(function(inputRoot: unknown) {
  'use strict';
  type Inventory = Record<string, number>;
  interface RecipeDefinition { cost: Inventory; amount: number; time: number; skill: string; station: string; }
  interface Equipment { id: string; recipe?: { station: string; cost: Inventory; time: number; skill: string }; }
  interface Production { output: string; cost: Inventory; amount: number; seconds: number; skill: string; depletion: number; }
  interface BuildingProfile { inputCapacity: number; outputCapacity: number; requiresNode?: string; production?: Production; }
  interface Recipe { id: string; output: string; cost: Inventory; amount: number; time: number; skill: string; kind: string; depletion: number; }
  interface Job { recipe: string; workerId: string | null; progress: number; duration: number; }
  interface Storage {
    input: Inventory; output: Inventory; enabled: boolean;
    job: Job | null; requests: Inventory; targets: Inventory;
  }
  interface Building { kind: string; x: number; y: number; level?: number; storage?: Storage; }
  interface Node { kind: string; stock: number; }
  interface Worker { id: string; name: string; activeQuest?: unknown; skills: Record<string, boolean>; }
  interface ProductionQueries {
    readonly creatures: Worker[];
    originatingOrder(job: Job): { paused?: boolean } | null | undefined;
    nodeAt(x: number, y: number): Node | null;
    nodeAvailable(node: Node | null): boolean;
    buildingRecipes(building: Building): Recipe[];
    demandStock(resource: string): number;
    substrateIssue(building: Building, recipe: Recipe): string | null;
    remaining(node: Node): number;
    capacity(building: Building, which: 'input' | 'output'): number;
    skillName(skill: string): string;
    itemName(resource: string): string;
  }
  interface Status { label: string; kind: string; detail: string; }
  const root = inputRoot as { LWWorldProduction?: typeof api };
  const sum = (inventory: Inventory): number => Object.values(inventory).reduce((total, count) => total + count, 0);

  function capacity(building: Building, which: 'input' | 'output', profile: BuildingProfile | undefined | null): number {
    return (profile?.[which === 'input' ? 'inputCapacity' : 'outputCapacity'] || 0) +
      ((building.level || 1) - 1) * (which === 'input' ? 4 : 6);
  }
  function recipes(building: Building, definitions: Record<string, RecipeDefinition>, equipment: Equipment[], profile: BuildingProfile | undefined | null): Recipe[] {
    const out: Recipe[] = [];
    for (const [id, recipe] of Object.entries(definitions)) if (recipe.station === building.kind) {
      out.push({ id, output: id, cost: recipe.cost, amount: recipe.amount, time: recipe.time, skill: recipe.skill, kind: 'craft', depletion: 0 });
    }
    for (const gear of equipment) if (gear.recipe?.station === building.kind) {
      out.push({ id: gear.id, output: gear.id, cost: gear.recipe.cost, amount: 1, time: gear.recipe.time, skill: gear.recipe.skill, kind: 'gearcraft', depletion: 0 });
    }
    const production = profile?.production;
    if (production) out.push({ id: production.output, output: production.output, cost: production.cost,
      amount: production.amount, time: production.seconds, skill: production.skill, kind: 'produce', depletion: production.depletion });
    return out;
  }
  function status(queries: ProductionQueries, building: Building, profile: BuildingProfile | undefined | null): Status {
    const st = building.storage;
    if (!st) return { label: building.kind === 'storehouse' ? 'Shared warehouse' : 'A place to belong', kind: 'quiet',
      detail: building.kind === 'storehouse' ? 'Only stock deposited here is sellable.' : 'No production inventory.' };
    if (!st.enabled) return { label: 'Paused', kind: 'paused', detail: st.job ?
      'The paid batch keeps its progress and reserved inputs.' : 'No new work or ingredient deliveries. Outputs can still be collected.' };
    if (st.job && queries.originatingOrder(st.job)?.paused) return { label: 'Plan paused', kind: 'paused',
      detail: 'The originating creature’s craft order is paused. Reserved supplies and progress stay here.' };
    if (st.job) {
      const worker = queries.creatures.find(c => c.id === st.job!.workerId);
      return { label: worker ? 'Working' : 'Waiting for a creature', kind: 'working', detail: worker ?
        worker.name + ' · ' + Math.round(100 * st.job.progress / st.job.duration) + '% of this attempt.' : 'A qualified creature can resume this paid batch.' };
    }
    const node = profile?.requiresNode ? queries.nodeAt(building.x, building.y) : null;
    if (profile?.requiresNode && (!node || node.kind !== profile.requiresNode || !queries.nodeAvailable(node))) {
      return { label: node?.stock === 0 ? 'Node exhausted' : 'Missing required node', kind: 'blocked',
        detail: 'This place cannot start another batch here. Stored output is still available.' };
    }
    const demand = queries.buildingRecipes(building).filter(recipe =>
      (st.requests[recipe.id] || 0) > 0 || (st.targets[recipe.id] || 0) > queries.demandStock(recipe.output));
    if (!demand.length) return { label: sum(st.output) ? 'Ready for collection' : 'On demand', kind: sum(st.output) ? 'output' : 'quiet',
      detail: sum(st.output) ? 'Produced goods are here, not in the warehouse.' : 'Set a stock target or let a creature request a recipe.' };
    const recipe = demand[0]!, substrate = queries.substrateIssue(building, recipe);
    if (substrate) return { label: substrate, kind: 'blocked', detail: 'This recipe requires ' + recipe.depletion + ' units from its site. ' +
      (node ? queries.remaining(node) : 0) + ' remain; stored output is still available.' };
    if (sum(st.output) + recipe.amount > queries.capacity(building, 'output')) return { label: 'Output full', kind: 'blocked',
      detail: 'A creature must empty the output tray before production can continue.' };
    if (!queries.creatures.some(c => !c.activeQuest && c.skills[recipe.skill])) return { label: 'Needs a skilled creature', kind: 'blocked',
      detail: 'Learn ' + queries.skillName(recipe.skill) + ' or wait for a trained companion to return.' };
    const missing = Object.entries(recipe.cost).filter(([id, quantity]) => (st.input[id] || 0) < quantity);
    if (missing.length) return { label: 'Waiting for supplies', kind: 'supply', detail: missing.map(([id, quantity]) =>
      (quantity - (st.input[id] || 0)) + ' ' + queries.itemName(id).toLowerCase()).join(', ') + ' must arrive at this building.' };
    return { label: 'Ready to work', kind: 'ready', detail: 'Ingredients are in place. Creatures take care of urgent needs before working.' };
  }
  const api = { capacity, recipes, status };
  root.LWWorldProduction = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(globalThis);
