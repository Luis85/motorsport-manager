import type { NodeSpec } from '../kernel-render.js';
export declare function bindInspectorFields({ currentNode, change, }: {
    currentNode(): NodeSpec | undefined;
    change(action: () => void): boolean;
}): void;
