/// <reference path="./runtime-contracts.d.ts" />
/** Compatibility application ports. These describe authoritative records; they
 * do not add persisted fields or create a second model of actor/task state. */
declare namespace LWTaskPorts {
    type Numbers = Record<string, number>;
    interface Needs extends Numbers {
        food: number;
        water: number;
        energy: number;
        comfort: number;
        joy: number;
    }
    interface Inventory extends Numbers {
        fiber: number;
        berries: number;
        water: number;
        meat: number;
        meals: number;
        wooden_chest: number;
    }
    interface Statistics extends Numbers {
        explored: number;
        gathered: number;
        built: number;
        trained: number;
        planksMade: number;
        fed: number;
        watered: number;
        bonded: number;
    }
    interface Cooldowns extends Numbers {
        explore: number;
        research: number;
    }
    type Point=LWRuntime.Point;
    interface Place extends Point {
        id: string;
        kind: string;
        stock: number;
        regen: number;
    }
    interface Order extends Point {
        designId?: string; buildingId?: string;
        id: string;
        type: string;
        kind: string;
        resource: string;
        contract: number;
        amount: number;
        done: number;
        progress: number;
        paid: boolean;
        paused: boolean;
        priority: number;
        created: number;
    }
    interface Task {
        kind: string;
        resource?: string;
        itemId?: string;
        otherId?: string;
        partner?: string;
        orderId?: string | null;
        nodeId?: string;
        need?: string;
        skillId?: string;
        style?: string | undefined;
        target?: Point;
        duration: number;
        elapsed: number;
        phase: string;
        path: Point[];
        label?: string;
        reason?: string;
        thought?: string;
        amount?: number;
        stock?: boolean;
        essential?: boolean;
    }
    type Draft = Partial<Omit<Task, "target">> & {
        kind: string;
        target?: Point | undefined;
    };
    interface Lesson {
        id: string;
        progress: number;
        style?: string | undefined;
    }
    interface Recipe {
        skill: string;
        station: string;
        cost: Numbers;
        time: number;
        amount: number;
    }
    interface Gear {
        id: string;
        name: string;
        slot: string;
        weight: number;
        price: number;
        travel: number;
        recipe: Recipe;
    }
    interface Skill {
        short: string;
        time: number;
    }
    interface Building {
        name: string;
        skill: string;
        time: number;
        icon: string;
        cost: Numbers;
    }
    interface Contract {
        cost: Numbers;
        coins: number;
        rp: number;
        name: string;
    }
    interface Tables {
        RES: Record<string, {
            name: string;
            price: number;
        }>;
        SKILLS: Record<string, Skill>;
        BUILDINGS: Record<string, Building>;
        RECIPES: Record<string, Recipe>;
        CONTRACTS: Contract[];
        STYLES: Record<string, {
            name: string;
        }>;
    }
    interface Issue {
        text: string;
        skill?: string;
        building?: string;
        paused?: boolean;
    }
    interface ForecastRow {
        resource: string;
        needed: number;
        onHand: number;
        used: number;
        missing: number;
    }
    interface Forecast {
        rows: ForecastRow[];
        steps: {
            resource: string;
            amount: number;
            kind: string;
            station?: string;
        }[];
        issues: Issue[];
    }
    interface PlanStatus {
        label: string;
        detail: string | undefined;
        kind: string;
        issue?: Issue;
    }
    interface Summary {
        source: string;
        detail?: string | undefined;
        text?: string;
        trace?: unknown;
    }
    interface Roll {
        success: boolean;
        critical: boolean;
        total: number;
        target: number;
        outcome: string;
    }
    interface Check extends Roll {
        skill: string;
        label: string;
        base: number;
        modifiers: unknown[];
        time: number;
        actorId: string;
    }
    interface Rating {
        skill: string;
        base: number;
        modifiers: unknown[];
        target: number;
        chance: number;
    }
    interface QuestStep {
        name: string;
        skill: string;
        modifier: number;
    }
    interface QuestDefinition {
        id: string;
        name: string;
        tier: number;
        duration: number;
        energy: number;
        coins: number;
        research: number;
        cost: Numbers;
        steps: QuestStep[];
        loot: {
            item: string;
            chance: number;
            min: number;
            max: number;
        }[];
    }
    interface Quest {
        questId: string;
        name: string;
        status: string;
        elapsed: number;
        duration: number;
        checkIndex: number;
        checks: (QuestStep & Rating)[];
        required: number;
        successes: number;
        rolls: Check[];
        found: Numbers;
        energy: number;
        energySpent: number;
        coins: number;
        research: number;
        started: number;
        returnRemaining: number;
        aborted: boolean;
        outcome: string | null;
    }
    interface QuestReport extends Quest {
        finished: number;
        delivered: boolean;
        reward: number;
        researchReward: number;
        prestigeReward: number;
    }
    interface Offer {
        id: string;
        questId: string;
        source: string;
        created: number;
        expires: number;
    }
    interface Relationship {
        a: string;
        b: string;
        affinity: number;
        trust: number;
        meetings: number;
        lastTime: number;
        memories: {
            time: number;
            text: string;
        }[];
    }
    interface Actor {
        id: string;
        name: string;
        archetype: string;
        personality: string;
        creature: Point;
        inventory: Inventory;
        needs: Needs;
        feelings: {
            anger: number;
            social: number;
            lastSocial: number;
            coolingUntil: number;
            lastControl: number;
            mood: string;
        };
        learning: {
            recovering: boolean;
        };
        equipment: Record<string, string | null>;
        equipQueue: string[];
        skills: Record<string, boolean>;
        rpg: {
            rolls: Check[];
            points: Numbers;
        };
        questPlan: {
            questId: string;
            accepted: number;
            source: string;
        } | null;
        activeQuest: Quest | null;
        questHistory: QuestReport[];
        task: Task | null;
        needsDeposit: boolean;
        socialIntent: string | null;
        salvage: (Point & {
            items: Numbers;
        })[];
        behavior: {
            memory: object;
            trace: unknown;
            lastAction: string;
        };
        lastCuriosity?: number;
        lastNeedFeeling?: number;
        lastTemperCheck?: Roll & {
            time: number;
        };
        lastRoll?: Check;
        unpackIntent: boolean;
    }
    interface State {
        name: string;
        simTime: number;
        day: number;
        focus: string;
        bond: number;
        nextId: number;
        contractIndex: number;
        creature: Point & {
            coins: number;
        };
        inventory: Inventory;
        needs: Needs;
        stats: Statistics;
        cooldowns: Cooldowns;
        skills: Record<string, boolean>;
        stockTargets: Numbers;
        training: Lesson | null;
        learning: {
            queue: Lesson[];
            paused: boolean;
            recovering: boolean;
        };
        allowance: {
            sourcing: string;
            reserve: number;
        };
        player: {
            level: number;
        };
        memory: {
            lastAchievement: number;
        };
        buildings: Place[];
        nodes: Place[];
        orders: Order[];
        task: Task | null;
        colony: {
            warehouse: {
                inventory: Numbers;
                transfers: {
                    actorId: string;
                    name: string;
                    direction: string;
                    items: Numbers;
                    time: number;
                }[];
            };
            board: {
                offers: Offer[];
                sequence: number;
                nextAt: number;
                misses: number;
            };
            relationships: Record<string, Relationship>;
        };
    }
    interface Settlement extends LWRuntime.Result {
        state?: string;
        deltas?: {
            prestige?: number;
        };
    }
    interface EconomySpec {
        id: string;
        chapterId?: string;
        guide?: number;
        pocket?: number;
        research?: number;
        actorXp?: number;
        playerXp?: number;
        stats?: Record<string, number>;
    }
}
