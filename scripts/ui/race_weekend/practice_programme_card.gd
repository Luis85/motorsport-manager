class_name RacePracticeProgrammeCard
extends PracticePanel
## Visual programme choices, real per-driver drafts and concise measured feedback.
## Reuses PracticePanel validation/command handling; no second practice controller.
var objective_buttons: Dictionary = {}
var detail_body: VBoxContainer
var programme_ready = false
func _ready() -> void:
	dashboard_host=true
	super._ready()
	driver_buttons[0].get_parent().hide()
	var original=scroll.get_child(0)
	for child in original.get_children():
		if child is Control:child.hide()
	var grid=GridContainer.new();grid.columns=2;original.add_child(grid)
	for key in PracticeEvidence.OBJECTIVES:
		var b=UI.button(PracticeEvidence.OBJECTIVES[key],func(): _select_objective(key));b.custom_minimum_size.y=56;b.size_flags_horizontal=Control.SIZE_EXPAND_FILL
		b.add_theme_font_size_override("font_size",12);grid.add_child(b);objective_buttons[key]=b
	var controls=UI.vbox(original)
	for pair in [["Tyre set",sets],["Measured laps",lap_count],["Setup on release",baseline]]:
		var row=UI.hbox(controls)
		var label=UI.label(pair[0],12,UI.MUTED);label.custom_minimum_size.x=130;row.add_child(label)
		pair[1].reparent(row);pair[1].show();pair[1].size_flags_horizontal=Control.SIZE_EXPAND_FILL
	setup_summary.reparent(controls);setup_summary.show()
	forecast_text.reparent(controls);forecast_text.show()
	original.add_child(UI.label("MEASURED EVIDENCE",13,UI.ACCENT))
	detail_body=UI.vbox(original)
	evidence.reparent(detail_body);evidence.show()
	original.add_child(UI.button("Run assumptions & limits",func():UI.notify(self,"Practice evidence", "Optional learning, not a setup bonus. Keep your best tyre sets for qualifying. A run commits this driver's objective, finite set and selected setup, then consumes fuel, tread, condition and session time.\n\n"+preview.get("limit","")+"\n\n"+PracticeEvidence.report(model.practice_state,driver_id))))
	programme_ready=true;refresh()
func _select_objective(key: String) -> void:
	purpose.select(PracticeEvidence.OBJECTIVES.keys().find(key));update_draft("objective",key)
func refresh() -> void:
	super.refresh()
	if not programme_ready:return
	var draft=drafts[driver_id];var driver=model.practice_driver(driver_id)
	for key in objective_buttons:
		var samples=0
		for record in driver.runs:
			if record.objective==key:samples+=record.samples.size()
		var b=objective_buttons[key]
		b.text=PracticeEvidence.OBJECTIVES[key]+"\n"+("Selected" if draft.objective==key else "%d measured laps" % samples)
		b.disabled=not driver.active.is_empty() or model.practice_state.status in ["complete","skipped","legacy"]
		PitwallDesign.navigation(b,draft.objective==key)
	lap_count.set_value_no_signal(draft.laps)
	forecast_text.text=("READY TO RUN" if preview.available else preview.reason)+"\n~%.0fs · %.2f fuel lap units · includes out / in laps" % [preview.duration,preview.fuel]
	setup_summary.text="On release · wing %d / balance %d / suspension %d / cooling %d / bias %d%%" % [PracticeEvidence.setup_for(model.cars[driver_id],draft.baseline).wing,PracticeEvidence.setup_for(model.cars[driver_id],draft.baseline).balance,PracticeEvidence.setup_for(model.cars[driver_id],draft.baseline).suspension,PracticeEvidence.setup_for(model.cars[driver_id],draft.baseline).cooling,PracticeEvidence.setup_for(model.cars[driver_id],draft.baseline).bias]
	if driver.runs.is_empty():evidence.text="No measured runs yet. Baseline forecasts remain available; skipping practice is viable."
	else:
		var record=driver.runs.back()
		evidence.text="Latest · "+PracticeEvidence.OBJECTIVES[record.objective]+" · %d/%d laps\n" % [record.samples.size(),record.target]+record.reason
		if not record.samples.is_empty():
			var times=record.samples.map(func(lap):return lap.seconds)
			evidence.text+="\nMeasured %.2f–%.2fs · %d clean samples" % [times.min(),times.max(),record.samples.filter(func(lap):return lap.clean).size()]
