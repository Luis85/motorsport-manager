class_name WeekendLaunch
extends RefCounted
## Staged weekend entry. Inspecting or abandoning this draft cannot replace a save.
var _catalog: ContentCatalog
var _track: TrackGeometry
var _options: Dictionary = {}
var _revision: int = 0
var _consumed: bool = false
var _committing: bool = false
var last_error: String = ""
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
		if not settings.has(key):
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
	var errors = TrackDocument.validate(document)
	if not errors.is_empty():
		last_error = "\n".join(errors)
		return false
	var definition: VehicleDefinition
	if _catalog != null:
		definition = _catalog.vehicle(vehicle if "." in vehicle else "core.vehicle." + vehicle.to_lower())
	if (_catalog != null and definition == null) or (_catalog == null and vehicle not in VehicleDefinition.LEGACY):
		last_error = "Choose a supported vehicle profile."
		return false
	if not RaceCheckpoint.integral(options.get("laps"), 1, 100) or not RaceCheckpoint.integral(options.get("seed", 7314), 0, 4294967295):
		last_error = "Race laps and seed must be within their supported limits."
		return false
	if options.get("scenario", "dry") not in ["dry", "wet", "changeable"] or options.get("intensity", "standard") not in ["calm", "standard", "volatile"]:
		last_error = "Choose a supported weather and incident profile."
		return false
	if not RaceCheckpoint.number(options.get("qual_duration", 480), 120, 1800):
		last_error = "Qualifying duration must be between 2 and 30 minutes."
		return false
	if options.get("weather_mode", "seeded") not in WeekendWeather.MODES:
		last_error = "Choose seeded or explicitly scripted training weather."
		return false
	for key in ["tactical_duels", "rival_styles"]:
		if options.has(key) and not options[key] is bool:
			last_error = "Use an explicit boolean for " + key + "."
			return false
	var tuning: RaceTuningDefinition
	var preset: WeekendDefinition
	if _catalog != null:
		if not options.get("race_tuning_id", "core.race_tuning.default") is String:
			last_error = "Choose race tuning by its stable ID."
			return false
		tuning = _catalog.tuning(options.get("race_tuning_id", "core.race_tuning.default"))
		if tuning == null:
			last_error = "Unknown or invalid race tuning."
			return false
		if options.has("weekend_id"):
			if not options.weekend_id is String:
				last_error = "Choose a weekend preset by its stable ID."
				return false
			preset = _catalog.weekend(options.weekend_id)
			if preset == null:
				last_error = "Unknown weekend preset."
				return false
	elif options.has("race_tuning_id") or options.has("weekend_id"):
		last_error = "A content catalog is required for authored race settings."
		return false
	var roster: RosterDefinition
	if _catalog != null:
		if not options.get("roster_id", "core.roster.default") is String:
			last_error = "Choose a roster by its stable ID."
			return false
		roster = _catalog.roster(options.get("roster_id", "core.roster.default"))
		if roster == null:
			last_error = "Unknown or invalid roster."
			return false
	elif options.has("roster_id"):
		last_error = "A content catalog is required for an authored roster."
		return false
	var tyres: RaceTyreRules
	if _catalog != null:
		if not options.get("tyre_allocation_id", "core.tyre_allocation.default") is String:
			last_error = "Choose an allocation by its stable ID."
			return false
		tyres = _catalog.tyres(options.get("tyre_allocation_id", "core.tyre_allocation.default"))
		if tyres == null:
			last_error = "Unknown or invalid tyre allocation."
			return false
	elif options.has("tyre_allocation_id"):
		last_error = "A content catalog is required for an authored allocation."
		return false
	var setup_profile: SetupDefinition
	if _catalog != null:
		if not options.get("setup_id", "core.setup.balanced") is String:
			last_error = "Choose a setup profile by its stable ID."
			return false
		setup_profile = _catalog.setup(options.get("setup_id", "core.setup.balanced"))
		if setup_profile == null:
			last_error = "Unknown or invalid setup profile."
			return false
	elif options.has("setup_id"):
		last_error = "A content catalog is required for an authored setup profile."
		return false
	var geometry = TrackGeometry.new(document.duplicate(true), vehicle, false, definition)
	if roster != null and not roster.track_errors(geometry).is_empty():
		last_error = "\n".join(roster.track_errors(geometry))
		return false
	if TrackDiagnostics.blocking(TrackDiagnostics.inspect(geometry)):
		last_error = "The circuit has blocking checks. Resolve them in the track editor before driving."
		return false
	if roster != null: geometry.pit_box_markers = roster.pit_markers()
	_scenario = null
	_track = geometry
	_options = {
		"laps": int(options.laps), "seed": int(options.get("seed", 7314)),
		"qual_duration": float(options.get("qual_duration", 480)),
		"scenario": str(options.get("scenario", "dry")),
		"intensity": str(options.get("intensity", "standard")),
		"tactical_duels": options.get("tactical_duels", true),
		"rival_styles": options.get("rival_styles", true),
		"weather_mode": str(options.get("weather_mode", "seeded"))}
	if roster != null: _options.roster_definition = roster.to_snapshot()
	if tyres != null: _options.tyre_definition = tyres.to_snapshot()
	if setup_profile != null: _options.setup_definition = setup_profile.to_record()
	if tuning != null: _options.tuning_definition = tuning.to_record()
	if preset != null:
		# Freeze the effective selection, including explicit user edits to a preset.
		var effective = preset.to_record()
		effective.vehicle_id = definition.id
		effective.roster_id = options.get("roster_id", "core.roster.default")
		effective.tyre_allocation_id = options.get("tyre_allocation_id", "core.tyre_allocation.default")
		effective.setup_id = options.get("setup_id", "core.setup.balanced")
		effective.race_tuning_id = options.get("race_tuning_id", "core.race_tuning.default")
		for key in effective.settings: effective.settings[key] = _options[key]
		_options.weekend_definition = effective
	_revision += 1
	_consumed = false
	return true

