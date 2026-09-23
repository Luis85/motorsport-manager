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
| Place scenery | Add a tree at the clicked world coordinate |
| Measure | Click two positions and read their distance in metres |
| Move reference | Drag the embedded reference independently of the road |
| Ctrl while dragging | Snap to the 5 m grid |
| Right/middle drag, wheel, F | Pan, cursor-centered zoom, fit circuit |
| Ctrl+Z, Ctrl+Y, Ctrl+S, Delete | Undo, redo, save, delete selected road point |

At least four points must remain. Keyboard editing shortcuts do not intercept text-field input. Undo/redo covers document-changing editor actions and reference settings; camera movements are not document history.

## Inspectors

**Point** exposes position in metres, elevation, width, banking, aligned/free handle mode, smooth/sharp, split and delete. Height and banking survive export and affect the simplified driving limits. The display remains top-down; the optional elevation profile helps inspect grade continuity.

**Track** exposes name, vehicle preview preset, start fraction, pit entry/exit, limiter, generated pit lane, and validation feedback. The live status reports length and the selected preset's reference lap estimate. These estimates are not real-world benchmark times.

**Features** places range-based curbs, runoff, barriers, tunnels, and bridges. Their side, span, dimensions, and clearance are retained in the document. Top-down annotations are shown. Tunnel/bridge geometry is not a navigable 3D structure or a certified clearance calculation. Existing source scenery is preserved and rendered; only simple tree placement and last-object removal are currently exposed, not a full prop-transform workbench.

**Reference** imports PNG/JPG and embeds a bounded PNG in the authoring document. The importer resizes large images to a maximum 2048-pixel edge. Adjust world width, position, and opacity, or drag with Move reference. For calibration, measure a known span, then set `new image width = current width × actual span / measured span`. There is no network imagery or built-in georeferencing service.

## Pits and start direction

The node sequence establishes driving direction. Start/finish rotates timing origin without reversing geometry. Pit entry and exit are absolute fractions along the authoring curve. A pit route can cross the timing origin; compilation unwraps its equivalent track progress monotonically. The actual lane is a separate polyline with a limiter and service boxes, not a timed disappearance of the car.

Absent pit data generates a usable service lane and a visible warning. Use **Generate pit lane** and then edit its control points before considering a custom layout finished. Road width, grid length, pit joins, and scenery clearance still need visual review; current validation does not certify every overlap or self-intersection.

## Files and library

**Save to library** writes a local custom track. Saving an edited built-in creates a copy and never modifies the packaged catalog. **Export JSON** produces editable native authoring data. **Import JSON** accepts native authoring and supported Circuit Atelier projects. **Bake runtime** exports sampled geometry, line/speed data, pits, timing, grid and metadata; that file is intended for a consumer, not round-tripping into the authoring importer.

The editor shows saved/unsaved state and asks before discarding. **Test weekend** preserves a draft in memory while a separate snapshot is raced. Use **Return to editor** to continue; closing the app still requires saving the document to persist it.
