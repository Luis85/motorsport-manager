class_name RecoveryRaceSim
extends RaceSim
## Compatibility construction/restore profile. Runtime rules live in composed mechanics.
const RECOVERY_CHECKPOINT_VERSION = 8

func _init(geometry: TrackGeometry = null, options: Dictionary = {}) -> void:
	super(geometry, options)
	mechanics.configure([StrategyMechanic.new(), WeatherMechanic.new(), RecoveryMechanic.new()])
	mechanics.install(geometry, options)

static func restore_recovery(data: Dictionary) -> RecoveryRaceSim:
	if not RaceCheckpoint.integral(data.get("version"), 1, RECOVERY_CHECKPOINT_VERSION): return null
	var native = int(data.version) == RECOVERY_CHECKPOINT_VERSION
	var legacy = data.duplicate(true)
	if native:
		legacy.version = 7; legacy.erase("reliability_state"); legacy.erase("control_state")
		# The old checkpoint validator knows the compatibility enum, not the new procedure.
		if legacy.get("flag") == "VIRTUAL": legacy.flag = "SAFETY CAR"
	var base = WeatherRaceSim.restore_weather(legacy)
	if base == null: return null
	var reliability = data.get("reliability_state") if native else RaceReliability.create(base.cars, base.seed_value, "legacy")
	var control = data.get("control_state") if native else WeekendRaceControl.create()
	if not RaceReliability.valid(reliability, base.cars, base.total_time) or not WeekendRaceControl.valid(control, base.total_time): return null
	if native and reliability.mode == "staged" and data.get("flag") != WeekendRaceControl.flag_value(control): return null
	if reliability.mode == "legacy" and (data.get("flag") == "VIRTUAL" or control != WeekendRaceControl.create()): return null
	if not valid_recovery_records(base.strategy_state.records): return null
	var sim = RecoveryRaceSim.new(base.track)
	for key in base.snapshot():
		if key not in ["kind", "version", "track", "vehicle"]: sim.set(key, base.get(key))
	sim.reliability_state = reliability.duplicate(true); sim.control_state = control.duplicate(true)
	if native: sim.flag = data.flag
	return sim

static func valid_recovery_records(records: Array) -> bool:
	for record in records:
		if record.kind not in ["recovery_rules", "recovery_stage", "recovery_fault", "recovery_decision", "recovery_retirement", "recovery_service", "race_control", "driving_incident"]: continue
		var e = record.evidence
		if not e.get("reason") is String: return false
		if record.kind in ["recovery_stage", "recovery_fault", "recovery_decision", "recovery_retirement", "driving_incident"]:
			if not e.get("observed") is Dictionary or record.driver_id < 0: return false
			var o = e.observed
			if o.get("driver_id") != record.driver_id or o.get("stage") not in RaceReliability.STAGES: return false
			for field in [["health", 0, 100], ["damage", 0, 1000], ["temperature", 0, 200], ["distance", -100000000, 100000000]]:
				if not RaceCheckpoint.number(o.get(field[0]), field[1], field[2]): return false
		if record.kind == "recovery_rules" and e.get("version") != 1: return false
		if record.kind == "recovery_decision" and e.get("action") not in ["recovery_authority", "recovery_repair", "recovery_protect", "recovery_retire"]: return false
		if record.kind == "recovery_stage" and (e.get("from") not in RaceReliability.STAGES or e.get("to") not in RaceReliability.STAGES): return false
		if record.kind == "recovery_service":
			if e.get("stage") not in ["started", "completed"]: return false
			if e.stage == "started":
				if not e.get("job") is Dictionary: return false
				for field in [["started", 0, record.time], ["duration", 0, 200], ["damage_before", 0, 1000], ["health_before", 0, 100], ["repair_seconds", 0, 140]]:
					if not RaceCheckpoint.number(e.job.get(field[0]), field[1], field[2]): return false
				if not e.job.get("repair") is bool or not e.job.get("repair_only") is bool or not e.job.get("set_before") is String: return false
			else:
				for field in [["elapsed", 0, 200], ["damage_before", 0, 1000], ["damage_after", 0, 1000], ["health_before", 0, 100], ["health_after", 0, 100]]:
					if not RaceCheckpoint.number(e.get(field[0]), field[1], field[2]): return false
				if not e.get("set_before") is String or not e.get("set_after") is String: return false
		if record.kind == "race_control":
			if e.get("rule_version") != WeekendRaceControl.VERSION or not e.get("before") is Dictionary or not e.get("after") is Dictionary: return false
	return true
