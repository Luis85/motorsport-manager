class_name RaceCheckpoint
extends "res://scripts/domain/race_checkpoint_validation.gd"


static func valid(data: Dictionary) -> bool:
	if not RaceStateValue.serializable(data) or not _valid_content_definitions(data):
		return false
	var setup_profile = SetupDefinition.legacy()
	if data.has("setup_definition"):
		setup_profile = SetupDefinition.from_record(data.setup_definition)
		if setup_profile == null:
			return false
	var tyres = RaceTyreRules.legacy()
	if data.has("tyre_definition"):
		tyres = RaceTyreRules.from_snapshot(data.tyre_definition)
		if tyres == null:
			return false
	var roster: RosterDefinition
	if data.has("roster_definition"):
		roster = RosterDefinition.decode_snapshot(data.roster_definition)
		if roster == null:
			return false
	var count = roster.count if roster != null else 12
	if not data.get("cars") is Array or data.cars.size() != count:
		return false
	if (
		data.has("performance_profiles")
		and not RacePerformanceProfile.validate_set(data.performance_profiles, count).is_empty()
	):
		return false
	if not _valid_session_envelope(data, count):
		return false
	if not _valid_entrants(data, count, setup_profile, tyres):
		return false
	if not _valid_pit_ownership(data, roster, count):
		return false
	return true


static func prepare_base(
	data: Dictionary, entrant_defaults: Dictionary, compounds: Dictionary
) -> Dictionary:
	if (
		not RaceStateValue.serializable(data)
		or data.get("kind") != "motorsport-manager-weekend"
		or not RaceCheckpoint.integral(data.get("version"), 1, 4)
	):
		return {}
	if not TrackDocument.validate(data.get("track")).is_empty() or not data.get("cars") is Array:
		return {}
	var count = 12
	if data.has("roster_definition"):
		if data.version < 4:
			return {}
		var roster = RosterDefinition.decode_snapshot(data.roster_definition)
		if roster == null:
			return {}
		count = roster.count
	if data.cars.size() != count:
		return {}
	if (
		data.get("phase")
		not in [
			"practice",
			"practice_results",
			"briefing",
			"qualifying",
			"qualifying_results",
			"race_preparation",
			"formation",
			"grid_ready",
			"lights",
			"race",
			"results"
		]
	):
		return {}
	if (
		not data.get("water") is Array
		or data.water.size() != 96
		or not data.get("rubber") is Array
		or data.rubber.size() != 96
	):
		return {}
	if not _valid_legacy_content_version(data):
		return {}
	data = data.duplicate(true)
	if data.version == 1:
		for c in data.cars:
			if not c is Dictionary:
				return {}
			c.merge(entrant_defaults.duplicate(true))
			# Legacy service had no frozen plan: retain its accepted next compound/repair choice.
			c.service_compound = c.get("next_compound", "M")
			c.service_repair = c.get("repair", true)
			c.pit_lap = c.get("route") == "pit"
	if not _prepare_legacy_inventory(data, compounds):
		return {}
	if not _prepare_legacy_wheels_surface(data):
		return {}
	return data


static func _prepare_legacy_inventory(data: Dictionary, compounds: Dictionary) -> bool:
	if data.version < 3:
		for c in data.cars:
			if not c is Dictionary or not c.get("compound") in compounds:
				return false
			if (
				not RaceCheckpoint.integral(c.get("id"), 0, 11)
				or not TrackDocument.valid_number(c.get("tyre"), 0, 100)
				or not TrackDocument.valid_number(c.get("temperature"), 0, 200)
			):
				return false
			if not c.has("tyre_sets"):
				TyreInventory.initialize_record(c)
			if not c.get("service_set_id", "") is String:
				return false
			if c.get("pit_stage") == "service" and c.get("service_set_id", "").is_empty():
				if not c.get("service_compound") in compounds:
					return false
				if not _valid_legacy_service_inventory(c, compounds):
					return false
				var item = TyreInventory.choose_from(
					c.tyre_sets, c.set_id, c.service_compound, true
				)
				c.service_set_id = item.get("id", "")
	return true


static func _valid_legacy_service_inventory(car: Dictionary, compounds: Dictionary) -> bool:
	if not car.get("tyre_sets") is Array or not car.get("set_id") is String:
		return false
	for item in car.tyre_sets:
		if not item is Dictionary or not item.get("id") is String:
			return false
		if (
			item.get("compound") not in compounds
			or not number(item.get("life"), 0, 100)
			or not integral(item.get("mounts"), 0, 100000)
		):
			return false
		if item.has("wheels") and not _valid_legacy_service_wheels(item.wheels):
			return false
	return true


static func _valid_legacy_service_wheels(wheels: Variant) -> bool:
	if not wheels is Dictionary:
		return false
	for key in WheelTyres.KEYS:
		var wheel = wheels.get(key)
		if (
			not wheel is Dictionary
			or not wheel.get("punctured") is bool
			or not number(wheel.get("life"), 0, 100)
		):
			return false
	return true


static func _prepare_legacy_wheels_surface(data: Dictionary) -> bool:
	if data.version < 4:
		for car in data.cars:
			if not car is Dictionary or not car.get("tyre_sets") is Array:
				return false
			for item in car.tyre_sets:
				if (
					not item is Dictionary
					or not TrackDocument.valid_number(item.get("life"), 0, 100)
					or not TrackDocument.valid_number(item.get("temperature"), 0, 200)
				):
					return false
				WheelTyres.initialize(item)
			CarSetup.initialize_record(car)
	if data.version < 4:
		var legacy_geometry = TrackGeometry.new(data.track, data.get("vehicle", "Formula"))
		for values in [data.water, data.rubber]:
			for value in values:
				if not TrackDocument.valid_number(value, 0, 1):
					return false
		data.surface = RaceSurface.create(legacy_geometry, data.water, data.rubber)
		data.surface_accumulator = 0.0
	return true


static func _valid_legacy_content_version(data: Dictionary) -> bool:
	if (data.has("tuning_definition") or data.has("weekend_definition")) and data.version < 4:
		return false
	if data.has("mechanic_definition") and data.version < 4:
		return false
	if data.has("setup_definition") and data.version < 4:
		return false
	if data.has("tyre_definition") and data.version < 4:
		return false
	if data.has("vehicle_definition") and data.version < 4:
		return false
	return true


static func _valid_session_envelope(data: Dictionary, count: int) -> bool:
	if not integral(data.get("selected_id"), 0, count - 1):
		return false
	if not _valid_session_policy(data):
		return false
	if not integral(data.get("yellow_sector"), -1, 2):
		return false
	if not number(data.get("accumulator"), 0, 10):
		return false
	if not _valid_session_history(data):
		return false
	return true


static func _valid_entrants(
	data: Dictionary, count: int, setup_profile: SetupDefinition, tyres: RaceTyreRules
) -> bool:
	var grids: Array = []
	for c in data.cars:
		if not c is Dictionary:
			return false
		if not _valid_car_indices(c, count):
			return false
		if c.get("grid") in grids:
			return false
		grids.append(c.get("grid"))
		if not CarSetup.valid(c, setup_profile):
			return false
		if not TyreInventory.valid(c, int(data.get("laps", 12)), tyres):
			return false
		if not _valid_car_condition(c, tyres):
			return false
	return true
