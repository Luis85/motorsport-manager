class_name ContentCatalogValidation
extends RefCounted
## Ordered closure checks run before a catalog is published.
var _catalog: ContentCatalog
var _records: Dictionary
var _sources: Dictionary


func _init(catalog: ContentCatalog, records: Dictionary, sources: Dictionary) -> void:
	_catalog = catalog
	_records = records
	_sources = sources


func validate() -> Array:
	if _records.is_empty():
		return [
			ContentValidation.diagnostic("CONTENT_EMPTY", "", "The selected content set is empty.")
		]
	for check in [_rosters, _tyres, _setups, _tuning, _campaigns, _circuits, _scenarios]:
		var errors: Array = check.call()
		if not errors.is_empty():
			return errors
	return []


func _rosters() -> Array:
	for id in _records:
		if _records[id].kind != "roster":
			continue
		var resolved = RosterDefinition.resolve(_records[id], _records)
		if not resolved.ok:
			for diagnostic in resolved.diagnostics:
				diagnostic.file = _sources[id].file
				diagnostic.root = _sources[id].root
				diagnostic.entity = id
			return resolved.diagnostics
	return []


func _tyres() -> Array:
	for id in _records:
		var entry: Dictionary = _records[id]
		if (
			entry.kind == "tyre_thermal"
			and entry.has("operating")
			and not TyreOperatingSchema.valid(entry.operating)
		):
			return _catalog._definition_error(
				id,
				"CONTENT_TYRE_OPERATING",
				"/operating",
				(
					"Keep wheel operating limits inside checkpoint bounds, minimum load no "
					+ "higher than maximum, and core temperature limit no higher than "
					+ "surface limit."
				)
			)
		if entry.kind == "tyre":
			var thermal = _catalog.record(entry.thermal_profile_id)
			if thermal.get("kind") != "tyre_thermal":
				return _catalog._definition_error(
					id,
					"CONTENT_REFERENCE",
					"/thermal_profile_id",
					"Choose an existing tyre_thermal definition: " + str(entry.thermal_profile_id)
				)
			if TyreDefinition.compile(entry, thermal) == null:
				return _catalog._definition_error(
					id,
					"CONTENT_TYRE_CURVE",
					"/surface_response",
					(
						"Grip must remain between 0.05 and 2.0 throughout the supported water "
						+ "range; review the surface-response coefficients."
					)
				)
		if entry.kind == "tyre_allocation" and _catalog.tyres(id) == null:
			return _catalog._definition_error(
				id,
				"CONTENT_REFERENCE",
				"/sets",
				(
					"Use unique existing compounds, at most 64 total sets, and selection "
					+ "references of the required family. See "
					+ "docs/content/tyres-and-setup.md."
				)
			)
	return []


func _setups() -> Array:
	for id in _records:
		if _records[id].kind == "setup" and SetupDefinition.from_record(_records[id]) == null:
			return _catalog._definition_error(
				id,
				"CONTENT_SETUP",
				"/controls",
				(
					"Defaults/baselines must fit their control ranges and effect endpoints "
					+ "must remain physically positive. See docs/content/tyres-and-setup.md."
				)
			)
	return []


func _tuning() -> Array:
	for id in _records:
		var errors = _tuning_definition(id)
		if not errors.is_empty():
			return errors
		errors = _profile_definition(id)
		if not errors.is_empty():
			return errors
	return []


func _tuning_definition(id: String) -> Array:
	if _records[id].kind == "race_tuning" and _records[id].has("environment"):
		var problems = EnvironmentTuningSchema.semantic_errors(_records[id].environment)
		if not problems.is_empty():
			return _catalog._definition_error(
				id, problems[0].code, problems[0].field, problems[0].message
			)
	if _records[id].kind == "race_tuning" and _records[id].has("operations"):
		var problems = OperationsTuningSchema.semantic_errors(_records[id].operations)
		if not problems.is_empty():
			return _catalog._definition_error(
				id, problems[0].code, problems[0].field, problems[0].message
			)
	if _records[id].kind == "race_tuning" and _records[id].has("competition"):
		var problems = CompetitionTuningSchema.semantic_errors(_records[id].competition)
		if not problems.is_empty():
			return _catalog._definition_error(
				id, problems[0].code, problems[0].field, problems[0].message
			)
	if _records[id].kind == "race_tuning" and _catalog.tuning(id) == null:
		return _catalog._definition_error(
			id, "CONTENT_TUNING", "", "Use ordered mode multipliers and supported physical ranges."
		)
	return []


