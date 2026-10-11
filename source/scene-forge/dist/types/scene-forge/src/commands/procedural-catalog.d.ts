/** The catalog's `procedural` block: commands, presets, limits and one-command examples. */
export declare function proceduralCatalog(name: string): {
    commands: string[];
    recipe: string;
    determinism: string;
    distributions: {
        poisson: string;
        random: string;
        path: string;
        grid: string;
    };
    areas: string[];
    defaultArea: string;
    grounding: string;
    output: {
        ids: string;
        tags: string[];
        result: string;
        regenerate: string;
    };
    terrain: {
        presets: {
            [k: string]: string;
        };
        defaultPreset: "island" | "plains" | "hills" | "mountains" | "dunes";
        creates: string;
        coloring: string;
        geometry: string;
        replace: string;
    };
    guards: string[];
    limits: {
        placements: number;
        candidates: number;
        sceneNodes: number;
        items: number;
        exclusions: number;
        areaPoints: number;
        terrainResolution: number;
        samplePoints: number;
    };
    errors: {
        DUPLICATE_ID: string;
        SCATTER_EMPTY: string;
        PROCEDURAL_BUDGET: string;
        TERRAIN_TRANSFORM: string;
    };
    examples: string[];
};
