# Character Studio showcase — 10 October 2026

[Open the self-contained HTML showcase](index.html), or download it and open it locally.

This is a historical presentation and its replay input bundle. It preserves captured editor
screens, the native Pip package and extracted recipe, and the original Character
Studio and Scene Forge visual review files. It is not verification evidence for
later source revisions or a claim of human usability testing.

The six-card storyboard follows four steps: meet the editor, customize a coherent
character, review real renders, then continue through the three agent CLIs.
Intent, observed JSON facts and supplied screenshots remain distinct.
`workflow.json` contains illustrative commands and an observed engine-project
identity; it is explicitly not an execution receipt. The full engine project is
omitted to keep the presentation compact.

## Rebuild

Use the matching `bin/wildlands` executable and Node.js 22+. The [build provenance](index.provenance.json) records the executable hash, and the [receipt](index.receipt.json) records the exact inputs and output hash.
From the repository root, choose a new HTML destination:

```sh
node docs/_archive/verification/character-studio-showcase-2026-10-10/rebuild.mjs bin/wildlands /tmp/character-studio-showcase.html
```

The script dry-runs the actual `storyboard build` command, enforces an 8 MiB HTML
budget, writes the standalone HTML, then writes adjacent native receipt and build
provenance JSON. Existing output files are never overwritten. The receipt binds
every consumed input by SHA-256; the provenance also records the executable hash.
The generated page embeds its evidence and needs no server, JavaScript or network.

To inspect the contract before rebuilding:

```sh
/path/to/repository/bin/wildlands storyboard discover
/path/to/repository/bin/wildlands storyboard schema
/path/to/repository/bin/wildlands storyboard build --input /path/to/character-editor-showcase/storyboard.json --dry-run
```

Keep this compact input tree beside the historical artifact if replay matters.
There is no need for an opaque archive or the omitted 1.6 MiB engine project.
Copying the tree preserves all relative references and review-image hash checks.

## Provenance of supplied captures

The three editor screenshots came from `fidelity-desktop-appearance-verified.png`,
`fidelity-desktop-back-verified.png` and `fidelity-mobile-appearance-verified.png` in
the parent task's scratch workspace. They have only been copied and renamed.
`pip.package.json`, `review/` and `forge-review/` were copied unchanged from the
parent's `storyboard-final` evidence directory. `pip.recipe.json` was extracted
from the package's `appearanceManifest.metadata.characterStudio.recipe` field.
The review manifests report their own source hashes, view settings and limitations.
The storyboard verifies declared image hashes; it does not rerun those captures.
