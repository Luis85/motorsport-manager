class_name TrackCanvasState
extends Control
## Native 2D projection. Static track and moving cars are drawn on separate canvases.
signal sketch_changed
signal navigated
signal edit_cancelled
signal edit_started
signal edited
signal gesture_committed(observed_revision: int)
signal selection_changed
signal car_selected(id: int)
signal measured(metres: float)
var selection_kind = "road"
var selection_ids: Array[int] = []
var marquee_start = Vector2.INF
var marquee_end = Vector2.INF
var sketch = TrackSketch.new()
var sketch_preview: TrackGeometry
var stroke = PackedVector2Array()
var pen_anchor = Vector2.INF
var sketch_note = "Trace a new loop without altering the current circuit."
var show_surface = false
var world_layer: CircuitWorld
var layer_state = {
	"road": {"visible": true, "locked": false},
	"pits": {"visible": true, "locked": false},
	"scenery": {"visible": true, "locked": false},
	"features": {"visible": true, "locked": false},
	"reference": {"visible": true, "locked": false}
}
var reference_preview: TrackPreviewHandle
var draft_compiler: Callable
var preview_running = false
var preview_distance = 0.0
var preview_laps = 0
var preview_elapsed = 0.0
var dot_scale = 1.0
var rich_scenery = true
var selected_object = -1
var scenery_type = "tree"
var scenery_preset: Dictionary = {}
var diagnostics: Array = []
var gesture = TrackCanvasGesture.new()
var document_revision: int = 0
var surface_layer: SurfaceOverlay
var geometry: TrackGeometry
var document: Dictionary = {}
var visual_source: RaceVisualPort
var visual_frame: Dictionary = {}
var editing = false
var show_line = false
var show_labels = true
var show_grid = true
var show_profile = false
var surface_channel = "water"
var inspected_fraction = -1.0
var mode = "select"
var selected = -1
var selected_pit = -1
var zoom = 1.0
var fit_view_enabled = true
# Presentation padding; the editor and Engineering layout retain the original inset.
var fit_padding = Vector2(90, 110)
var center = Vector2.ZERO
var panning = false
var dragging: String:
	get:
		return gesture.kind
var last_mouse = Vector2.ZERO
var measure_start = Vector2.INF
var measure_end = Vector2.INF
var backdrop: Texture2D
var backdrop_key = ""
var overlay: CarOverlay
var visual_revision = 0
var surface_geometry_builds = 0
var _rebuild_due = false
var _rebuild_clock = 0.0
var _visual_stamp: Array = []
var _surface_geometry: TrackGeometry
var _surface_segments: Array = []
var _car_label_style = UI.box(Color("f5eedacc"), Color("b1bca280"), 3, 0)
var _surface_legend_style = UI.box(Color("f7f2e4ee"))


class CarOverlay:
	extends Control
	var host: TrackCanvas

	func _draw():
		if host != null:
			host.draw_cars(self)


class SurfaceOverlay:
	extends Control
	var host: TrackCanvas
	var clock = 0.0
	var stamp: Array = []

	func _process(delta):
		clock -= delta
		if host == null or clock > 0:
			return
		clock = 0.3
		var next = [
			host.show_surface,
			host.surface_channel,
			host.inspected_fraction,
			host.center,
			host.zoom,
			host.size,
			host.geometry
		]
		if host.show_surface and host.visual_source:
			next.append(host.visual_frame.get("total_time", 0.0))
		if next != stamp:
			stamp = next
			queue_redraw()

	func _draw():
		if host != null:
			host.draw_surface(self)


func configure_presentation(preferences: Dictionary) -> void:
	rich_scenery = preferences.get("scenery_detail", "rich") == "rich"
	dot_scale = float(preferences.get("dot_scale", 1.0))


func set_track(g: TrackGeometry, live_document: Dictionary = {}) -> void:
	# Replacement/undo/redo never retarget an in-flight pointer operation.
	gesture.reset()
	marquee_start = Vector2.INF
	marquee_end = Vector2.INF
	geometry = g if not live_document.is_empty() else g.detached_copy()
	if reference_preview:
		reference_preview.stop()
	preview_running = false
	_rebuild_due = false
	document = live_document if not live_document.is_empty() else geometry.document
	_load_backdrop()
	if world_layer:
		world_layer.configure(geometry, document, rich_scenery)
		world_layer.reference_texture = backdrop
		world_layer.reference_visible = editing and layer_visible("reference")
	queue_redraw()
	if overlay:
		overlay.queue_redraw()


