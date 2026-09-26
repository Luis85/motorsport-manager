class_name RacePracticeProgrammeCard
extends PracticePanel
## Visual programme choices, real per-driver drafts and concise measured feedback.
## Reuses PracticePanel validation/command handling; no second practice controller.
var objective_buttons: Dictionary = {}
var detail_body: VBoxContainer
var programme_ready = false
var draft_rows: Array[Control] = []
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
		var row=UI.hbox(controls);draft_rows.append(row)
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
	var show_draft=(model.phase=="briefing" and model.practice_state.status=="available") or (model.phase=="practice" and driver.active.is_empty() and not model.practice_state.closed and driver.runs.size()<PracticeEvidence.MAX_RUNS)
	var historical=not show_draft and not driver.runs.is_empty()
	var highlighted=driver.runs.back().objective if historical else draft.objective
	for row in draft_rows:row.visible=show_draft
	for key in objective_buttons:
		var samples=0; var clean=0
		for record in driver.runs:
			if record.objective==key:
				samples+=record.samples.size(); clean+=record.samples.filter(func(lap):return lap.clean).size()
		var b=objective_buttons[key]
		b.text=PracticeEvidence.OBJECTIVES[key]+"\n"+(("Running · " if not driver.active.is_empty() else "Latest · ") if historical and highlighted==key else "Selected · " if show_draft and highlighted==key else "")+"%d laps / %d clean" % [samples,clean]
		b.disabled=not driver.active.is_empty() or model.practice_state.status in ["complete","skipped","legacy"]
		PitwallDesign.navigation(b,highlighted==key)
	lap_count.set_value_no_signal(draft.laps)
	forecast_text.text=run_estimate_text()
	var shown_setup=driver.runs.back().setup if historical else PracticeEvidence.setup_for(model.cars[driver_id],draft.baseline)
	setup_summary.text=("Recorded run %s · %s\nApplied for that run" % [driver.runs.back().id,driver.runs.back().set_id] if historical else "Draft on release")+" · wing %d / balance %d / suspension %d / cooling %d / bias %d%%" % [shown_setup.wing,shown_setup.balance,shown_setup.suspension,shown_setup.cooling,shown_setup.bias]
	if driver.runs.is_empty():evidence.text="No measured runs yet. Baseline forecasts remain available; skipping practice is viable."
	else:
		var record=driver.runs.back()
		evidence.text="Latest · "+PracticeEvidence.OBJECTIVES[record.objective]+" · %d/%d laps\n" % [record.samples.size(),record.target]+record.reason
		if not record.samples.is_empty():
			var times=record.samples.map(func(lap):return lap.seconds)
			if driver.active.is_empty():
				summary.text="Latest %s · %d/%d laps\nMeasured %.2f–%.2fs · %d clean" % [PracticeEvidence.OBJECTIVES[record.objective],record.samples.size(),record.target,times.min(),times.max(),record.samples.filter(func(lap):return lap.clean).size()]
			evidence.text+="\nMeasured %.2f–%.2fs · %d clean samples" % [times.min(),times.max(),record.samples.filter(func(lap):return lap.clean).size()]

		if not record.end.is_empty():
			evidence.text+="\nObserved cost · %.2f tread points · %.2f fuel laps · %.2f condition points" % [maxf(0,record.start.life-record.end.life),maxf(0,record.start.fuel-record.end.fuel),maxf(0,record.start.health-record.end.health)]
		var priors=model.forecast_parameters(driver_id).get("practice",{})
		evidence.text+="\n"+("No matching clean evidence for the current car/conditions; baseline estimates remain." if priors.is_empty() else "Current matching evidence: "+" / ".join(priors.keys().map(func(key):return key+" · "+priors[key].label)))
