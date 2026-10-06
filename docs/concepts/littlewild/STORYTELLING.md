# Scenes, cutscenes and storyboards

The World & Scene Editor owns one detached, revisioned scenario-pack draft. Its
storytelling workspace keeps normal scenes, cinematic timelines and storyboard
shots together. Undo and redo cover all three. Exporting or importing the whole
pack includes every scene, world, native checkpoint template, shared content
library and optional `storytelling` document. Native state remains version 8,
portable stories remain envelope 10 and scenario packs remain schema version 2.

A cutscene is a presentation of an existing scene. It does not create another
simulation, spend inventory, assign work, consume randomness or advance dormant
worlds. Existing creatures, buildings, resource nodes and placed props are its
stable targets. Scene rendering chooses the appropriate 2D or 3D renderer; an
editor preview projects the draft directly, without importing a temporary engine
or installing its catalogs into the live story.

```ts
const tools = LWDeveloper; // Browser; Node exports the same `toolbox` singleton.
const authored = tools.storytelling.createEditor(pack);
const scene = authored.scene.snapshot().scenes[0]!;
const actor = authored.scene.entities(scene.id)
  .find(entity => entity.category === 'creatures')!;
authored.storytelling.setCutscene({
  id: 'welcome', name: 'A new beginning', sceneId: scene.id,
  duration: 4, skipPolicy: 'finish',
  tracks: [{
    id: 'walk-in', target: { category: 'creatures', id: actor.id },
    property: 'x',
    keyframes: [{ time: 0, value: actor.x }, { time: 4, value: actor.x + 2 }]
  }],
  events: [{ id: 'greeting', time: 1,
    event: { type: 'message', text: 'A new world awaits.' } }],
  onFinish: [{ type: 'message', text: 'Your companions are ready.' }]
}, authored.scene.revision);
authored.storytelling.setStoryboard({
  id: 'opening', name: 'Opening story', shots: [{
    id: 'arrival', name: 'Arrival', sceneId: scene.id,
    cutsceneId: 'welcome', narrative: 'The companions discover their new home.'
  }]
});
const savedPack = authored.scene.export();
const midpoint = tools.storytelling.sample(savedPack, 'welcome', 2);
```

Cutscene IDs are unique within the pack. Track, cue and shot IDs are unique within
their owning timeline or storyboard. Entity targets carry both category and ID,
so a prop and creature may safely have the same local ID. A shot references a
normal scene or a cutscene in that scene. Optional shot `start`/`end` values select
a range within the referenced cutscene; untimed scene shots carry narrative only.
Storyboards organize the narrative; viewing or validating a storyboard never
executes its references.

Tracks interpolate `x`, `y`, `height`, `rotation` (radians), `scale`, `opacity` and normalized rig `pose` (0–1).
Camera tracks interpolate `x`, `y` and `zoom`. Camera position uses the renderer
host's existing camera coordinates. Entity coordinates use scene grid units.
Keyframes have strictly increasing times in seconds. The outgoing keyframe's
`easing: 'step'` holds its value until the next key; omitted easing is linear.
Pose applies a compiled gesture phase to the canonical rig without editing its asset definition.
Values before the first and after the last key remain at those endpoint values.
Two tracks cannot write the same property of the same target. Sampling is a pure
function of accepted authored data and timeline time.

The optional `animations` array references compiled p5.js presets: `sparkles`,
`orbit` and `ripple`, plus trusted presets registered by application code. Each descriptor has an ID, preset ID, start, duration,
scene-local position, radius, hexadecimal color and particle count. Presets are
presentation only. Custom preset IDs must exist in the compiled animation catalog;
imported content cannot register presets or provide executable callbacks. The
renderer supplies sampled time through the existing animation frame. No cutscene
or preset owns another timer or animation loop.

```json
{
  "id": "welcome-sparkles", "presetId": "sparkles",
  "start": 0, "duration": 4, "x": 9, "y": 9,
  "radius": 24, "color": "#efb85c", "count": 24
}
```

Playback exposes Play, Pause, Resume, Stop, Skip and Replay. Stop restores the
presentation and clears pending timeline events. Replay starts a fresh run from
zero. Seek changes presentation time without executing crossed cues. With
`skipPolicy: 'finish'`, Skip visits remaining cues and emits completion events
once; with `'cancel'`, it stops and emits none. A completed run cannot emit
completion a second time. Completed runtime playback releases its renderer overlay
while retaining status and Replay; a pending scene review holds its last frame
until acceptance or cancellation. Authoring previews may retain their final frame. Disposing a playback prevents further time or control
commands. Public SDK playback handles expose controls and detached observations;
only application composition holds `advance(elapsed)` and `drainEvents()`.

