# Character fidelity follow-up — 10 October 2026

[Open the self-contained comparison storyboard](index.html), or download it and open it locally.

This is a historical presentation and replay bundle for the fidelity follow-up.
It compares the supplied design, the [previous editor showcase](../character-studio-showcase-2026-10-10/README.md),
and actual captures of the revised characters in Studio, Scene Forge and Godot.
It is not verification evidence for later revisions or a claim of human usability
validation, illustration parity or a completed gameplay journey.

The revision introduces softer companion geometry, warmer eyes, better fitting
outfits, authored UVs, deterministic fur/cloth/leather surfaces, Forge organic
modeling controls and compact engine visual inspection. The images preserve
visible differences between renderers. Short surface maps do not implement strand
fur; native sheen remains approximate; the CPU fallback omits physical shading.
See [current capabilities](../../../reference/current-state.md) and the
[agent workflow](../../../how-to/character-agent-workflow.md) for maintained guidance.

## Inputs and evidence

- `evidence/supplied-concept.png` is page 1 of the user-supplied high-fidelity PDF.
- `evidence/before-editor.png` is copied unchanged from the earlier showcase.
- `evidence/after-editor-*.png` are actual desktop and mobile editor captures;
  [browser facts](ui-evidence.json) record the renderer and lack of overflow/errors.
- The three preset reviews and six-view outfitted review retain their original
  manifests, image hashes and camera replay plans.
- The Forge review uses the same native package. Its [export report](evidence/forge-export.json)
  records zero Khronos GLB errors and warnings. Scratch paths in that report are
  historical execution locations, not portable input paths.
- The [native receipt](evidence/pip-trail-godot.receipt.json) binds the exact visual,
  capture, native factory and capture script. The supplied `.gd` script is replay
  source, not embedded executable content in the storyboard.
- [Handoff evidence](handoff-receipt.json) records the exact three executable
  hashes and the public-CLI maintenance test, including eight textured GLBs,
  guarded dry runs and preservation of gameplay, rig and original projects.
- [Workflow notes](workflow.json) describe discoverable capabilities; they are
  explicitly authored notes, not execution evidence.

## Rebuild the page

Use Node.js 22+ and the matching `bin/wildlands` executable recorded in the
[build provenance](index.provenance.json). From the repository root:

```sh
node docs/_archive/verification/character-fidelity-2026-10-10/rebuild.mjs bin/wildlands /tmp/character-fidelity.html
```

Choose a new output path. The script dry-runs and builds through the actual
engine storyboard CLI, checks the identical output hash, and writes adjacent
receipt and provenance files. Its presentation budget is 24 MiB. The
[receipt](index.receipt.json) records all consumed input hashes. Image hashes
asserted by review manifests are verified by the engine. Repeated builds from
these same inputs must produce identical HTML bytes.

The [browser check](browser-verification.json) records successful desktop/mobile
image loading, no overflow, no scripts, no external requests and no page errors.
The generated HTML needs no server, script or network. Keep the input tree beside
it for replay. Regenerating screenshots requires the capture tools and matching
renderers; replaying the storyboard simply composes the retained evidence.
