# Littlewild v15: compact world panels and configurable scenario packs

## Scope

Add only `docs/concepts/littlewild/`. No native Motorsport Manager runtime, content, CI or quality-policy changes.

The existing Littlewild browser showcase gains compact non-modal Build/Tutorial panels, shared spacing, explicit assignment drafts, keyboard world/panel navigation, and a reusable scenario pack with two independently runnable settings (Littlewild and Emberworks). The existing simulation remains the behavioral base. This is not an unrestricted engine: stable mechanic roles, handlers, rigs and island topology limits remain documented.

## Verification

- 871 checks passed across 17 suites; 105 browser checks.
- Supplied v14 HTML baseline: `3ee1c7f043f2c0e8a1fff3720ede5cf63950793857f89ea9fb141a7619824b0d`.
- Final HTML: `acaf00f6163cb8ca3539370ed8b89e2afd844491ae7ee1c1bb70a321b0543032`.
- Reversible pack validation, real imports/downloads, actual placement to a second creature, valid scene/save continuation and six window sizes covered.
- Independent source rebuild recorded in `delivery-manifest.json`.
- Hardware WebGL, physical devices, screen readers and human usability not verified; software renderer used for captures.
- Native Godot full six-shard gate not run because this is an isolated concept addition with no native changes.

## Repository quality note

New cohesive modules and test scripts fit the advisory file-size budgets. Retained prototype legacy modules and the generated offline HTML/vendor bundle exceed them; these are explicit inherited-concept exceptions, not hidden exclusions or changes to native enforcement. Do not interpret historical per-version assertions as current passing results; see VERIFICATION.md for the current gate.

## Review

Open `docs/concepts/littlewild/littlewild.html`; choose the charted scene, Build and Guide, then More → Worlds & scenarios → Emberworks. Review CONFIGURATION.md for supported authoring boundaries.
