# Storyboard and timeline authoring

Open **Experiences → World & Scene Editor → Storyboards & timelines**. All edits
use the same detached scenario draft and its Undo/Redo history. The active native
story changes only through the editor's existing reviewed scene launch.

Create a storyboard, then add named shots. Each shot names its world and scene,
keeps narrative notes beside that reference, and can link to a cutscene in the
same scene. Move earlier/later controls change the explicit shot order. A normal
scene shot has no timeline range; a cutscene shot can select start/end seconds and
open its timeline directly. Shots can cross worlds within the complete pack.

Create a cutscene from an authored scene. Add entity or camera tracks and edit
keyframe time, value and interpolation. Select the visible keyframe buttons with
Tab or use Left/Right to move between them, then Enter to open their properties.
Entity targets use scene grid coordinates, rotation uses radians, opacity and
creature pose use 0–1, and camera tracks use the chosen renderer's camera units.
Invalid duplicate times or unsupported target/property combinations show an error
without changing the revision or discarding typed corrections.

Play, Pause, Stop, Replay and Seek control a detached renderer preview. Scene
renderer controls choose Basic 2D/3D, PixiJS 2D or ExcaliburJS 2D. The preview uses
the draft's assets and native creature definitions. It consumes elapsed time from
the application's existing visible animation frame; it does not tick the native
engine or alter gameplay state. Returning to scenes disposes preview resources.
Compiled p5 presets add deterministic sparkles, orbit or ripple effects. The
preset selector also lists presets registered by compiled application modules;
JSON selects an admitted ID and never supplies a drawing callback. Centers use
scene grid units and radius uses screen pixels. An optional unsigned integer seed
replays the same pattern; otherwise the stable descriptor ID supplies its seed.

Scene entry events, timed cues, completion events and requirement triggers use
compiled event types. A scene-switch event references an existing scene
connection and requests its normal Cancel-focused admission review. Cutscene
previews display animation only; previewing a cue does not execute its scene
switch or pause intent. See [STORYTELLING.md](STORYTELLING.md) for exact runtime
semantics, limits and the typed SDK.

**Export storytelling** downloads a data-only `.storytelling.json` document.
Import validates its complete candidate pack, shows a review, and requires
**Apply storytelling to draft**. Cancel keeps the draft revision and restores
Import focus. The normal scenario export includes all worlds, scenes and
storytelling together. Obsidian Canvas exports also carry an editable ordinary
`Littlewild storytelling` text configuration; see
[OBSIDIAN-CANVAS.md](OBSIDIAN-CANVAS.md).

The browser proof exercises both 1440px and 390px workspaces, real Three.js and
PixiJS canvas changes after seeking, typed pose/p5 authoring, keyboard keyframe
selection, cross-world shot ordering/history, rejected edits, reviewed file
cancellation and preview cleanup. The native player proof covers the cinematic
pause lease and reviewed cross-world completion transitions. These synthetic
fixtures prove integration behavior; they are not human usability research.
