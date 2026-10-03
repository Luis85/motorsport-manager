class_name WeekendLaunchPreparation
extends RefCounted
## Builds detached track/options candidates before WeekendLaunch publishes a revision.


static func prepare(
	catalog: ContentCatalog, document: Dictionary, options: Dictionary, vehicle: String
) -> Dictionary:
	var errors = TrackDocument.validate(document)
	if not errors.is_empty():
		return {"error": "\n".join(errors)}
	var definition: VehicleDefinition
	if catalog != null:
		definition = catalog.vehicle(
			vehicle if "." in vehicle else "core.vehicle." + vehicle.to_lower()
		)
	if (
		(catalog != null and definition == null)
		or (catalog == null and vehicle not in VehicleDefinition.LEGACY)
	):
		return {"error": "Choose a supported vehicle profile."}
	var error = _configuration_error(options)
	if not error.is_empty():
		return {"error": error}
	var definitions = _definitions(catalog, options)
	if definitions.has("error"):
		return definitions
	return _geometry(document, vehicle, definition, definitions, options)


static func _configuration_error(options: Dictionary) -> String:
	if (
		not RaceCheckpoint.integral(options.get("laps"), 1, 100)
		or not RaceCheckpoint.integral(options.get("seed", 7314), 0, 4294967295)
	):
		return "Race laps and seed must be within their supported limits."
	if (
		options.get("scenario", "dry") not in ["dry", "wet", "changeable"]
		or options.get("intensity", "standard") not in ["calm", "standard", "volatile"]
	):
		return "Choose a supported weather and incident profile."
	if not RaceCheckpoint.number(options.get("qual_duration", 480), 120, 1800):
		return "Qualifying duration must be between 2 and 30 minutes."
	if options.get("weather_mode", "seeded") not in WeekendWeather.MODES:
		return "Choose seeded or explicitly scripted training weather."
	for key in ["tactical_duels", "rival_styles"]:
		if options.has(key) and not options[key] is bool:
			return "Use an explicit boolean for " + key + "."
	return ""


static func _definitions(catalog: ContentCatalog, options: Dictionary) -> Dictionary:
	var result: Dictionary = {}
	for selection in [
		[
			"race_tuning_id",
			"core.race_tuning.default",
			"tuning",
			"race tuning",
			"race tuning",
			"authored race settings"
		],
		[
			"weekend_id",
			"",
			"weekend",
			"a weekend preset",
			"weekend preset",
			"authored race settings"
		],
		[
			"mechanic_profile_id",
			"core.mechanic_profile.default",
			"mechanic_profile",
			"a mechanic profile",
			"mechanic profile",
			"an authored mechanic profile"
		],
		["roster_id", "core.roster.default", "roster", "a roster", "roster", "an authored roster"],
		[
			"tyre_allocation_id",
			"core.tyre_allocation.default",
			"tyres",
			"an allocation",
			"tyre allocation",
			"an authored allocation"
		],
		[
			"setup_id",
			"core.setup.balanced",
			"setup",
			"a setup profile",
			"setup profile",
			"an authored setup profile"
		]
	]:
		var key: String = selection[0]
		if catalog == null:
			if options.has(key):
				return {"error": "A content catalog is required for " + selection[5] + "."}
			result[key] = null
			continue
		if key == "weekend_id" and not options.has(key):
			result[key] = null
			continue
		var id = options.get(key, selection[1])
		if not id is String:
			return {"error": "Choose " + selection[3] + " by its stable ID."}
		var definition = catalog.call(selection[2], id)
		if definition == null:
			return {
				"error":
				"Unknown " + ("" if key == "weekend_id" else "or invalid ") + selection[4] + "."
			}
		result[key] = definition
	return result


static func _geometry(
	document: Dictionary,
	vehicle: String,
	definition: VehicleDefinition,
	definitions: Dictionary,
	options: Dictionary
) -> Dictionary:
	var geometry = TrackGeometry.new(document.duplicate(true), vehicle, false, definition)
	if (
		definitions.roster_id != null
		and not definitions.roster_id.track_errors(geometry).is_empty()
	):
		return {"error": "\n".join(definitions.roster_id.track_errors(geometry))}
	if TrackDiagnostics.blocking(TrackDiagnostics.inspect(geometry)):
		return {
			"error":
			"The circuit has blocking checks. Resolve them in the track editor before driving."
		}
	if definitions.roster_id != null:
		geometry.pit_box_markers = definitions.roster_id.pit_markers()
	var track = geometry
	var prepared_options = {
		"laps": int(options.laps),
		"seed": int(options.get("seed", 7314)),
		"qual_duration": float(options.get("qual_duration", 480)),
		"scenario": str(options.get("scenario", "dry")),
		"intensity": str(options.get("intensity", "standard")),
		"tactical_duels": options.get("tactical_duels", true),
		"rival_styles": options.get("rival_styles", true),
		"weather_mode": str(options.get("weather_mode", "seeded"))
	}
	if definitions.roster_id != null:
		prepared_options.roster_definition = definitions.roster_id.to_snapshot()
	if definitions.tyre_allocation_id != null:
		prepared_options.tyre_definition = definitions.tyre_allocation_id.to_snapshot()
	if definitions.setup_id != null:
		prepared_options.setup_definition = definitions.setup_id.to_record()
	if definitions.race_tuning_id != null:
		prepared_options.tuning_definition = definitions.race_tuning_id.to_record()
	if definitions.mechanic_profile_id != null:
		prepared_options.mechanic_definition = definitions.mechanic_profile_id.to_record()
	_freeze_preset(definitions, definition, options, prepared_options)
	return {"track": track, "options": prepared_options}


static func _freeze_preset(
	definitions: Dictionary,
	definition: VehicleDefinition,
	options: Dictionary,
	prepared_options: Dictionary
) -> void:
	if definitions.weekend_id != null:
		# Freeze the effective selection, including explicit user edits to a preset.
		var effective = definitions.weekend_id.to_record()
		effective.vehicle_id = definition.id
		effective.roster_id = options.get("roster_id", "core.roster.default")
		effective.tyre_allocation_id = options.get(
			"tyre_allocation_id", "core.tyre_allocation.default"
		)
		effective.setup_id = options.get("setup_id", "core.setup.balanced")
		effective.race_tuning_id = options.get("race_tuning_id", "core.race_tuning.default")
		# Missing optional JSON keys must be inserted as Strings, not StringNames.
		effective["mechanic_profile_id"] = definitions.mechanic_profile_id.id
		for key in effective.settings:
			effective.settings[key] = prepared_options[key]
		prepared_options.weekend_definition = effective
