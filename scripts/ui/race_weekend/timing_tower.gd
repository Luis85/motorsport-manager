class_name RaceTimingTower
extends PanelContainer
## Persistent classification rows. This component only emits selection intent.
signal driver_selected(id: int)
var model: RaceViewQuery
var tower: Tree
var rows: Dictionary = {}
var rank_rows: Array[TreeItem] = []
var rendered_rows: Dictionary = {}
var update_count = 0

func configure(value: RaceViewQuery) -> void: model = value

func _ready() -> void:
	add_theme_stylebox_override("panel", UI.box(PitwallDesign.RACE_DARK_2, GameTheme.LINE, 5, 6))
	custom_minimum_size.x = PitwallDesign.TIMING_WIDTH
	var timing = UI.vbox(self, true)
	timing.add_child(UI.race_label("LIVE CLASSIFICATION", 12, true))
	tower = Tree.new(); tower.select_mode = Tree.SELECT_ROW; tower.columns = 5; tower.hide_root = true; tower.hide_folding = true
	tower.column_titles_visible = true; tower.size_flags_vertical = Control.SIZE_EXPAND_FILL
	tower.add_theme_font_size_override("font_size", 12); tower.add_theme_font_size_override("title_button_font_size", 10)
	tower.add_theme_constant_override("v_separation", 4); tower.add_theme_constant_override("indent", 0)
	tower.add_theme_stylebox_override("panel", UI.box(UI.RACE_DARK, GameTheme.LINE, 4, 2))
	tower.add_theme_color_override("font_color", GameTheme.TEXT)
	tower.add_theme_color_override("font_selected_color", GameTheme.TEXT)
	tower.add_theme_color_override("title_button_color", UI.GOLD)
	tower.add_theme_stylebox_override("title_button_normal", UI.box(UI.RACE_DARK_3, GameTheme.LINE, 2, 3))
	tower.add_theme_stylebox_override("title_button_hover", UI.box(GameTheme.RAISED, UI.GOLD, 2, 3))
	tower.add_theme_stylebox_override("title_button_pressed", UI.box(GameTheme.RAISED, UI.GOLD, 2, 3))
	for i in range(5):
		tower.set_column_title(i, ["P", "CAR", "GAP / LAP", "TYRE", "STATE"][i]); tower.set_column_expand(i, false)
		tower.set_column_custom_minimum_width(i, [26, 42, 67, 28, 37][i])
	tower.item_selected.connect(func():
		var item = tower.get_selected()
		if item: driver_selected.emit(int(item.get_metadata(0))))
	timing.add_child(tower)
	var root_item = tower.create_item()
	for i in range(model.car_count): rank_rows.append(tower.create_item(root_item))
	var legend = UI.race_label("* Your team   |   ~ Estimated gap", 11); legend.tooltip_text = "Qualifying: OUT → HOT → IN → BOX. Only timed hot laps set the grid."; timing.add_child(legend)
	tower.accessibility_name = "Live classification; select a driver to inspect"

func present() -> Array:
	var q = model.phase in ["practice", "practice_results", "qualifying", "qualifying_results"]
	var order = model.standings(q)
	if order.is_empty(): return order
	var leader = order[0]
	rows.clear(); tower.set_block_signals(true)
	for i in range(order.size()):
		var car = order[i]; var row = rank_rows[i]; rows[car.id] = row
		var text = "LEADER" if i == 0 else "~+%.1fs" % [maxf(0, leader.distance - car.distance) / maxf(15, car.speed)]
		if q: text = RaceViewQuery.format_time(car.qual_best)
		elif car.dnf: text = "DNF"
		elif model.phase in ["briefing", "race_preparation", "formation", "grid_ready", "lights"]: text = "GRID %d" % car.grid
		elif car.finished:
			text = "WINNER" if i == 0 else ("+%d L" % (leader.completed - car.completed) if car.completed < leader.completed else "+%.3f" % (car.finish_time - leader.finish_time))
		elif leader.distance - car.distance >= model.track.length: text = "+%d L" % int((leader.distance - car.distance) / model.track.length)
		var state = "DNF" if car.dnf else ("FIN" if car.finished else ("PIT" if car.route == "pit" else ({"garage": "BOX", "outlap": "OUT", "hotlap": "HOT", "inlap": "IN"}.get(car.qual_state, "") if q else ("BLUE" if car.blue else "%d%%" % car.tyre))))
		var tooltip = "%s · %s\n%s\nTyres %.0f%% · %s\nBest %s" % [car.name, car.team, car.intent, car.tyre, car.compound, RaceViewQuery.format_time(car.qual_best if q else car.best_lap)]
		var appearance = [car.id, text, car.compound, state, tooltip, car.id == model.selected_id]
		if rendered_rows.get(i) != appearance:
			rendered_rows[i] = appearance; update_count += 1
			row.set_text(0, str(i + 1)); row.set_text(1, car.short + ("*" if car.player else "")); row.set_metadata(0, car.id)
			row.set_text(2, text); row.set_text(3, car.compound); row.set_text(4, state)
			row.set_custom_color(4, UI.ACCENT if state == "HOT" else (UI.DANGER if car.dnf else UI.MUTED))
			for column in range(5):
				row.set_tooltip_text(column, tooltip)
				row.set_custom_bg_color(column, GameTheme.SELECTED if car.id == model.selected_id else (GameTheme.RAISED if car.player else UI.RACE_DARK))
				row.set_custom_color(column, GameTheme.TEXT if car.id == model.selected_id else (GameTheme.TEXT if column != 4 else (UI.GOLD if state == "HOT" else (GameTheme.DANGER if car.dnf else GameTheme.MUTED))))
		if car.id == model.selected_id and not row.is_selected(0): row.select(0)
	tower.set_block_signals(false)
	return order
