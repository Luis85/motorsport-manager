class_name BattleOverlay
extends Control
## Paired outlines and text only. Uses physical projected positions, never screen-distance collisions.
var canvas: TrackCanvas
var enabled = true

func _ready() -> void:
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	set_anchors_and_offsets_preset(Control.PRESET_FULL_RECT)
	clip_contents = true

func _process(_delta: float) -> void:
	queue_redraw()

func _draw() -> void:
	if not enabled or canvas == null or not canvas.sim is StrategyRaceSim: return
	var sim: StrategyRaceSim = canvas.sim
	if sim.phase != "race": return
	var id = sim.selected_id; var record = sim.battle_state.drivers[id]
	# A defending selected driver can share the outline of the approaching contest.
	if record.target_id < 0:
		for candidate in sim.battle_state.drivers:
			if candidate.target_id == id and candidate.phase not in ["recover", "resolve"]: record = candidate; break
	if record.target_id < 0: return
	var first = sim.cars[int(record.driver_id)]; var second = sim.cars[int(record.target_id)]
	if first.route != "track" or second.route != "track" or first.dnf or second.dnf: return
	for car in [first, second]:
		var point = canvas.screen(sim.car_position(car).p)
		draw_arc(point, 15, 0, TAU, 32, UI.ACCENT, 2, true)
		draw_line(point + Vector2(-6, 19), point + Vector2(6, 19), UI.ACCENT, 2, true)
	var caption = "%s / %s · %s" % [first.short, second.short, str(record.phase).capitalize()]
	var rect = Rect2(Vector2(10, 10), Vector2(minf(310, size.x - 20), 46))
	draw_style_box(UI.box(UI.PANEL, UI.LINE, 5, 7), rect)
	draw_string(ThemeDB.fallback_font, rect.position + Vector2(8, 17), caption, HORIZONTAL_ALIGNMENT_LEFT, rect.size.x - 16, 12, UI.INK)
	draw_string(ThemeDB.fallback_font, rect.position + Vector2(8, 34), "Paired contest · physical movement", HORIZONTAL_ALIGNMENT_LEFT, rect.size.x - 16, 10, UI.MUTED)
