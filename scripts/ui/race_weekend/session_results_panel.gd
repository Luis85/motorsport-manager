class_name SessionResultsPanel
extends VBoxContainer
## Observational, stable results with distinct qualifying, practice and race semantics.
var model: RaceSim
var classification: Tree
var summary: Label
var heading: Label
var rows: Array[TreeItem] = []
var rendered: Array = []
var rebuild_count = 0

func configure(value: RaceSim) -> void:
	model = value

func _ready() -> void:
	add_theme_constant_override("separation", 8)
	heading = UI.label("SESSION RESULTS", 18, UI.ACCENT); add_child(heading)
	summary = UI.paragraph(""); add_child(summary)
	classification = Tree.new(); classification.columns = 6; classification.hide_root = true; classification.column_titles_visible = true
	classification.custom_minimum_size = Vector2(250, 360)
	classification.size_flags_vertical = Control.SIZE_EXPAND_FILL; add_child(classification)
	var root_item = classification.create_item()
	for car in model.cars: rows.append(classification.create_item(root_item))
	resized.connect(_layout_columns)
	refresh()

static func presentation(sim: RaceSim) -> Dictionary:
	var mode = "race" if sim.phase == "results" else ("qualifying" if sim.phase == "qualifying_results" else ("practice" if sim.phase == "practice_results" else "pending"))
	var data: Array = []
	var titles = ["POS", "DRIVER", "RESULT", "LAPS", "PITS", "BEST"]
	if mode == "pending":
		return {"mode": mode, "titles": titles, "rows": data, "summary": "The current session is not final. Live timing remains in Race view; final classification appears after the session completes."}
	var order = sim.standings(mode == "qualifying")
	if mode == "practice": titles = ["—", "DRIVER", "BEST LAP", "SAMPLES", "RUNS", "STATUS"]
	if mode == "qualifying": titles = ["POS", "DRIVER", "BEST LAP", "GAP", "LAPS", "STATUS"]
	for i in range(order.size()):
		var car = order[i]; var text: Array = []
		if mode == "qualifying":
			var valid = car.qual_best > 0
			var gap = ("POLE" if i == 0 else "+%.3f" % (car.qual_best - order[0].qual_best)) if valid else "—"
			text = [str(i + 1) if valid else "—", car.short, RaceSim.format_time(car.qual_best), gap, str(car.qual_laps), "TIMED" if valid else "NO TIME"]
		elif mode == "practice":
			var samples: Array = []; var runs: Array = []
			if sim is PracticeRaceSim: runs = sim.practice_driver(int(car.id)).runs
			for run in runs:
				for sample in run.samples:
					if float(sample.get("seconds", 0)) > 0: samples.append(float(sample.seconds))
			text = ["—", car.short, RaceSim.format_time(samples.min()) if not samples.is_empty() else "—", str(samples.size()), str(runs.size()), "MEASURED" if not samples.is_empty() else "NO DATA"]
		else:
			var result = "DNF" if car.dnf else ("UNCLASSIFIED" if not car.finished else (RaceSim.format_time(car.finish_time) if i == 0 else ("+%d L" % (order[0].completed - car.completed) if car.completed < order[0].completed else "+%.3f" % maxf(0, car.finish_time - order[0].finish_time))))
			text = [str(i + 1), car.short, result, str(car.completed), str(car.pit_stops), RaceSim.format_time(car.best_lap)]
		data.append({"id": int(car.id), "player": bool(car.player), "text": text})
	var explanation = {"race": "Final classification · completed laps first, then measured finish time. Lapped finishes and retirements remain explicit.", "qualifying": "Best valid timed lap · untimed attempts do not become pole positions. Race best laps are not qualifying evidence.", "practice": "Practice observations only · not a race classification or qualifying grid. Missing measurements are shown as —."}[mode]
	return {"mode": mode, "titles": titles, "rows": data, "summary": explanation}

func refresh() -> void:
	if model == null or classification == null: return
	var data = presentation(model)
	var stamp = [data.mode, data.titles, data.rows, data.summary]
	if stamp == rendered: return
	rendered = stamp.duplicate(true); rebuild_count += 1
	heading.text = "SESSION RESULTS" if data.mode == "pending" else data.mode.to_upper() + " RESULTS"
	summary.text = data.summary; classification.visible = data.mode != "pending"
	var factor = classification.get_theme_font_size("font_size") / 13.0
	for column in range(6):
		classification.set_column_title(column, data.titles[column])
		classification.set_column_expand(column, column in [2, 5])
		classification.set_column_custom_minimum_width(column, ceili([28, 48, 80, 38, 32, 80][column] * factor))
	for i in range(rows.size()):
		rows[i].visible = i < data.rows.size()
		if i >= data.rows.size(): continue
		var entry = data.rows[i]
		rows[i].set_metadata(0, entry.id)
		for column in range(6):
			rows[i].set_text(column, entry.text[column])
			rows[i].set_tooltip_text(column, data.titles[column] + ": " + entry.text[column])
			rows[i].set_custom_bg_color(column, UI.SELECTED if entry.player else UI.PANEL)
	_layout_columns()

func _layout_columns() -> void:
	if classification==null or rendered.is_empty():return
	var wide=size.x>760
	for column in range(6):
		classification.set_column_expand(column,(column==1 or column==5) if wide else column in [2,5])
		if wide:classification.set_column_custom_minimum_width(column,[48,240,140,100,80,180][column])
		else:classification.set_column_custom_minimum_width(column,ceili([28,48,80,38,32,80][column]*classification.get_theme_font_size("font_size")/13.0))
	for row in rows:
		if row.visible and row.get_metadata(0)!=null:
			var c=model.cars[int(row.get_metadata(0))]
			row.set_text(1,c.name if wide else c.short)
