# Character artboard refinement — 10 October 2026

[Open the self-contained storyboard](index.html), or download it and open it locally.

This historical record captures the second fidelity pass against the supplied
Littlewild mockups. It supersedes the [earlier fidelity comparison](../character-fidelity-2026-10-10/README.md)
for this revision, not for future source. The images are actual renders of portable
3D assets, alongside clearly labeled supplied design references.

The pass changes the authored character shape, face, clothing and lighting.
Compiler revision 4 preserves exact import verification for revisions 1–3.
Engine and Forge surface version 2 retains version-1 replay; Forge silhouette
profiles and Studio camera/animation-phase controls support repeatable agent work.
See the maintained [agent workflow](../../../how-to/character-agent-workflow.md)
and [current capabilities](../../../reference/current-state.md).

## Evidence and limits

The retained recipe selects the cap, rain cape, satchel and boots to match the
clothed reference. The bare reference is page 9 of the supplied PDF. The previous
portrait is historical, with different clothing and framing; it is not an aligned
pixel-difference baseline.

The review manifest binds recipe, compiled visual, view configuration and images.
Desktop/mobile browser evidence records real renderer state. Forge and native
receipts document the actual exported asset and renderer. The handoff receipt
records executed public-CLI operations and exact executable hashes. No receipt
claims human usability validation or a completed gameplay journey.

The character remains a stylized 3D interpretation. Short geometric fibres and
surface maps do not implement a strand-hair simulation. Lighting, scenery and
fine material behavior differ from the illustration and between renderers. Eyes
and gaze are simpler, blush is subtler and the cape is more rigid than the target.
These remaining differences are visible in the retained frames.

## Rebuild

From the repository root with Node.js 22+:

```sh
node docs/_archive/verification/character-artboard-2026-10-10/rebuild.mjs bin/wildlands /tmp/character-artboard.html
```

Use a new output path and the matching executable identity in the provenance.
The script runs a dry-run, builds through the engine storyboard CLI and checks
identical output bytes. The HTML embeds all images and needs no script, server or
network. Keep the input tree for replay; reproducing captures additionally needs
the recorded renderers and capture tools.
