class_name TrackCanvasOverlayRenderer
extends RefCounted
## Thin host adapter for TrackCanvas' cache and detached presentation state.
## Drawing calculations live in TrackCanvasOverlays; this class owns no state.

static func build_surface_geometry(host: TrackCanvas) -> void:
	if host._surface_geometry == host.geometry:
		return
	host._surface_geometry = host.geometry
	host._surface_segments.clear()
	host.surface_geometry_builds += 1
	host._surface_segments = TrackCanvasOverlays.surface_geometry(host.geometry)


static func draw_surface(host: TrackCanvas, target: Control) -> void:
	if not host.show_surface or host.visual_source == null or host.geometry == null:
		return
	var values = host.visual_source.surface_values(host.surface_channel)
	if values.is_empty():
		return
	build_surface_geometry(host)
	TrackCanvasOverlays.paint_surface(
		target,
		host._surface_segments,
		values,
		host.surface_channel,
		host.inspected_fraction,
		host.geometry,
		host.zoom,
		host._surface_legend_style,
		Callable(host, "screen")
	)


static func draw_profile(host: TrackCanvas) -> void:
	TrackCanvasOverlays.paint_profile(host, host.geometry, host.size)


static func draw_cars(host: TrackCanvas, target: Control) -> void:
	TrackCanvasOverlays.paint_cars(
		target,
		host.geometry,
		host.preview_running and host.visual_source == null,
		host.preview_distance,
		host.visual_frame,
		host.zoom,
		host.dot_scale,
		host.show_labels,
		host.size,
		host._car_label_style,
		Callable(host, "screen")
	)
