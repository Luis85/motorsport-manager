import type { NodeSpec } from '../domain/schema.js';
export declare function bindInspectorFields({ currentNode, change, }: {
    currentNode(): NodeSpec | undefined;
    change(action: () => void): boolean;
}): void;
