class_name RaceCallRoomIntent
extends VBoxContainer
## A named-driver, frozen decision. Choosing is not committing. No forecasts mutate here.
signal close_requested
signal command_requested(action: String, payload: Dictionary)
signal watch_requested
signal details_requested(id: int)
var model: RaceViewQuery
var snapshot: Dictionary = {}
var selected = ""
var submitted = false
var receipt: Dictionary = {}
var heading: Label
var context: Label
var evidence: Label
var source_label: Label
var stage_label: Label
var message: Label
var options: GridContainer
var option_buttons: Dictionary = {}
var confirm_button: Button
var keep_button: Button
var refresh_button: Button
var watch_button: Button
var back_button: Button
var details_button: Button
var scroll: ScrollContainer
var footer: VBoxContainer
var submit_sequence = 0
var outcome_panel: PanelContainer
var outcome_title: Label
var outcome_metrics: Label
var outcome_detail: Label


func configure(value: RaceViewQuery) -> void:
	model = value


func refresh_snapshot() -> void:
	if snapshot.is_empty():
		return
	var id = int(snapshot.driver_id)
	call("present", model.race_decision_view_model_capture(id, model.forecast(id)))


func is_stale() -> bool:
	return (
		snapshot.is_empty()
		or model.phase != snapshot.phase
		or model.race_forecaster_stale(
			snapshot.forecast, int(model.policy(snapshot.driver_id).revision)
		)
	)


func choose(key: String) -> void:
	call("refresh_state")
	if (
		not option_buttons.has(key)
		or option_buttons[key].disabled
		or not receipt.is_empty()
		or submitted
	):
		return
	selected = key
	for other in option_buttons:
		DirectorStyle.style_button(option_buttons[other], other == key)
	message.text = commitment_text()
	call("refresh_state")
	PitwallDesign.focus_later(confirm_button)


func commitment_text() -> String:
	if selected == "pit":
		return (
			(
				"%s: fit %s at safe entry lap %d. Pit ownership becomes yours; other owners stay "
				+ "unchanged. Estimated loss includes pit travel and service, not a guaranteed "
				+ "finishing time."
			)
			% [snapshot.name, snapshot.forecast.replacement_id, snapshot.forecast.gate.lap]
		)
	if selected == "recall":
		return (
			(
				"%s: recall this qualifying run. The car returns physically; an unfinished "
				+ "flying lap may be lost."
			)
			% snapshot.name
		)
	if selected == "send":
		return (
			(
				"%s: release the planned real set for an out/flying/in-lap run. No qualifying "
				+ "result is guaranteed."
			)
			% snapshot.name
		)
	var channel = "engine" if selected == "fuel" else "pace"
	return (
		(
			"%s: %s for two lap-distances from acceptance. Only %s changes; existing pit "
			+ "orders stay valid. After expiry, the previous owner/value resumes."
		)
		% [
			snapshot.name,
			{"push": "push pace", "protect": "protect tyres", "fuel": "save fuel"}.get(
				selected, "keep orders"
			),
			channel
		]
	)


func payload() -> Dictionary:
	if selected == "pit":
		return RaceDecisionViewModel.pit_payload(snapshot)
	if selected in ["send", "recall"]:
		return {"id": snapshot.driver_id}
	return {
		"id": snapshot.driver_id,
		"channel": "engine" if selected == "fuel" else "pace",
		"value": 2 if selected == "push" else 0,
		"laps": 2
	}


func commit() -> void:
	call("refresh_state")
	if confirm_button.disabled:
		return
	submitted = true
	submit_sequence = int(model.strategy_state.sequence)
	var action = (
		"pit"
		if selected == "pit"
		else (selected if selected in ["send", "recall"] else "resource_intent")
	)
	command_requested.emit(action, payload())


func command_result(accepted: bool, error: String, action: String, value: Dictionary) -> void:
	submitted = false
	if accepted:
		receipt = model.race_decision_view_model_accepted_receipt(
			snapshot, action, value, submit_sequence
		)
	else:
		message.text = "Not sent: " + error + " Refresh this situation before trying again."
	call("refresh_state")
	PitwallDesign.focus_later(watch_button if accepted else refresh_button)
