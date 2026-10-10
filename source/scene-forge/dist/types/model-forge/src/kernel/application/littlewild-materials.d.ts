type Plain = Record<string, unknown>;
/** Bake per-node overrides into portable material slots, without changing shared base values. */
export declare function importedMaterials(materials: Plain, used: Plain): (role: string, props: unknown, nodeId: string, mesh: boolean) => string;
export {};
