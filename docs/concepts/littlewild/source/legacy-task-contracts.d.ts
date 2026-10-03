/// <reference path="./legacy-task-records.d.ts" />
/** Narrow application capabilities consumed by companion and task services. */
declare namespace LWTaskPorts {
    interface BaseHost {
        s: State;
        has(id: string): boolean;
        walkable(x: number, y: number): boolean;
        missingSkill(resource: string): string | null;
        assessResource(resource: string, amount: number | undefined, seen?: Set<string>): Issue | null;
        orderIssue(order: Order): Issue | null;
        orderName(order: Order): string;
        resourceTask(resource: string, orderId?: string | null, force?: boolean, quantity?: number): Draft | null;
        shoppingTask(resource: string, orderId?: string | null, essential?: boolean): Draft | null;
        nearest(nodes: Place[]): Place | undefined;
        needTask(which: string): Draft | null;
        createNeedTask(which: string): Draft | null;
        orderTask(order: Order): Draft | null;
        startTask(task: Draft | null): boolean;
        finishTask(task: Task): void;
        decide(): void;
        taskSkill(task: Task): string | undefined;
        practiceSkill(skill: string | undefined): void;
        workRate(task: Task): number;
        checkWish(): void;
        xp(who: string, amount: number): void;
        researchGain(amount: number, label?: string): void;
        remember(key: string, title: string, description: string, icon?: string): void;
        log(text: string, icon?: string): void;
        emit(type: string, text: string, extra?: object): void;
        economySettlementId(scope: string, key?: string): string;
        economyRuntime(): {
            splitIncome(amount: number): {
                guide: number;
                pocket: number;
            };
        };
        settleEconomy(input: EconomySpec, label?: string | null): Settlement;
    }
    interface ColonyHost extends BaseHost {
        actor: Actor;
        creatures: Actor[];
        selected: Actor | null;
        behaviorTree: {
            tick(tree: unknown, context: object): {
                trace: unknown;
            };
        };
        ecs: {
            step(actor: Actor, dt: number, context: object): {
                studying: boolean;
            };
            advanceActivity(actor: Actor, dt: number, context: {
                walkable(x: number, y: number): boolean;
                moveRate: number;
                workRate: number;
            }): {
                state: string;
                completed: boolean;
            };
        };
        load(c?: Actor): {
            level: number;
            maximumKg: number;
            grams: number;
            overloaded: boolean;
        };
        traitEffects(c?: Actor): {
            travel: number;
            social: number;
        }[];
        skillRating(skill: string, c?: Actor, extra?: number): Rating;
        check(skill: string, extra: number, label: string): Roll;
        random(stream?: string): number;
        visual(kind: string): void;
        changeFeeling(reason: string, joy?: number, anger?: number): void;
        mood(): string;
        warehouse(): Place;
        depositTask(reason?: string): Draft | null;
        surplus(): Numbers;
        relationship(a: string, b: string): Relationship;
        socialTask(): Draft | null;
        releaseSocial(task: Task | null): void;
        depart(): boolean;
        returnQuest(): boolean;
        discover(quest: Quest, definition: QuestDefinition): void;
        questForecast(quest: QuestDefinition, actor?: Actor): {
            duration: number;
            checks: (QuestStep & Rating)[];
            required: number;
            missing: unknown[];
            load: {
                overloaded: boolean;
            };
        };
        questRewardSpec(quest: Quest, completed: boolean): EconomySpec;
        addOffer(questId: string, source: string): void;
        constructionCost(order: Order): Numbers;
        movementRate(actor: Actor): number;
    }
    interface Adventure {
        slots: readonly string[];
        defaultContent: {
            chest: Chest;
        };
        content: {
            chest?: Chest;
            quests: QuestDefinition[];
            rules: {
                questOfferLife: number;
                abortReturnSeconds: number;
                abortEnergy: number;
                returnSeconds: number;
                questCooldown: number;
                eventChance: number;
            };
            behaviorTree: unknown;
        };
        copy<T>(value: T): T;
    }
    interface Chest {
        equipmentPool: string[];
        supplies: Numbers;
    }
    interface ColonyDependencies {
        definition(id: string): Gear | undefined;
        item(id: string): Gear;
        profile(id: string): {
            preferences: {
                social: number;
                explore: number;
                train: number;
                build: number;
            };
            selfControl: number;
        };
        arrivalPoint(archetype: string, personality: string): Point;
    }
}
