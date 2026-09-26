class_name BattleOverlay
extends Control
## Paired outlines and text only. Uses physical projected positions, never screen-distance collisions.
var canvas: TrackCanvas
var enabled = true
var stamp: Array = []
var text_scale = 1.0
var caption_style = UI.box(UI.PANEL, UI.LINE, 5, 7)

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	clip_contents = true
	# Resolve at runtime: this script is also loaded before autoloads by tests.
	var application = get_tree().root.get_node_or_null("App")
	if application != null: text_scale = float(application.settings.get("pitwall_text_scale", 1.0))

func _process(_delta: float) -> void:
	if canvas == null: return
	var next: Array = [enabled, canvas.visual_revision, text_scale]
	if canvas.sim is StrategyRaceSim:
		next.append([canvas.sim.phase, canvas.sim.selected_id])
		for record in canvas.sim.battle_state.drivers: next.append([record.phase, record.target_id])
		for car in canvas.sim.cars: next.append([car.route, car.dnf, car.finished])
	if next != stamp: stamp = next; queue_redraw()

func _draw() -> void:
	if not enabled or canvas == null or not canvas.sim is StrategyRaceSim: return
	var sim: StrategyRaceSim = canvas.sim
	if sim.phase != "race": return
	var record = RaceContestReadModel.observed_contest(sim, sim.selected_id)
	if record.is_empty(): return
	var first = sim.cars[int(record.driver_id)]; var second = sim.cars[int(record.target_id)]
	for car in [first, second]:
		var point = canvas.screen(sim.car_position(car).p)
		draw_arc(point, 15, 0, TAU, 32, UI.ACCENT, 2, true)
		draw_line(point + Vector2(-6, 19), point + Vector2(6, 19), UI.ACCENT, 2, true)
	var caption = "%s / %s · %s" % [first.short, second.short, str(record.phase).capitalize()]
	var rect = Rect2(Vector2(10, 10), Vector2(minf(310 * text_scale, size.x - 20), 46 * text_scale))
	draw_style_box(caption_style, rect)
	draw_string(ThemeDB.fallback_font, rect.position + Vector2(8, 17) * text_scale, caption, HORIZONTAL_ALIGNMENT_LEFT, rect.size.x - 16, ceili(12 * text_scale), UI.INK)
	draw_string(ThemeDB.fallback_font, rect.position + Vector2(8, 34) * text_scale, "Paired contest · physical movement", HORIZONTAL_ALIGNMENT_LEFT, rect.size.x - 16, ceili(10 * text_scale), UI.MUTED)
