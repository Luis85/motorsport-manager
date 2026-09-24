class_name RejoinOverlay
extends Control
## Presentation-only uncertainty at the fixed pit exit. Never moves authoritative cars.
var canvas: TrackCanvas
var forecast: Dictionary = {}
var enabled = true
var stamp: Array = []
var caption_style = UI.box(UI.CARD, UI.LINE, 5, 6)

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	clip_contents = true

func _process(_delta: float) -> void:
	if canvas == null: return
	# The exit band is fixed geometry, not another moving car. Validity is rechecked on draw.
	var next: Array = [enabled, canvas.center, canvas.zoom, canvas.size, forecast.get("key", ""), forecast.get("time", -1)]
	if canvas.sim:
		next.append([canvas.sim.phase, canvas.sim.selected_id, canvas.sim.total_time - float(forecast.get("time", 0)) > RaceForecaster.MAX_AGE])
	if next != stamp: stamp = next; queue_redraw()

func _draw() -> void:
	if not enabled or canvas == null or canvas.sim == null or forecast.is_empty(): return
	var sim = canvas.sim
	if sim.phase != "race" or sim.cars[forecast.driver_id].route != "track" or sim.cars[forecast.driver_id].finished or sim.cars[forecast.driver_id].dnf: return
	var current = sim is StrategyRaceSim and not RaceForecaster.stale(sim, forecast, int(sim.policy(forecast.driver_id).revision))
	if not current: return
	var pit = forecast.pit
	var centre = canvas.screen(sim.track.sample(sim.track.pit_exit).p)
	var half_band = minf(sim.track.length * 0.04, sim.track.length / sim.track.estimate * (pit.visit_high - pit.visit_low) * 0.5)
	var points = PackedVector2Array()
	for i in range(25): points.append(canvas.screen(sim.track.sample(sim.track.pit_exit - half_band + half_band * 2 * i / 24.0).p))
	draw_polyline(points, Color(0.75, 0.58, 0.25, 0.36), 14.0, true)
	draw_arc(centre, 11, 0, TAU, 32, UI.ACCENT, 2.0, true)
	var label = "%s REJOIN ~P%d–%d" % [sim.cars[forecast.driver_id].short, pit.position_low, pit.position_high]
	var position = Vector2(clampf(centre.x + 16, 8, maxf(8, size.x - 200)), clampf(centre.y - 18, 30, maxf(30, size.y - 48)))
	draw_style_box(caption_style, Rect2(position - Vector2(6, 18), Vector2(204, 44)))
	draw_string(ThemeDB.fallback_font, position, label, HORIZONTAL_ALIGNMENT_LEFT, 195, 12, UI.INK)
	draw_string(ThemeDB.fallback_font, position + Vector2(0, 17), "Fixed exit · uncertain traffic timing", HORIZONTAL_ALIGNMENT_LEFT, 195, 10, UI.MUTED)