func _profile_definition(id: String) -> Array:
	if _records[id].kind == "mechanic_profile" and _catalog.mechanic_profile(id) == null:
		return _catalog._definition_error(
			id,
			"CONTENT_MECHANIC_PROFILE",
			"/profiles",
			(
				"Use installed provider versions, preserve each save-reader prefix and "
				+ "satisfy ordered dependencies."
			)
		)
	if _records[id].kind == "editor_profile" and _catalog.editor_profile(id) == null:
		return _catalog._definition_error(
			id,
			"CONTENT_EDITOR_PROFILE",
			"",
			(
				"Use the stable default editor-profile ID, unique placement IDs, "
				+ "supported scenery types and exactly one text-only guide step for each "
				+ "known editor guide key."
			)
		)
	if _records[id].kind == "weekend":
		for key in WeekendDefinition.REFERENCES:
			if _catalog.record(_records[id][key]).get("kind") != WeekendDefinition.REFERENCES[key]:
				return _catalog._definition_error(
					id,
					"CONTENT_REFERENCE",
					"/" + key,
					"Choose an existing " + WeekendDefinition.REFERENCES[key] + " definition."
				)
		for key in WeekendDefinition.OPTIONAL_REFERENCES:
			if (
				_records[id].has(key)
				and (
					_catalog.record(_records[id][key]).get("kind")
					!= WeekendDefinition.OPTIONAL_REFERENCES[key]
				)
			):
				return _catalog._definition_error(
					id,
					"CONTENT_REFERENCE",
					"/" + key,
					(
						"Choose an existing "
						+ WeekendDefinition.OPTIONAL_REFERENCES[key]
						+ " definition."
					)
				)
	return []


func _campaigns() -> Array:
	var default_campaign_id = ""
	var campaign_count = 0
	for id in _records:
		if _records[id].kind != "campaign":
			continue
		campaign_count += 1
		var errors = _campaign(id)
		if not errors.is_empty():
			return errors
		var campaign = _catalog.campaign(id)
		if campaign.is_default:
			if not default_campaign_id.is_empty():
				return _catalog._definition_error(
					id,
					"CONTENT_CAMPAIGN_DEFAULT",
					"/default",
					"Only one selected campaign may be the default."
				)
			default_campaign_id = id
	if campaign_count > 0 and default_campaign_id.is_empty():
		return [
			ContentValidation.diagnostic(
				"CONTENT_CAMPAIGN_DEFAULT",
				"/default",
				"Selected campaign content requires exactly one default campaign profile."
			)
		]
	return []


func _circuits() -> Array:
	var documents: Dictionary = {}
	for id in _records:
		var entry: Dictionary = _records[id]
		if entry.kind == "circuit":
			if (
				entry.has("style_id")
				and _catalog.record(entry.style_id).get("kind") != "circuit_style"
			):
				return _catalog._definition_error(
					id, "CONTENT_REFERENCE", "/style_id", "Choose an existing circuit style."
				)
			var resolved = _catalog.circuit(id)
			if resolved == null:
				var problems = CircuitDefinition.document_errors(entry.document)
				return _catalog._definition_error(
					id,
					"CONTENT_CIRCUIT",
					"/document",
					(
						"\n".join(problems)
						if not problems.is_empty()
						else "Supply a valid circuit style and track document."
					)
				)
			var document_id: String = resolved.document().id
			if documents.has(document_id):
				return _catalog._definition_error(
					id,
					"CONTENT_DOCUMENT_ID",
					"/document/id",
					"Circuit document IDs must be unique across selected packs: " + document_id
				)
			documents[document_id] = id
	return []


func _scenarios() -> Array:
	for id in _records:
		var entry: Dictionary = _records[id]
		if entry.kind == "scenario":
			if _catalog.scenario(id) == null:
				return _catalog._definition_error(
					id,
					"CONTENT_SCENARIO",
					"/brief",
					"Supply two different approaches and a supported observed goal."
				)
			if (
				_catalog.record(entry.circuit_id).get("kind") != "circuit"
				or _catalog.record(entry.weekend_id).get("kind") != "weekend"
			):
				return _catalog._definition_error(
					id, "CONTENT_REFERENCE", "", "Choose an existing circuit and weekend."
				)
			var preset = _catalog.weekend(entry.weekend_id).to_record()
			var field = RosterDefinition.resolve(_catalog.record(preset.roster_id), _records)
			var roster = RosterDefinition.decode_snapshot(field.snapshot) if field.ok else null
			var track = TrackGeometry.new(
				_catalog.circuit(entry.circuit_id).document(),
				preset.vehicle_id,
				true,
				_catalog.vehicle(preset.vehicle_id)
			)
			if roster == null or not roster.track_errors(track).is_empty():
				return _catalog._definition_error(
					id,
					"CONTENT_SCENARIO_CAPACITY",
					"/circuit_id",
					"The scenario circuit must accommodate its preset's grid and pit boxes."
				)
			if (
				entry.brief.goal in ["mer_top_six", "mor_top_six"]
				and ScenarioBrief.named_target(entry.brief.goal, roster) < 0
			):
				return _catalog._definition_error(
					id,
					"CONTENT_SCENARIO_GOAL",
					"/brief/goal",
					"The named goal driver is not entered for the selected player team."
				)
	return []


