import { type SceneDocument, type ModelLibrary, type QualityPolicy } from '../domain/schema.js';
export interface QualityFinding {
    code: string;
    severity: 'error' | 'warning';
    message: string;
    count: number;
    paths: string[];
    hint: string;
}
/** Inspect the visible deliverable. Findings are aggregated; paths are capped to keep agent responses bounded. */
export declare function auditScene(scene: SceneDocument, models?: ModelLibrary, input?: Partial<QualityPolicy>): {
    schemaVersion: number;
    kind: string;
    scope: string;
    passed: boolean;
    policy: {
        schemaVersion: 1;
        kind: "quality-policy";
        allowTransparency: boolean;
        allowDoubleSided: boolean;
        requireUVs: boolean;
        maxTriangles?: number | undefined;
        maxMeshes?: number | undefined;
        maxMaterials?: number | undefined;
        maxGeometries?: number | undefined;
        maxExtent?: number | undefined;
    };
    metrics: {
        nodes: number;
        meshes: number;
        triangles: number;
        geometries: number;
        materials: number;
        geometryBytes: number;
        maxExtent: number;
        bounds: {
            min: number[];
            max: number[];
            size: number[];
        };
    };
    findings: QualityFinding[];
    summary: {
        errors: number;
        warnings: number;
    };
    limitations: string[];
};
