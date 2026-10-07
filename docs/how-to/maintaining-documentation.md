# Maintain useful documentation

Use [Diátaxis](https://diataxis.fr/) to choose a document's purpose before writing.
It distinguishes learning, completing a task, looking up facts and understanding
why the system works as it does. The folders support those reader needs.

## Choose a home and a reader outcome

| Reader need | Home | What a useful page contains |
|---|---|---|
| Learn through a guided experience | `docs/tutorials/` | Prerequisites, a reliable bounded route, concrete actions and observable outcomes |
| Complete a specific task | `docs/how-to/` | Goal, required inputs, ordered steps, failure/recovery and a way to confirm success |
| Look up a contract or capability | `docs/reference/` | Precise fields, units, ownership, defaults, limits and source/schema pointers |
| Understand a model or decision | `docs/explanation/` | Context, relationships, trade-offs and reasons, with links to recipes and contracts |
| Inspect a dated implementation or acceptance record | `docs/_archive/` | Historical scope, original source identity, evidence and supersession links |

Choose by the reader's question, not by the feature name. Content, campaign and
UI are subjects; a subject can need several document types. For example,
the first campaign tutorial guides one event, the campaign references describe
transactions, and the architecture explanation describes the authority boundary.

Keep `docs/` itself limited to `README.md` or index files. Every document should
be reachable from the main index through section indexes or related-page links.
Do not create empty quadrants or filler pages to satisfy a taxonomy. Diátaxis
explicitly treats the framework as a guide to incremental improvements.

## Game folders

`docs/concepts/<game-id>/` is the exception to the Diátaxis homes: each such
directory is the complete, data-only source folder of one Wildlands game
(`game.json`, its JSON documents and asset definitions, `README.md`, and
optional `PROVENANCE.md`/`LICENSE*`), not a Diátaxis document. Keep game data
there rather than under `source/wildlands/source/`, never put code in it, and do
not add tutorials, guides or reference pages inside a game folder: write them in
the matching Diátaxis section and link the folder's README. List every game in
[`docs/concepts/README.md`](../concepts/README.md); each folder README says what
the game is, how to build and play it and where its data came from. Validate a
changed folder with `bin/wildlands validate-game --game docs/concepts/<id>` and
refresh its published demo with `npm run build:demos` in `source/wildlands`
(every folder file, README included, is part of the digest the demo records;
`npm run check:demos` fails on a stale demo), in addition to the documentation
checker.

## Reconcile a change

1. Read the affected production code, generated schema, configuration and tests.
   Determine what is player-facing, optional Advanced, diagnostic, or a foundation
   without a dedicated screen. Update [current status](../reference/current-state.md) when that
   capability boundary changes.
2. Edit the canonical contract. Link to it from tutorials and recipes rather than
   copying entire field tables or authority descriptions. Keep short procedural
   examples near the task they support; split unrelated theory or API inventories.
3. Use exact visible labels for player steps. Check both the default Minimal path
   and explicit Advanced selection. Include the expected observation, not an
   invented time, completed phase or result.
4. Distinguish application version, save/model version and content-pack version.
   Defaults describe the shipped configuration, not immutable safety rules or
   values in a player's frozen save. Numerical tables should name their source.
5. Move superseded handoffs into `_archive/`. Preserve unique migration detail,
   source hashes, measured results, provenance and original limitations. Mark the
   page historical and link current status. Do not rewrite an old passing run as
   acceptance for newer source.
6. Update section indexes, repository README, contributor instructions, code
   diagnostics and test/tool paths when moving a document or data companion.
   Use relative Markdown links; avoid workstation-specific absolute links.

Archives preserve evidence. They do not compete with active capability pages.
An archived mechanism can still be retained in source; current contracts should
make its active boundary explicit and link dated evidence for provenance.

## Validate and report

```sh
python3 scripts/check_docs.py
git diff --check
```

The documentation checker verifies the root layout, local Markdown targets and
heading fragments, index reachability, historical notices and literal repository
documentation paths. It does not certify prose, external URLs, or every Markdown
extension. Review source-backed statements and execute changed examples as well.

When editing code or data companions, run the affected checks and follow
[repository verification](verification.md). Report exact source/dirty-tree scope,
executed and unavailable checks, and remaining validation. New documentation
does not establish human playtesting, balance or target-device performance.

## Primary guidance

This policy applies the guidance by Daniele Procida rather than copying its text:

- [Tutorials](https://diataxis.fr/tutorials/): learning through meaningful, achievable activity.
- [How-to guides](https://diataxis.fr/how-to-guides/): directions toward a reader's practical goal.
- [Reference](https://diataxis.fr/reference/): orderly, authoritative descriptions.
- [Explanation](https://diataxis.fr/explanation/): context and understanding.
- [The compass](https://diataxis.fr/compass/): distinguish action/cognition and study/work.
- [Guide to work](https://diataxis.fr/how-to-use-diataxis/): improve iteratively; structure follows useful content.

Reviewed on 4 October 2026 using the project's
[primary-source repository](https://github.com/evildmp/diataxis-documentation-framework/tree/master/source).
