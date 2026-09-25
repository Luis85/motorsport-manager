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
func configure(value: RaceSim) -> void: model = value
func _ready() -> void:
	add_theme_constant_override("separation",8)
	metric_label = UI.paragraph("",UI.INK); add_child(metric_label)
	selector = UI.option(["Speed · km/h","Tyre life · %","Fuel remaining · lap units","Acceleration · m/s²"],_choose); add_child(selector)
	chart = RaceMetricChart.new(); add_child(chart)
	powertrain = UI.paragraph(""); add_child(powertrain)
	sectors = RaceSectorTable.new(); add_child(sectors)
	history = RichTextLabel.new(); history.custom_minimum_size.y = 125; history.selection_enabled = true; add_child(history)
func _choose(index: int) -> void: current_metric=index; present()
func present() -> void:
	if chart==null: return
	var car = model.cars[model.selected_id]
	if not car.player:
		metric_label.text="Rival inspection · public timing only"; powertrain.text="Private car telemetry is unavailable."; chart.present("No private telemetry","",[],0,1); return
	var values: Array = []
	for sample in car.telemetry:
		if sample.size()>current_metric+1: values.append(float(sample[current_metric+1]))
	var low = [-0.0,0.0,0.0,-20.0][current_metric]
	var high = [340.0,100.0,maxf(1,model.laps),20.0][current_metric]
	chart.present(selector.get_item_text(current_metric),["km/h","%","laps","m/s²"][current_metric],values,low,high)
	powertrain.text="CURRENT MODEL STATE · NOT A RECORDED HISTORY
Engine %.0f°C · brakes %.0f°C · tyre %.0f°C
Damage %.0f%% · lifetime condition %.0f%%" % [car.engine_temperature,car.brake_temperature,car.temperature,car.damage,car.health]
	powertrain.accessibility_description=powertrain.text
