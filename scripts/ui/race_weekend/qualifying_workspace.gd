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
		var button = UI.button(model.cars[id].name + " · Run plan",func(): inspect_requested.emit(id)); cell.add_child(button)
		var info = UI.label("",11); info.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; cell.add_child(info); labels[id] = info
func present() -> void:
	if labels.is_empty(): return
	for id in labels:
		var c = model.cars[id]; var release = RaceForecaster.qualifying_release(model,c)
		var benchmark = INF
		for other in model.cars:
			if other.qual_best > 0: benchmark = minf(benchmark,other.qual_best)
		var lap = "Untimed" if c.qual_best <= 0 else RaceSim.format_time(c.qual_best)
		if c.qual_best > 0 and is_finite(benchmark): lap += " (%+.3fs)" % (c.qual_best - benchmark)
		# This is the cost/last start of a NEW release, not time remaining on the
		# current out/hot/in lap. Keep its elapsed-session basis visible at 130%.
		var kind = "Release open" if release.can_start_hotlap else ("Next run" if c.route != "garage" else "Too late")
		var timing = "%s · need ~%.0fs · latest %.0fs elapsed" % [kind,release.required_seconds,release.latest_release]
		if model.qual_closed:
			timing = "Closed · existing hot lap may finish" if c.qual_state == "hotlap" else "Closed · no new release"
		labels[id].text = "%s · %s · %s\n%s" % [c.qual_state.to_upper(),c.set_id,lap,timing]
		labels[id].tooltip_text = "Best valid lap; signed gap is to the fastest valid lap in this session. A new release needs an estimated %.0fs to begin a hot lap, with its latest feasible start at %.0fs elapsed session time. This is not the current lap's countdown. Traffic remains visible on the circuit; a clear lap is not guaranteed." % [release.required_seconds,release.latest_release]
