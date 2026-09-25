class_name RaceQualifyingWorkspace
extends PanelContainer
## Session-specific run/traffic context composed with the shared circuit workspace.
signal inspect_requested(id: int)
var labels: Dictionary = {}
var model: RaceSim
func configure(value: RaceSim) -> void: model = value
func _ready() -> void:
	add_theme_stylebox_override("panel",UI.box(PitwallDesign.RACE_CREAM,UI.LINE,5,6))
	var row = UI.hbox(self)
	for id in [3,6]:
		var cell = UI.vbox(row); cell.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var button = UI.button(model.cars[id].short + " · RUN PLAN",func(): inspect_requested.emit(id)); cell.add_child(button)
		var info = UI.label("",11); info.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; cell.add_child(info); labels[id] = info
func present() -> void:
	if labels.is_empty(): return
	for id in labels:
		var c = model.cars[id]; var release = RaceForecaster.qualifying_release(model,c)
		labels[id].text = "%s · Best %s · %s" % [c.qual_state.to_upper(),RaceSim.format_time(c.qual_best),"release window open" if release.can_start_hotlap else "no new flying lap"]
		labels[id].tooltip_text = "Estimated %.0fs until hot lap. Latest feasible release at session time %.0fs. Traffic is visible on the circuit; no guaranteed gap." % [release.required_seconds,release.latest_release]
