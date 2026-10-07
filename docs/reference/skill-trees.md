# Wildlands skill trees

Wildlands supports independent, data-driven skill trees on the guide (`player`)
and on stable creature IDs (`c1`, `c2`, …). Littlewild's two starting scenes attach
**Growing in the glade** to every creature. Open **Learn → Skill trees** to inspect
the selected companion and spend earned points. Existing lessons, practice,
character points and specialties keep their own progression.

## Definition and progression

The [value contracts](../../source/wildlands/source/skill-tree-contracts.d.ts) and
[pure validator](../../source/wildlands/source/skill-trees.ts) own these rules.
[The demo definition](../concepts/littlewild/content/skill-tree.json) is a
version-1 example. An attachment captures a complete definition with zero XP and
an empty rank map. It receives future rewards; existing levels do not grant
retroactive points.

| Field | Meaning and limits |
| --- | --- |
| `version`, `id`, `name`, `description` | Version `1`, stable ASCII ID (64 characters maximum), name (80), description (240) |
| `xpPerPoint` | Positive integer, at most 1,000,000; earned points are `floor(xp / xpPerPoint)` |
| `nodes` | 1–64 uniquely identified nodes; prerequisite references must exist and form an acyclic graph |
| Node `cost`, `maxRank`, `minimumLevel` | 1–100 points per rank, 1–5 ranks, owner level 1–1,000 |
| Node `requires` | Up to 16 distinct `{nodeId, rank}` requirements, all of which must be met |
| Node `exclusiveGroup` | Optional group ID; learning one node permanently closes other nodes in that group |
| Node `effects` | Supported keys are `workSpeed` and `learningSpeed`, each a positive fraction up to `0.25` per rank |

Each owner can have eight trees with distinct IDs. Each tree receives the same
authorized XP award and keeps its own point budget. Total XP saturates at
1,000,000,000. Available points are earned points minus the cost of all purchased
ranks; a saved balance cannot be supplied independently. Unknown fields, sparse
lists, accessors, non-finite/fractional numbers, missing prerequisites, duplicate
trees, conflicting choices and overspent checkpoints reject.

The engine adds the guide's bonuses to the working creature's bonuses, with a
combined cap of +100% per effect. Work bonuses multiply the existing work rate;
lesson tasks use the learning bonus once. Skill trees do not grant lessons,
resources or new executable behaviors.

## Engine and developer API

The [application adapter](../../source/wildlands/source/skill-tree-integration.ts)
installs these methods on the existing composed engine:

| Method | Behavior |
| --- | --- |
| `attachSkillTree(targetId, definition)` | Validate and capture another tree; reject duplicate attachment without changing progress |
| `unlockSkillTreeNode(targetId, treeId, nodeId)` | Validate owner level, prerequisites, exclusivity, point cost and maximum rank; publish one purchased rank or reject |
| `skillTreeState(targetId)` | Detached definitions, ranks, XP, spent/available points and explicit per-node blocking reasons |
| `grantSkillTreeXp(targetId, amount)` | Trusted gameplay integration; accept a nonnegative integer up to 1,000,000,000 and publish detached progress |

`targetId` is `player` or an existing creature ID. Mutations return `{ok:true}` or
`{ok:false, reason}`. A read with an unknown owner throws. None of these operations
ticks the simulation or consumes RNG. Production rewards flow through the existing
`settleEconomy` authority: only accepted player/actor XP awards advance their trees.
Rejected or duplicate settlements do not award XP. Custom gameplay can explicitly
call the trusted grant method; imported JSON cannot register callbacks.

The typed [developer toolbox](../../source/wildlands/DEVELOPER-TOOLBOX.md) exposes
`session.skillTrees(targetId)` and discovers two world-scoped commands:

```ts
session.command({
  id: 'attach-skill-tree',
  args: ['player', definition]
});
session.command({
  id: 'unlock-skill-tree-node',
  args: ['c1', 'littlewild-growth', 'roots']
});
const progress = session.skillTrees('c1');
```

XP granting is intentionally a compiled gameplay API, outside the player command
manifest. Reads return detached values and do not normalize or initialize saves.

## Littlewild and persistence

The demo awards one point per 20 accepted creature XP. **Finding your feet** is the
root. At creature level 2, choose **Helping hands** for faster work or **A curious
mind** for faster lessons. Two ranks in that choice open its level-3 continuation.
These are permanent choices; no reset/refund command is implemented.

Starting-scene definitions are retained in the canonical balancing document and
the Littlewild pack. New arrivals inherit the first companion's retained demo
definition with zero XP, so they cannot inherit its purchased ranks. Other
scenarios and trees attach through their authored state or the API.

Optional `skillTrees` arrays live directly on the player and creature records.
The creature catalog registers this compiled optional actor field for scoped
views and persistence; archetype defaults do not fabricate empty progression.
Creature packages validate selected-instance tree progress separately from archetype
defaults, retaining learned ranks when editing a companion. The existing optional
`lastCuriosity` marker is also registered so running creatures remain editable.
Current engine format 8 and story format 10 retain them through export, import,
portable scenarios, project snapshots and the Node-backed Godot runtime. Old
saves without this field remain tree-free and gain no fabricated history.
Malformed retained trees reject before engine reconstruction. Scene journeys
retain progress in each scene owner's checkpoint, following the existing
[scene ownership contract](../../source/wildlands/WORLD-SCENE-RUNTIME.md).

The browser provides the interactive tree view; a dedicated Godot tree screen is
not implemented. Native runtime commands and checkpoints carry the same engine
capabilities. Tuning and browser regression checks do not establish human balance
or accessibility validation.
