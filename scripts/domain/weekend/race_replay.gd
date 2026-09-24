class_name RaceReplay
extends RefCounted
## Independent fixed-step reconstruction. Playback controls never call the original.
var record: Dictionary = {}
var sim: PracticeRaceSim
var step_index = 0
var start_step = 0
var cursor = 0
var error = ""
var verified = false
var at_snapshot = true

func load_record(data: Dictionary) -> String:
	error = RaceRecord.validate(data)
	if not error.is_empty(): return error
	record = data.duplicate(true)
	seek(-1)
	return ""

func seek(index: int) -> bool:
	if record.is_empty() or index < -1 or index > record.marks.size(): return false
	var snapshot: Dictionary
	if index == -1:
		snapshot = RaceRecord.apply_types(record.initial, record.initial_integers); step_index = 0; cursor = 0
	elif index == record.marks.size():
		snapshot = RaceRecord.apply_types(record.endpoint, record.endpoint_integers); step_index = int(record.steps); cursor = record.inputs.size()
	else:
		var mark = record.marks[index]; snapshot = RaceRecord.apply_types(mark.snapshot, mark.integers); step_index = int(mark.step); cursor = int(mark.cursor)
	start_step = step_index
	sim = PracticeRaceSim.restore_practice(snapshot)
	error = ""; verified = false; at_snapshot = true
	return sim != null

func tick(budget: int = 32) -> int:
	if not error.is_empty() or record.is_empty() or verified: return 0
	if record.engine != Engine.get_version_info().string or record.model != RaceRecord.MODEL:
		error = "Saved engine or model differs. Inspect checkpoints or try a labeled sandbox; original replay is unavailable."; return 0
	if not record.incomplete.is_empty(): error = record.incomplete; return 0
	at_snapshot = false
	var advanced = 0
	var commands_applied = 0
	while advanced < clampi(budget, 1, 64):
		while cursor < record.inputs.size() and int(record.inputs[cursor].step) == step_index:
			var entry = record.inputs[cursor]
			sim.selected_id = int(entry.context.selected_id); sim.speed = int(entry.context.speed)
			sim.paused = entry.context.paused; sim.accumulator = float(entry.context.accumulator)
			if not sim.command(entry.action, RaceRecord.typed_payload(entry)):
				error = "Replay stopped at input %d: %s. No live state was changed." % [cursor + 1, sim.last_error]; return advanced
			cursor += 1; commands_applied += 1
			if commands_applied >= 32: return advanced
		if step_index == int(record.steps):
			verified = RaceRecord.equivalent(RaceRecord.sporting(sim.snapshot()), RaceRecord.sporting(record.endpoint))
			if not verified: error = "Replay endpoint differs from the saved sporting state. No outcome is claimed as reproduced."
			return advanced
		if sim.phase not in RaceSim.ACTIVE:
			error = "Missing recorded approval before the next step. No approval was invented."; return advanced
		sim.paused = false
		sim.step(); step_index += 1; advanced += 1
	return advanced

func branch() -> PracticeRaceSim:
	if sim == null: return null
	var copy = PracticeRaceSim.restore_practice(sim.snapshot())
	if copy != null: copy.paused = true
	return copy

func lineage() -> Dictionary:
	return {"event_id": record.event_id, "digest": record.digest, "step": step_index, "cursor": cursor,
		"source": "saved snapshot" if at_snapshot else "model re-simulation", "original_result_preserved": true}