func capture() -> Dictionary:
	if _track == null:
		return {}
	var result = {"revision": _revision, "name": _track.document.name, "length": _track.length,
		"reference_lap": RaceSim.format_time(_track.estimate), "vehicle": _track.preset,
		"vehicle_name": _track.vehicle_definition.display_name,
		"laps": int(_options.laps), "weather": str(_options.get("scenario", "dry")),
		"seed": int(_options.get("seed", 7314)), "consumed": _consumed}
	if _scenario != null:
		result.scenario_brief = _scenario.brief()
	return result

func visual_track() -> TrackGeometry:
	return _track.detached_copy() if _track else null

func commit(expected_revision: int, store: WeekendEntryStore, speed: int = 1) -> Dictionary:
	if store == null:
		return {"ok": false, "error": "No weekend repository is available."}
	if _track == null or _consumed or _committing or expected_revision != _revision:
		return {"ok": false, "error": "This entry is no longer current. Review the configuration again."}
	if speed not in [1, 2, 4, 8, 16]:
		return {"ok": false, "error": "Choose a supported playback speed."}
	var candidate: RaceSim = PracticeRaceSim.new(_track, _options)
	if not candidate.last_error.is_empty():
		return {"ok": false, "error": candidate.last_error}
	var controls = MinimalRaceControls.new()
	controls.configure(candidate)
	if not controls.advance_stage():
		return {"ok": false, "error": controls.message}
	candidate.speed = speed
	var record = RaceRecord.new()
	var lineage: Dictionary = {}
	if _scenario != null:
		lineage = {"scenario": _scenario.brief(), "content_scenario": {
			"definition": _scenario.to_record(), "track_id": candidate.track.document.id}}
		var brief = _scenario.brief()
		RaceJournal.append(candidate.strategy_state, candidate, "scenario", -1, {
			"id": _scenario.id, "title": brief.title, "objective": ScenarioBrief.GOALS[brief.goal],
			"hint": brief.hint, "track_hash": RaceStateValue.fingerprint(candidate.track.document),
			"ruleset": "file-authored-weekend-v1", "assists": "Explicit weekend preset; ordinary simulation; no forced outcome."})
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
