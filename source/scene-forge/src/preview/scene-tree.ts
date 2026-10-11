// Pure scene-hierarchy queries for editor commands: the IDs in a node's subtree, the
// first unused node ID for a stem, and the ID map for a duplicated subtree. No DOM,
// WebGL or document mutation; callers apply the results inside an edit transaction.
import type { NodeSpec } from '../domain/schema.js';

/** The node itself and every node whose parent chain reaches it. */
export function descendantIds(nodes: readonly NodeSpec[], id: string) {
  const ids = new Set([id]);
  let changed = true;
  while (changed) {
    changed = false;
    nodes.forEach((n) => {
      if (n.parent && ids.has(n.parent) && !ids.has(n.id)) {
        ids.add(n.id);
        changed = true;
      }
    });
  }
  return ids;
}

/** The stem (at most 50 characters) or the first free `<stem>_<n>` from 2 upwards. */
export function availableNodeId(stem: string, taken: (id: string) => boolean) {
  const prefix = stem.slice(0, 50);
  if (!taken(prefix)) return prefix;
  let i = 2;
  while (taken(`${prefix}_${i}`)) i++;
  return `${prefix}_${i}`;
}

/**
 * New IDs for a copied subtree: the root takes `newId`; descendants combine a bounded
 * prefix of `newId` with the end of their own ID. Returns undefined when the copies
 * would collide with each other or with an existing node.
 */
export function subtreeCopyIds(
  nodes: readonly NodeSpec[],
  ids: ReadonlySet<string>,
  root: string,
  newId: string,
) {
  const map = new Map(
    [...ids].map((id) => [id, id === root ? newId : `${newId.slice(0, 28)}--${id.slice(-32)}`]),
  );
  if (
    new Set(map.values()).size !== map.size ||
    [...map.values()].some((id) => nodes.some((n) => n.id === id))
  )
    return undefined;
  return map;
}
