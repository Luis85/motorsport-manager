class_name WeekendLaunch
extends RefCounted
## Staged weekend entry. Inspecting or abandoning this draft cannot replace a save.
var last_error: String = ""
var _catalog: ContentCatalog
var _track: TrackGeometry
var _options: Dictionary = {}
var _revision: int = 0
var _consumed: bool = false
var _committing: bool = false
var _scenario: ContentScenarioDefinition


func _init(catalog: ContentCatalog = null) -> void:
	_catalog = catalog


func stage_preset(id: String, document: Dictionary, overrides: Dictionary = {}) -> bool:
	var preset = _catalog.weekend(id) if _catalog != null else null
	if preset == null:
		last_error = "Choose an existing weekend preset."
		return false
	var settings = preset.launch_options()
	for key in overrides:
		if not settings.has(key) and not WeekendDefinition.OPTIONAL_REFERENCES.has(key):
			last_error = "Unknown weekend override: " + str(key)
			return false
	settings.merge(overrides, true)
	settings.weekend_id = id
	return stage(document, settings, preset.vehicle_id)


func stage(document: Dictionary, options: Dictionary, vehicle: String = "Formula") -> bool:
	last_error = ""
	if not RaceStateValue.serializable(options):
		last_error = "Weekend settings exceed structural limits."
		return false
	if _committing:
		last_error = "Finish saving the approved weekend before changing its configuration."
		return false
	var prepared = WeekendLaunchPreparation.prepare(_catalog, document, options, vehicle)
	if prepared.has("error"):
		last_error = prepared.error
		return false
	_scenario = null
	_track = prepared.track
	_options = prepared.options
	_revision += 1
	_consumed = false
	return true


func capture() -> Dictionary:
	if _track == null:
		return {}
	var result = {
		"revision": _revision,
		"name": _track.document.name,
		"length": _track.length,
		"reference_lap": RaceSim.format_time(_track.estimate),
		"vehicle": _track.preset,
		"vehicle_name": _track.vehicle_definition.display_name,
		"laps": int(_options.laps),
		"weather": str(_options.get("scenario", "dry")),
		"seed": int(_options.get("seed", 7314)),
		"consumed": _consumed
	}
	if _options.has("mechanic_definition"):
		result.mechanic_profile = _options.mechanic_definition.name
	if _scenario != null:
		result.scenario_brief = _scenario.brief()
	return result


func visual_track() -> TrackGeometry:
	return _track.detached_copy() if _track else null


func commit(expected_revision: int, store: WeekendEntryStore, speed: int = 1) -> Dictionary:
	if store == null:
		return {"ok": false, "error": "No weekend repository is available."}
	if _track == null or _consumed or _committing or expected_revision != _revision:
		return {
			"ok": false, "error": "This entry is no longer current. Review the configuration again."
		}
	if speed not in [1, 2, 4, 8, 16]:
		return {"ok": false, "error": "Choose a supported playback speed."}
	var prepared = _candidate()
	if not prepared.ok:
		return prepared
	var candidate: RaceSim = prepared.simulation
	candidate.speed = speed
	var record = RaceRecord.new()
	var lineage: Dictionary = {}
	if _scenario != null:
		lineage = {
			"scenario": _scenario.brief(),
			"content_scenario":
			{"definition": _scenario.to_record(), "track_id": candidate.track.document.id}
		}
		var brief = _scenario.brief()
		RaceJournal.append(
			candidate.strategy_state,
			candidate,
			"scenario",
			-1,
			{
				"id": _scenario.id,
				"title": brief.title,
				"objective": ScenarioBrief.GOALS[brief.goal],
				"hint": brief.hint,
				"track_hash": RaceStateValue.fingerprint(candidate.track.document),
				"ruleset": "file-authored-weekend-v1",
				"assists": "Explicit weekend preset; ordinary simulation; no forced outcome."
			}
		)
	record.attach(candidate, "standalone", lineage)
	_committing = true
	var error = store.save_record(record)
	_committing = false
	if not error.is_empty():
		record.detach()
		return {"ok": false, "error": error}
	_consumed = true
	return {"ok": true, "simulation": candidate, "record": record}


func session_options() -> Dictionary:
	return _options.duplicate(true)


func stage_circuit(circuit_id: String, options: Dictionary, vehicle: String = "Formula") -> bool:
	var circuit = _catalog.circuit(circuit_id) if _catalog != null else null
	if circuit == null:
		last_error = "Choose an existing circuit definition."
		return false
	return stage(circuit.document(), options, vehicle)


func stage_scenario(id: String) -> bool:
	var scenario = _catalog.scenario(id) if _catalog != null else null
	if scenario == null:
		last_error = "Choose an existing scenario definition."
		return false
	var definition = scenario.to_record()
	var circuit = _catalog.circuit(definition.circuit_id)
	if circuit == null:
		last_error = "The scenario circuit is unavailable."
		return false
	var preset = _catalog.weekend(definition.weekend_id)
	if preset == null:
		last_error = "The scenario weekend is unavailable."
		return false
	var goal = scenario.brief().goal
	if goal in ["mer_top_six", "mor_top_six"]:
		var roster = _catalog.roster(preset.to_record().roster_id)
		if roster == null or ScenarioBrief.named_target(goal, roster) < 0:
			last_error = "The scenario goal names a driver outside the selected player team."
			return false
	if not stage_preset(definition.weekend_id, circuit.document()):
		return false
	_scenario = scenario
	return true


func _candidate() -> Dictionary:
	var candidate: RaceSim = PracticeRaceSim.new(_track, _options)
	if not candidate.last_error.is_empty():
		return {"ok": false, "error": candidate.last_error}
	var controls = MinimalRaceControls.new()
	controls.configure(candidate)
	if not controls.advance_stage():
		return {"ok": false, "error": controls.message}
	return {"ok": true, "simulation": candidate}
