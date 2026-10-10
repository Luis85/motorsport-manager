# Littlewild Character Studio

## Platform

A local browser editor, HTTP API and JSON CLI embedded in one standalone
Node.js 22+ executable. The editor and authoring commands work offline. Optional
PNG capture uses an external Playwright installation and Chromium.

## Users and purpose

Human creators and AI agents author portable Littlewild companions. Both use the
same validated recipes, deterministic compiler and guarded persistence boundary.
The editor complements Wildlands and Scene Forge without changing a running
simulation or editing player saves.

## Operating context

The served editor writes to a selected project through the loopback API. An
exported HTML editor works offline and saves to browser storage. Those destinations
have distinct status messages; JSON exports provide portable copies. Browser
recovery protects unfinished work but does not imply a successful disk save.

Five chapters expose identity, body and face, coat and details, skills and
personality, and outfits. A live model offers studio, world and portrait views,
lighting, camera and pose controls. Preview choices are presentation state outside
character edit history. Review validates a companion before creation or updating
an existing saved identity; a draft may remain unnamed or have unspent points.

Recipes retain identity choices independently of appearance, personality and
skills. Engine exports use existing creature, asset and definition contracts.
Pronouns, gender and voice are preserved metadata that the current engine does
not interpret. Outfits are cosmetic. Allocated skills use the real game catalog
but do not grant progression in a running world.

## Agent contract

CLI and HTTP discovery describe supported commands, schemas, catalogs and guards.
Agents can inspect complete editable recipes, stage atomic batches, dry-run them,
and persist using both revision and state hash. History, undo and redo use the
same guarded disk boundary. Browser automation can inspect and edit the current
working recipe and control the preview. Optional PNG capture records the recipe
hash and explicit view configuration for visual review.

Recipe imports and unchanged Studio exports recover editable source. Advanced
external visual or gameplay edits are rejected with recovery guidance instead of
being discarded. Scene Forge receives the visual handoff; installing a definition
in a Littlewild game folder remains an explicit, separately validated operation.

## Product principles

Recover unfinished work. Report actual save destinations and failures. Make
editing capabilities discoverable to agents. Use stable IDs, bounded atomic edits,
optimistic guards and actionable diagnostics. Preview the actual exported model.
Keep identity, character changes and camera presentation independent.

## Visual fidelity and maintenance

Compiler revision 3 shares smooth, bounded meshes, explicit UVs and deterministic
fur, cloth and leather surface recipes across the editor, engine and Scene Forge.
Shallow cream eyes retain a warm iris ring, a small pupil and one catchlight;
the lower forehead, integrated muzzle and soft limbs avoid the earlier glossy toy
proportions. Rounded cap, open vest and boot details remain socket attachments. Preset, ear, collection and
review portraits are generated from actual recipes. A deterministic garden stage
provides context without becoming gameplay data. Legacy Studio exports remain
recoverable through exact revision 1 and 2 compiler contracts. Surface textures
suggest short fibres; they do not create strand geometry or reproduce the
illustrated concept at cinematic fidelity.

Agents can preflight rendering with `doctor --capture`, produce multi-view
`review` artifacts and repeat a saved view plan. Image, recipe and compiled-visual
hashes identify the reviewed result. Atomic browser preview configuration avoids
unnecessary redraws. The engine creature CLI installs and edits immutable project
versions and attaches Scene Forge visuals while preserving native gameplay.
