class_name SurfaceLab
extends VBoxContainer
## Clickable observation surface. Inspecting cells never advances or rewrites the model.
var sim: RaceSim
var canvas: TrackCanvas
var chart: FieldChart
var details: Label
var picker: OptionButton
var channel = "water"
var station = 0
var lane = 3
var timer = 0.0

func _ready() -> void:
	add_child(UI.label("TRACK SURFACE LAB", 14, UI.ACCENT))
	var caption = UI.paragraph("Click a cell · distance across, road width down."); caption.add_theme_font_size_override("font_size", 12); add_child(caption)
	picker = UI.option(["Water", "Rubber", "Grip", "Dust", "Marbles", "Oil", "Debris", "Temperature"], func(index):
		channel = ["water", "rubber", "grip", "dust", "marbles", "oil", "debris", "temperature"][index]
		chart.channel = channel; canvas.surface_channel = channel; chart.queue_redraw(); refresh())
	add_child(picker)
	chart = FieldChart.new(); chart.model = sim
	chart.chosen.connect(func(i, j): station = i; lane = j; refresh())
	add_child(chart)
	details = UI.paragraph(""); details.add_theme_font_size_override("font_size", 12); add_child(details)
	add_child(UI.button("Locate this section", func():
		canvas.center = sim.track.sample((station + 0.5) * sim.track.length / RaceSurface.STATIONS).p
		canvas.navigated.emit(); canvas.inspected_fraction = (station + 0.5) / RaceSurface.STATIONS; canvas.show_surface = true; canvas.queue_redraw()))
	add_child(UI.paragraph("Water, rubber and contamination are normalized 0–100% concentrations. Grip is a multiplier. This is a management simulation, not a fluid or track-safety model."))
	refresh()

func _process(delta: float) -> void:
	if not is_visible_in_tree(): return
	timer -= delta
	if timer <= 0: timer = 0.3; refresh()

func refresh() -> void:
	if not details or sim == null: return
	var s = sim.surface[station].lanes[lane]
	details.text = "STATION %d / %d · STRIP %d / 7\n%.0f m into lap\nWater %.1f%% · Rubber %.1f%%\nDust %.1f%% · Marbles %.1f%%\nOil %.1f%% · Debris %.1f%%\nSurface %.1f°C · Grip %.3f×" % [station + 1, RaceSurface.STATIONS, lane + 1, (station + 0.5) * sim.track.length / RaceSurface.STATIONS, s.water * 100, s.rubber * 100, s.dust * 100, s.marbles * 100, s.oil * 100, s.debris * 100, s.temperature, RaceSurface.grip(s)]
	chart.station = station; chart.lane = lane; chart.queue_redraw()

class FieldChart extends Control:
	signal chosen(station: int, lane: int)
	var model: RaceSim
	var channel = "water"
	var station = 0
	var lane = 3
	func _ready() -> void:
		custom_minimum_size = Vector2(250, 150); mouse_default_cursor_shape = Control.CURSOR_CROSS; focus_mode = Control.FOCUS_ALL
	func field_rect() -> Rect2: return Rect2(8, 25, maxf(1, size.x - 16), 98)
	func _draw() -> void:
		draw_style_box(UI.box(UI.BG), Rect2(Vector2.ZERO, size))
		if model == null: return
		var rect = field_rect(); var cell = Vector2(rect.size.x / RaceSurface.STATIONS, rect.size.y / RaceSurface.LANES)
		for i in range(RaceSurface.STATIONS):
			for j in range(RaceSurface.LANES):
				var s = model.surface[i].lanes[j]
				var value = RaceSurface.grip(s) / 1.14 if channel == "grip" else (s.temperature / 60 if channel == "temperature" else s[channel])
				var ink = Color("4d8b9d") if channel == "water" else (Color("54805e") if channel == "grip" else Color("a27a43"))
				draw_rect(Rect2(rect.position + Vector2(i, j) * cell, cell + Vector2(0.3, 0)), UI.CARD.lerp(ink, clampf(value, 0, 1)))
		for j in range(1, RaceSurface.LANES):
			draw_line(rect.position + Vector2(0, j * cell.y), rect.position + Vector2(rect.size.x, j * cell.y), Color(UI.INK, 0.18), 1)
		if has_focus(): draw_style_box(UI.box(Color(0, 0, 0, 0), UI.ACCENT, 4, 0), Rect2(Vector2.ZERO, size))
		draw_rect(Rect2(rect.position + Vector2(station, lane) * cell, cell), UI.INK, false, 2)
		draw_string(ThemeDB.fallback_font, Vector2(8, 17), channel.to_upper() + (" · 0–1.14×" if channel == "grip" else " · 0–60°C" if channel == "temperature" else " · 0–100%"), HORIZONTAL_ALIGNMENT_LEFT, -1, 11, UI.MUTED)
		draw_string(ThemeDB.fallback_font, Vector2(8, 141), "START / FINISH                         ONE LAP →", HORIZONTAL_ALIGNMENT_LEFT, size.x - 16, 10, UI.MUTED)
	func _gui_input(event: InputEvent) -> void:
		if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT and field_rect().has_point(event.position):
			var at = (event.position - field_rect().position) / field_rect().size
			station = clampi(int(at.x * RaceSurface.STATIONS), 0, RaceSurface.STATIONS - 1); lane = clampi(int(at.y * RaceSurface.LANES), 0, RaceSurface.LANES - 1)
			grab_focus(); chosen.emit(station, lane); accept_event()
		if event is InputEventKey and event.pressed:
			var direction = {KEY_LEFT: Vector2i(-1, 0), KEY_RIGHT: Vector2i(1, 0), KEY_UP: Vector2i(0, -1), KEY_DOWN: Vector2i(0, 1)}.get(event.keycode, Vector2i.ZERO)
			if direction != Vector2i.ZERO:
				station = posmod(station + direction.x, RaceSurface.STATIONS); lane = clampi(lane + direction.y, 0, RaceSurface.LANES - 1)
				chosen.emit(station, lane); accept_event()
