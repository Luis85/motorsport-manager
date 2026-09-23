# Circuit Atelier — native editor

## Editing model

Road geometry is a closed sequence of cubic Bézier segments. A point has position, relative incoming/outgoing handles, width, height, and banking. Explicit handles make a tight chicane or hairpin editable without global smoothing unexpectedly moving nearby corners. Imported automatic Circuit Atelier handles are reconstructed using its centripetal Catmull–Rom conversion. **Insert point** uses de Casteljau subdivision, preserving the original cubic; **Smooth** is a deliberate shape-changing operation.

| Tool/action | Behavior |
|---|---|
| Select / move | Select and drag a road point or one of its handles |
| Insert point / double click | Insert on the nearest sampled road segment with exact cubic splitting |
| Draw points | Append authored points to the closed sequence |
| Edit pit lane | Select/drag pit control points; use its inspector for exact coordinates |
| Set start / finish | Place the timing origin on the nearest road station |
| Place scenery | Add the selected scenery type at the clicked world coordinate |
| Measure | Click two positions and read their distance in metres |
| Move reference | Drag the embedded reference independently of the road |
| Ctrl while dragging | Snap to the 5 m grid |
| Right/middle drag, wheel, F | Pan, cursor-centered zoom, fit circuit |
| Ctrl+Z, Ctrl+Y, Ctrl+S, Delete | Undo, redo, save, delete selected road point |

At least four points must remain. Keyboard editing shortcuts do not intercept text-field input. Undo/redo covers document-changing editor actions and reference settings; camera movements are not document history.

## Inspectors

**Point** exposes position in metres, elevation, width, banking, aligned/free handle mode, smooth/sharp, split and delete. Height and banking survive export and affect the simplified driving limits. The display remains top-down; the optional elevation profile helps inspect grade continuity.

**Track** exposes name, vehicle preview preset, start fraction, pit entry/exit, limiter, generated pit lane, and validation feedback. The live status reports length and the selected preset's reference lap estimate. These estimates are not real-world benchmark times.

**Features** places range-based curbs, runoff, barriers, tunnels, and bridges. Their side, span, dimensions, and clearance are retained in the document. Top-down annotations are shown. Tunnel/bridge geometry is not a navigable 3D structure or a certified clearance calculation. Existing source scenery is preserved and rendered. Scenery types can be placed, selected and dragged; the Point inspector exposes position, rotation, scale and deletion. Flat scenery groups and multi-selection are implemented; vehicle collision bodies are not.

**Reference** imports PNG/JPG and embeds a bounded PNG in the authoring document. The importer resizes large images to a maximum 2048-pixel edge. Adjust world width, position, and opacity, or drag with Move reference. For calibration, measure a known span, enter its actual distance and choose **Calibrate from ruler**. The image is scaled around the first measurement point without moving the road. There is no network imagery or built-in georeferencing service.

## Pits and start direction

The node sequence establishes driving direction. Start/finish rotates timing origin without reversing geometry. Pit entry and exit are absolute fractions along the authoring curve. A pit route can cross the timing origin; compilation unwraps its equivalent track progress monotonically. The actual lane is a separate polyline with a limiter and service boxes, not a timed disappearance of the car.

Absent pit data generates a usable service lane and a visible warning. Use **Generate service lane** and then edit its control points before considering a custom layout finished. Road width, grid length, pit joins, and scenery clearance still need visual review; current validation does not certify every overlap or self-intersection.

## Files and library

**Save to library** writes a local custom track. Saving an edited built-in creates a copy and never modifies the packaged catalog. **Export JSON** produces editable native authoring data. **Import JSON** accepts native authoring and supported Circuit Atelier projects. **Bake runtime** exports sampled geometry, line/speed data, pits, timing, grid and metadata; that file is intended for a consumer, not round-tripping into the authoring importer.

The editor shows saved/unsaved state and asks before discarding. **Test weekend** preserves a draft in memory while a separate snapshot is raced. Use **Return to editor** to continue; closing the app still requires saving the document to persist it.

## Iteration-two interaction additions

Select/move is still the default. `V`, `I`, `P`, and `M` select move, insertion, pit editing, and measurement. Arrow keys nudge a selected road point by 0.5 m; Shift changes that to 5 m. Text fields retain keyboard input. A click alone does not create history or discard redo. Pointer movement starts one transaction; release commits, and Escape cancels it. Coalesced drag previews do not run the racing-line solver; the final release restores a full bake. Manual camera navigation does not edit the document.

**Reference calibration:** import a permitted image, choose Measure, click two known points, enter their real-world distance in Reference and apply calibration. The first ruler point stays anchored while image width/center are scaled. Road nodes are not transformed. Reference movement remains an explicit mode so ordinary road selection cannot accidentally drag the image.

**Scenery:** choose a type in Features, then click to place. Return to Select/move to drag it; Point exposes position, rotation, scale and Delete. These objects do not act as vehicle collision bodies.

**Timing:** select a road point and use Track → Set S1/S2. Two distinct boundaries are compiled relative to the start/finish origin. Invalid boundaries produce a warning and fall back to thirds.

**Checks:** inspect clickable findings for sampled self-crossings, height separation, pit alignment and very tight turns. A same-level road crossing blocks Test Weekend and runtime export until corrected. Saving a structurally valid draft remains possible. A grade-separated crossing is reported for review, not treated as proof of bridge/tunnel clearance.

## World and reference lap

The **World** inspector selects an illustrative environment and summer/autumn palette, with undoable document changes that do not alter geometry. Road, pits, scenery, features and reference have workspace-local visibility and lock switches. Locked/hidden layers reject direct edits and relevant inspector actions; camera navigation remains available. These switches are not saved in the track document.

**Preview lap** runs a dot along the full baked line/speed envelope without entering a weekend. Geometric edits stop it; the coalesced drag preview is never used as a valid driving profile. This is a heuristic reference, not a traffic/tyre simulation. Grid visibility is independent. New Tent and Cafe scenery types use the same placement/move/rotate/scale workflow as existing props. See [Graphics](graphics.md).

## Multi-selection and trace authoring (0.4)

The inspector uses a topic selector rather than an overflowing tab strip. Use V for road selection, S for scenery selection, Shift-click to extend and empty-space drag for marquee. Context actions expose duplicate/group/ungroup/alignment/delete; Point & selection provides precise rotation, scale and distribution. Group/duplicate apply to scenery. Planar road transforms include handles but retain width/elevation. Invalid edits reject atomically, and each drag has one undo step with Escape rollback.

Use D for Freehand trace or choose Pen trace. Consecutive strokes must connect. Close explicitly, adjust simplification/smoothing and preview the candidate. Only a valid current preview can replace the road, after confirmation. Replacement retains scenery/reference/style and clears obsolete pits/features/timing attachments; one undo restores everything. The original circuit is unchanged before confirmation.

Drawing Undo/Redo targets strokes and closure while drawing. Changes to committed geometry invalidate preview. Unapplied traces block Test weekend/runtime export and are protected by discard/clear confirmation. They remain temporary: Save/Export write committed track data, not the prototype's serialized sketch workspace. Apply or clear a trace before driving. Editor guide can be dismissed, restarted and resumed from its saved step. See [interaction design](interaction-design.md).

**Trace action placement:** Preview road and Replace road remain outside the scrollable inspector at both tested desktop sizes. Closed-loop state is explicit; a closed loop cannot be accidentally closed again to invalidate its preview. The action controls retain identity through inspector rebuilds.
