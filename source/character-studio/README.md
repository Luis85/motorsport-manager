# Littlewild Character Studio

A dedicated character editor, local HTTP API and discoverable JSON CLI packaged
as one generated executable: `../../bin/character-studio` (Node.js 22+).

```sh
node ../../bin/character-studio serve --project ./characters
node ../../bin/character-studio discover
```

See the [handbook](../../docs/reference/character-studio-cli.md) for agent workflows,
revision guards, offline editor exports, save destinations and engine/Scene Forge
handoffs. The CLI and server expose command/schema discovery, atomic edit batches,
revision and state-hash guards, dry runs and structured diagnostics. `preview`
creates a self-contained offline editor. Optional `capture` renders a PNG using
Playwright and Chromium; ordinary authoring and the editor need only the bundled
executable and Node.js.

The supplied design walkthrough is a reference; shipped models come
from Littlewild's real authored definitions, not static mockup artwork.

## Development

```sh
npm ci
npm run build:cli
npm run check:cli
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
# Engine integration: first npm ci && npm run build in ../wildlands
npm run test:integration
# Built CLI handoff through Wildlands and Scene Forge
npm run test:handoff
```

Domain owns plain recipes, catalog and validation. Application owns transactional
edits and deterministic compilation. Infrastructure owns files, guarded disk
history and the loopback server. Browser UI emits operations and renders detached
values. Build embeds UI, Three.js, content and existing engine validators. Generated
`bin/character-studio` must be rebuilt, never hand-edited.

The app does not tick the engine, rewrite player saves, grant live progression or
publish a companion into a world. Portable exports are explicit integration
boundaries. Pronouns, gender and voice remain studio metadata until the engine
supports those fields. Cosmetics intentionally have no equipment stat effects.

Design tokens and component guidance are recorded in [DESIGN.md](DESIGN.md) and
[the design sidecar](.impeccable/design.json). [PRODUCT.md](PRODUCT.md) records the
product and persistence boundaries. The shipped CSS remains the implementation
source; regenerate the design snapshot when the visual system changes.
