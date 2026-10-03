class_name PracticeRaceSim
extends RaceSim
## Compatibility construction/restore profile. Runtime rules live in composed mechanics.
const PRACTICE_CHECKPOINT_VERSION = 10


func _init(
	geometry: TrackGeometry = null, options: Dictionary = {}, roster: RosterDefinition = null
) -> void:
	super(geometry, options, roster)
	if not last_error.is_empty():
		return
	if (
		not mechanics.configure(RaceMechanicProfiles.build("practice", mechanic_definition))
		or not mechanics.install(geometry, options)
	):
		last_error = mechanics.last_error


static func restore_practice(data: Dictionary) -> PracticeRaceSim:
	if not RaceStateValue.serializable(data) or not WeekendDefinition.agrees_with_snapshot(data):
		return null
	if not RaceCheckpoint.integral(data.get("version"), 1, TacticalDuels.CHECKPOINT_VERSION):
		return null
	if not _valid_profile_inputs(data):
		return null
	var native = int(data.version) >= 9
	var native_styles = int(data.version) >= PRACTICE_CHECKPOINT_VERSION
	var native_duels = (
		int(data.version)
		in [TacticalDuels.LEGACY_CHECKPOINT_VERSION, TacticalDuels.CHECKPOINT_VERSION]
	)
	var profiles = data.get("performance_profiles", [])
	if not native_duels and data.has("duel_state"):
		return null
	if not native and data.get("phase") in ["practice", "practice_results"]:
		return null
	var inherited = data.duplicate(true)
	if native:
		inherited.version = 8
		inherited.erase("practice_state")
		inherited.erase("rival_styles")
		inherited.erase("duel_state")
		inherited.erase("performance_profiles")
	var base = RecoveryRaceSim.restore_recovery(inherited)
	if base == null:
		return null
	var state = (
		data.get("practice_state")
		if native
		else PracticeEvidence.create(
			base.cars,
			base.tuning.practice_duration(base.track.estimate),
			"legacy",
			base.tuning.balance.practice
		)
	)
	if (
		not PracticeEvidence.valid(state, base)
		or not PracticeEvidence.valid_records(base.strategy_state.records, state)
	):
		return null
	var styles = data.get("rival_styles") if native_styles else RivalStyles.create(base.cars, false)
	if not RivalStyles.valid(
		styles,
		base.cars,
		base.total_time,
		base.tuning.competition,
		base.tuning.to_record().has("competition")
	):
		return null
	if native_duels and not TacticalDuels.valid(data.get("duel_state"), base):
		return null
	var options = base.content_options()
	options.rival_styles = false
	if not profiles.is_empty():
		options.performance_profiles = profiles.duplicate(true)
	var sim = PracticeRaceSim.new(base.track, options)
	for key in base.snapshot():
		if (
			key
			not in [
				"kind",
				"version",
				"track",
				"vehicle",
				"vehicle_definition",
				"roster_definition",
				"tyre_definition",
				"setup_definition",
				"tuning_definition",
				"weekend_definition",
				"mechanic_definition",
				"performance_profiles"
			]
		):
			sim.set(key, base.get(key))
	sim.practice_state = state.duplicate(true)
	sim.rival_styles = styles.duplicate(true)
	if native_duels:
		sim.duel_state = data.duel_state.duplicate(true)
	return sim


static func _valid_profile_inputs(data: Dictionary) -> bool:
	if not data.get("cars") is Array:
		return false
	return (
		not data.has("performance_profiles")
		or (
			RacePerformanceProfile
			. validate_set(data.performance_profiles, data.cars.size())
			. is_empty()
		)
	)