func _campaign(id: String) -> Array:
	var campaign = _catalog.campaign(id)
	if campaign == null:
		return _catalog._definition_error(
			id, "CONTENT_CAMPAIGN", "", "Campaign profile has invalid cross-field tuning."
		)
	if _catalog.record(campaign.weekend_id).get("kind") != "weekend":
		return _catalog._definition_error(
			id, "CONTENT_REFERENCE", "/weekend_id", "Choose an existing weekend definition."
		)
	var campaign_record = campaign.to_record()
	var campaign_weekend = _catalog.weekend(campaign.weekend_id)
	if campaign_weekend == null:
		return _catalog._definition_error(
			id, "CONTENT_REFERENCE", "/weekend_id", "Choose a valid weekend definition."
		)
	var weekend_record = campaign_weekend.to_record()
	var roster_record: Dictionary = _catalog.record(weekend_record.roster_id)
	var resolved_roster = RosterDefinition.resolve(roster_record, _records)
	var campaign_roster = (
		RosterDefinition.decode_snapshot(resolved_roster.snapshot) if resolved_roster.ok else null
	)
	var campaign_vehicle = _catalog.vehicle(weekend_record.vehicle_id)
	var errors = _campaign_roster(id, campaign_record, roster_record)
	if not errors.is_empty():
		return errors
	return _campaign_calendar(
		id, campaign_record, weekend_record, campaign_roster, campaign_vehicle
	)


func _campaign_roster(id: String, campaign_record: Dictionary, roster_record: Dictionary) -> Array:
	if roster_record.get("player_team_id") != campaign_record.player.roster_team_id:
		return _catalog._definition_error(
			id,
			"CONTENT_CAMPAIGN_ROSTER",
			"/player/roster_team_id",
			"Campaign player roster-team mapping must match the weekend roster player team."
		)
	var roster_counts: Dictionary = {}
	for roster_entry in roster_record.get("entries", []):
		roster_counts[roster_entry.team_id] = (int(roster_counts.get(roster_entry.team_id, 0)) + 1)
	var mapped_teams: Array = [campaign_record.player.roster_team_id]
	for rival in campaign_record.rivals:
		mapped_teams.append(rival.roster_team_id)
	mapped_teams.sort()
	var roster_teams = roster_counts.keys()
	roster_teams.sort()
	if mapped_teams != roster_teams:
		return _catalog._definition_error(
			id,
			"CONTENT_CAMPAIGN_ROSTER",
			"/rivals",
			"Campaign roster-team mappings must cover the selected weekend roster exactly."
		)
	for team_id in roster_teams:
		if int(roster_counts[team_id]) != int(campaign_record.series.cars_per_entrant):
			return _catalog._definition_error(
				id,
				"CONTENT_CAMPAIGN_ROSTER",
				"/series/cars_per_entrant",
				"Campaign cars-per-entrant must match every team in the selected weekend roster."
			)
	return []


func _campaign_calendar(
	id: String,
	campaign_record: Dictionary,
	weekend_record: Dictionary,
	campaign_roster: RosterDefinition,
	campaign_vehicle: VehicleDefinition
) -> Array:
	for event_index in range(campaign_record.calendar.size()):
		var circuit_id: String = campaign_record.calendar[event_index].circuit_id
		if _catalog.record(circuit_id).get("kind") != "circuit":
			return _catalog._definition_error(
				id,
				"CONTENT_REFERENCE",
				"/calendar/%d/circuit_id" % event_index,
				"Choose an existing circuit definition."
			)
		var campaign_circuit = _catalog.circuit(circuit_id)
		if campaign_circuit == null or campaign_roster == null or campaign_vehicle == null:
			return _catalog._definition_error(
				id,
				"CONTENT_CAMPAIGN_CAPACITY",
				"/calendar/%d/circuit_id" % event_index,
				"Campaign circuit, roster or vehicle could not be resolved."
			)
		var campaign_track = TrackGeometry.new(
			campaign_circuit.document(), weekend_record.vehicle_id, true, campaign_vehicle
		)
		var track_errors = campaign_roster.track_errors(campaign_track)
		if not track_errors.is_empty():
			return _catalog._definition_error(
				id,
				"CONTENT_CAMPAIGN_CAPACITY",
				"/calendar/%d/circuit_id" % event_index,
				"\n".join(track_errors)
			)
	return []