Active cinematic playback suspends the existing native simulation clock through
a presentation pause lease, preserving manual pause and speed choices. The
application supplies elapsed time only while the page is visible. Preview
playback uses that same supplied-time path. A timeline can never change native
inventory, work, movement orders, resource production or RNG state.

Scene entry events, ordered timeline cues and completion events share the same
closed event grammar:

- `message` displays authored text.
- `pause` emits the existing native pause intent.
- `play-cutscene` references a cutscene in the current scene; `once: true`
  suppresses automatic repeats after it has started successfully.
- `scene-switch` references a named connection in the current scene.

Timed cues execute at their authored timestamps, including zero-time cues when
playback starts. A large elapsed step is divided at cue boundaries. Message and
pause cues run immediately. A play-cutscene cue replaces the current presentation;
the interrupted clip does not receive completion credit, and remaining elapsed
time advances its replacement. A scene-switch cue holds playback at that cue for
review. Cancel resumes from the same point without repeating the cue; a rejected
gate leaves native state and progress unchanged. Later cues from an interrupted
clip are discarded. Scene-entry and requirement-trigger event arrays remain
serialized: events after a cutscene start wait for its completion.

A scene switch always uses the existing navigation review and commit authority.
Connection and destination entry requirements apply to the source checkpoint.
The browser presents a Cancel-focused review; cancel leaves the active native
story in place. Editing native work or context after review makes that review
stale. Accepted connections checkpoint unfinished work before adopting the next
scene. The normal scene adoption path owns backup, persistence and camera intent.
Validation, import and editor export never execute these events.

Scenes can also define `graph.triggers`: stable IDs, an array of existing scene
requirements and an ordered event array. Requirements reuse player level,
completed quest, owned building and inventory quantity checks. Only the active,
unpaused scene is observed. A trigger fires when its combined condition first
becomes true. Omitted `once` means true. `once: false` allows another firing only
after the condition becomes false and then true again; it does not fire on every
frame. There is no scripting language or arbitrary expression evaluator.

```json
{
  "id": "charted-path",
  "requirements": [{ "type": "quest-complete", "questId": "meadow_patrol" }],
  "events": [{ "type": "play-cutscene", "cutsceneId": "welcome", "once": true }],
  "once": true
}
```

Use a quest ID from the pack's authored adventure or chapter library. A failed
entry gate does not advance the native engine or record successful trigger
progress. Scene-switch events never bypass connection admission.

One-shot cutscene starts, one-shot triggers and completed cutscenes are stored in
optional `journey.storytelling` progress metadata, keyed by stable scene and
cutscene/trigger IDs. These facts survive scene revisits and portable story
save/restore. Capturing a complete scenario promotes current progress into the
optional `storytelling.progress` template; launching that captured pack restores
those facts into the new journey. Authored draft previews do not change them.
They do not duplicate gameplay resources or quest ownership.
Preview playbacks have no journey and retain no progress facts. Explicit Play and
Replay remain available even after a one-shot automatic event has been recorded.

Within one automatic event chain, repeated scene connections and cutscene starts
are stopped with a visible message. This bounds self-replaying completion events
and scene-event cycles. Explicit Play, Replay or cancelling a pending transition
starts a new chain. An elapsed call admits at most 60 seconds; the browser supplies
its existing capped frame delta.

For a story crossing worlds, add the destination world and scene to the same
pack, create a source-scene connection targeting that scene, and put
`{ "type": "scene-switch", "connectionId": "journey-next" }` in the source
cutscene's `onFinish`. Add a storyboard shot for the source cutscene and a shot
for the destination scene or its own cutscene. Each native scene owner keeps its
own dormant checkpoint; all worlds share the pack's complete authored catalogs.
Worlds outside the pack are not silently loaded.

Bounds are explicit: 64 cutscenes, 128 tracks per cutscene, 256 keys per track,
16,384 keys in total, 64 cues, 16 preset animations per cutscene, 32 storyboards
and 128 shots per storyboard. Scene triggers are limited to 32 per scene.
Descriptor-safe JSON preflight rejects functions, accessors, unsafe keys,
nonfinite values and oversized data before authoring reads IDs or changes a
revision. Invalid edits preserve the complete draft and its undo history.
