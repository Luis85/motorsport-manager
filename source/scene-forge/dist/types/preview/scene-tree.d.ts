import type { NodeSpec } from '../domain/schema.js';
/** The node itself and every node whose parent chain reaches it. */
export declare function descendantIds(nodes: readonly NodeSpec[], id: string): Set<string>;
/** The stem (at most 50 characters) or the first free `<stem>_<n>` from 2 upwards. */
export declare function availableNodeId(stem: string, taken: (id: string) => boolean): string;
/**
 * New IDs for a copied subtree: the root takes `newId`; descendants combine a bounded
 * prefix of `newId` with the end of their own ID. Returns undefined when the copies
 * would collide with each other or with an existing node.
 */
export declare function subtreeCopyIds(nodes: readonly NodeSpec[], ids: ReadonlySet<string>, root: string, newId: string): Map<string, string> | undefined;
