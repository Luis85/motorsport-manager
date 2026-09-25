class_name RaceTelemetryInspector
extends VBoxContainer
## Shared inspection of recorded speed/tyre/fuel/acceleration and current model state.
var model: RaceSim
var metric_label: Label
var chart: RaceMetricChart
var sectors: RaceSectorTable
var history: RichTextLabel
var selector: OptionButton
var powertrain: Label
var current_metric = 0
var range_selector: OptionButton
var range_seconds = 120.0
var compare: CheckButton
var range_note: Label
func configure(value: RaceSim) -> void: model = value
func _ready() -> void:
	add_theme_constant_override("separation",8)
	metric_label = UI.paragraph("",UI.INK); add_child(metric_label)
	selector = UI.option(["Speed · km/h","Tyre life · %","Fuel remaining · lap units","Acceleration · m/s²"],_choose); add_child(selector)
	range_selector = UI.option(["Last 120 seconds", "Last 60 seconds", "Last 30 seconds", "All retained samples"], func(index): range_seconds = [120.0, 60.0, 30.0, INF][index]; present()); add_child(range_selector)
	compare = UI.check("Compare teammate · recorded samples only", false, func(_value): present()); add_child(compare)
	range_note = UI.paragraph(""); add_child(range_note)
	chart = RaceMetricChart.new(); add_child(chart)
	powertrain = UI.paragraph(""); add_child(powertrain)
	sectors = RaceSectorTable.new(); add_child(sectors)
	history = RichTextLabel.new(); history.custom_minimum_size.y = 125; history.selection_enabled = true; add_child(history)
func _choose(index: int) -> void: current_metric=index; present()
func present() -> void:
	if chart==null: return
	var car = model.cars[model.selected_id]
	if not car.player:
		metric_label.text="Rival inspection · public timing only"; powertrain.text="Private car telemetry is unavailable."; chart.present("No private telemetry","",[],0,1); sectors.present([]); history.text = ""; range_note.text = "Public timing only; no rival private samples."; return
	var primary = recording(car)
	var values: Array = primary.values; var timestamps: Array = primary.times
	var secondary: Array = []; var secondary_name = ""
	var other_id = 6 if car.id == 3 else 3
	compare.text = "Compare " + model.cars[other_id].name + " · dashed trace"
	var note = "%d / %d retained %s samples" % [values.size(), car.telemetry.size(), car.short]
	if compare.button_pressed:
		var other = recording(model.cars[other_id])
		var pair = RaceMetricChart.align_recordings(timestamps, values, other.times, other.values)
		if pair.is_empty(): note += "\nComparison unavailable: missing or duplicate timestamps. No alignment is invented."
		else:
			timestamps = pair.x; values = pair.first; secondary = pair.second; secondary_name = model.cars[other_id].short + " dashed"
			note += "\nExact elapsed-time alignment; unmatched samples remain gaps."
	var bounds = RaceMetricChart.padded_range(values + secondary)
	var low = minf([0.0,0.0,0.0,-20.0][current_metric], bounds.x)
	var high = maxf([340.0,100.0,maxf(1,model.laps),20.0][current_metric], bounds.y)
	if current_metric in [0,1,2]: low = 0.0
	chart.present_samples(car.short + " · " + selector.get_item_text(current_metric), ["km/h","%","laps","m/s²"][current_metric], values, low, high, timestamps, [], "Elapsed s", secondary, secondary_name)
	range_note.text = note + "\nUp to 120 samples per car are retained. Not future data."

	powertrain.text="CURRENT MODEL STATE · NOT A RECORDED HISTORY
Engine %.0f°C · brakes %.0f°C · tyre %.0f°C
Damage %.0f%% · lifetime condition %.0f%%" % [car.engine_temperature,car.brake_temperature,car.temperature,car.damage,car.health]
	powertrain.accessibility_description=powertrain.text

func recording(car: Dictionary) -> Dictionary:
	var values: Array = []; var times: Array = []
	var since = -INF if is_inf(range_seconds) else model.total_time - range_seconds
	for sample in car.telemetry:
		if not sample is Array or sample.is_empty():
			values.append(null); times.append(null); continue
		if RaceMetricChart.finite_value(sample[0]) and float(sample[0]) < since: continue
		times.append(sample[0])
		values.append(sample[current_metric + 1] if sample.size() > current_metric + 1 else null)
	return {"values":values, "times":times}