func fit() -> void:
	fit_view_enabled = true
	if geometry == null or geometry.points.is_empty():
		return
	var visible_bounds = geometry.bounds
	for p in geometry.pit_points:
		visible_bounds = visible_bounds.expand(p)
	for marker in geometry.pit_markers():
		var station = geometry.pit_sample(geometry.pit_length * marker.fraction)
		var roof = station.p + station.n * 18
		visible_bounds = visible_bounds.expand(roof + Vector2(30, 30)).expand(
			roof - Vector2(30, 30)
		)
	visible_bounds = visible_bounds.grow(20)
	center = visible_bounds.get_center()
	zoom = minf(
		maxf(100, size.x - fit_padding.x) / maxf(20, visible_bounds.size.x),
		maxf(100, size.y - fit_padding.y) / maxf(20, visible_bounds.size.y)
	)
	zoom = clampf(zoom, 0.04, 12)
	queue_redraw()


func world(p: Vector2) -> Vector2:
	var v = (p - size * 0.5) / zoom
	return center + Vector2(v.x, -v.y)


func screen(p: Vector2) -> Vector2:
	var v = (p - center) * zoom
	return size * 0.5 + Vector2(v.x, -v.y)


func _load_backdrop() -> void:
	var key = str(document.get("reference", {}).get("png", ""))
	if key == backdrop_key:
		return
	backdrop_key = key
	backdrop = null
	if key.is_empty() or key.length() > 11000000:
		return
	var bytes = Marshalls.base64_to_raw(key)
	var image = Image.new()
	if image.load_png_from_buffer(bytes) == OK:
		backdrop = ImageTexture.create_from_image(image)


func _process(delta: float) -> void:
	if reference_preview:
		var preview_frame = reference_preview.capture()
		preview_running = preview_frame.running
		preview_distance = preview_frame.distance
		preview_elapsed = preview_frame.elapsed
		preview_laps = preview_frame.laps
	_rebuild_clock -= delta
	if _rebuild_due and _rebuild_clock <= 0 and document.get("nodes", []).size() >= 4:
		_rebuild_due = false
		_rebuild_clock = 0.06
		if draft_compiler.is_valid():
			var draft_geometry = draft_compiler.call(
				document, geometry.preset if geometry else "Formula", true
			)
			if draft_geometry:
				geometry = draft_geometry
		if world_layer:
			world_layer.configure(geometry, document, rich_scenery)
		queue_redraw()

	# The query port returns detached values; drawing cannot mutate the live aggregate.
	visual_frame = visual_source.capture() if visual_source != null else {}
	var stamp: Array = [
		center,
		zoom,
		size,
		show_labels,
		dot_scale,
		preview_running,
		preview_distance,
		geometry,
		visual_frame
	]
	if stamp != _visual_stamp:
		_visual_stamp = stamp
		visual_revision += 1
		if overlay:
			overlay.queue_redraw()


func layer_visible(key: String) -> bool:
	return not editing or layer_state.get(key, {}).get("visible", true)


func layer_editable(key: String) -> bool:
	return layer_visible(key) and not layer_state.get(key, {}).get("locked", false)


func tool_layer() -> String:
	return (
		{"pit": "pits", "scenery": "scenery", "select_objects": "scenery", "reference": "reference"}
		. get(mode, "road")
	)


func set_layer(key: String, field: String, value: bool) -> void:
	if not layer_state.has(key) or field not in ["visible", "locked"]:
		return
	call("_commit_drag")
	layer_state[key][field] = value
	selected = -1
	selected_pit = -1
	selected_object = -1
	selection_ids.clear()
	if world_layer:
		world_layer.road_visible = layer_visible("road")
		world_layer.pits_visible = layer_visible("pits")
		world_layer.scenery_visible = layer_visible("scenery")
		world_layer.features_visible = layer_visible("features")
		world_layer.reference_visible = editing and layer_visible("reference")
		world_layer.queue_redraw()
	selection_changed.emit()
	queue_redraw()


func toggle_preview() -> void:
	if reference_preview:
		reference_preview.toggle(geometry)
		preview_running = reference_preview.capture().running
	queue_redraw()
