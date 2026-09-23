# Interaction design contract

Applies to the native **0.4.0** weekend and circuit editor. Visual direction remains calm paper, racing green, muted brass and flat dot cars.

## Shared rules

Keep a clear distinction between observation, a reversible draft and an applied action. Selecting a driver, inspecting a tyre, switching a topic, opening help or reading a surface cell does not command the simulation. A live weekend continues unless the player explicitly pauses it. Repeated updates must not rebuild focused controls or overwrite typed drafts.

Primary commands stay outside scrollable detail content. Consequential replacement/discard operations ask for confirmation; routine pit-wall orders use a non-modal acknowledgement. Disabled actions have an understandable phase, ownership, inventory or validation reason. Color supplements text, not replaces it.

## Pit-wall information hierarchy

The fixed stage header owns session progression and simulation speed. The timing tower owns classification and selection. The map owns spatial observation and camera control. The right pit wall owns the selected driver's resources and commands.

The topic selector exposes **Commands, Telemetry, Radio, Tyres, Setup & handling, Track surface lab** without an overflowing tab strip. Tyres splits into **Allocation, Wheels, Stop plan**. Changing subtopics preserves the selected driver and model state. Expand details hides the timing tower and widens the inspector, but retains the map, primary actions and a visible way to collapse. This is a focused desktop layout, not a claim of mobile support.

### Setup transaction

1. Select a player driver in the garage or race preparation.
2. Edit one or more of the five fields. The form says adjustments are unapplied; fitted effects still describe the actual car.
3. Apply commits one validated batch. Revert copies the current actual setup back into the draft.
4. Switching to the teammate and back preserves each draft. Rival fields are inspect-only.
5. On-track mechanical changes are unavailable. Live front brake bias is a separate racing action, not an implicit Apply of the garage draft.

Drafts are UI-local and are not part of a weekend checkpoint. The guide and field hints explain when an adjustment becomes effective.

### Tyres and stop planning

Selecting an allocation card plans an actual set; it does not fit it. Cards distinguish fitted/planned/fresh/used and expose identity and wear. Wheel cards show a stable 2×2 arrangement with explicit FL/FR/RL/RR labels; selection reveals normalized pressure, load and retained damage. A puncture warning opens relevant detail without automatically pausing or switching a manually controlled car to delegation.

Scheduled stops target an integer racing lap and physical pit-entry gate. Invalid/past/too-close gates and unavailable replacement stock are rejected. Immediate Box can replace a future stop; Cancel works before entry. Once service starts, its selected set and repair choice are frozen. Delegated emergency recovery may advance its own future plan; manual strategy remains manual.

### Surface inspection

The laboratory displays distance along the lap horizontally and seven road strips vertically. Click selects a cell; arrow keys move the selection. A channel picker changes both the laboratory and map overlay. Locate focuses the corresponding actual track station. Units distinguish normalized concentrations, degrees Celsius and a grip multiplier. It is an observation tool, not a paintbrush for changing race conditions.

## Editor interaction hierarchy

Selection is the default. Use **V** for road selection and **S** for scenery selection. Shift-click adds/removes selection; dragging empty canvas makes a marquee. Selected groups expose contextual operations and precise values in Point & selection. Panning/zooming does not change authored data. Text fields keep text-editing shortcuts.

Moving a selection starts history on actual movement, not on mouse down. Release commits once, and Escape restores the pre-gesture document and redo state. Multiple-selection transformations are transactional: an invalid result does not partly modify the selection. Road plan transforms move nodes and tangent handles without silently changing road width/elevation. Group/duplicate operate on scenery rather than duplicating road topology.

### Sketch transaction

**Freehand trace [D]** and **Pen trace** create connected strokes in a separate temporary workspace. Close loop is explicit. Preview constructs a candidate with the selected simplification, smoothing and width and runs the shared diagnostics. Existing track data remains unchanged. Editing the committed document invalidates that candidate.

Replace names its consequences before confirmation: retain scenery/reference/style, replace the road and clear obsolete pit, feature and timing attachments. Cancel preserves both the old circuit and the draft. A successful replacement is one document-level undo step. Drawing Undo/Redo affects strokes/closure while drawing; it does not unexpectedly undo an unrelated circuit edit.

An unapplied trace blocks Test weekend and runtime export, is marked unsaved, and is protected by discard confirmation. Saving/exporting committed authoring data does not persist the transient trace. This limitation is visible rather than silently treating a preview as saved work.

### Contextual guides

Editor guide and Pit-wall guide are dismissible, restartable and resumable from local settings. Each step reveals and outlines a real target. Guides use no synthetic rewards and issue no driving or authoring commands. A guide on a running weekend does not automatically pause it. Progress validation ignores malformed stored step values.

## Verification scope

Native UI tests exercise mouse presses/motions, marquee/Shift selection, group drag/Escape, duplicate, trace preview/replacement/cancel, staged setup, per-driver draft retention, wheel-card stability, surface selection, guide resumption and small-window reachability. Screenshots at 1440×900 and 1100×720 accompany assertions. This is not a screen-reader certification, formal accessibility audit or exhaustive human usability study. See [verification](verification.md).

**Trace action placement:** Preview road and Replace road remain outside the scrollable inspector at both tested desktop sizes. Closed-loop state is explicit; a closed loop cannot be accidentally closed again to invalidate its preview. The action controls retain identity through inspector rebuilds.
