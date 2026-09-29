class_name PracticeRaceSim
extends RaceSim
## Compatibility construction/restore profile. Runtime rules live in composed mechanics.
const PRACTICE_CHECKPOINT_VERSION = 10

func _init(geometry: TrackGeometry = null, options: Dictionary = {}, roster: RosterDefinition = null) -> void:
	super(geometry, options, roster)
	if not last_error.is_empty(): return
	mechanics.configure(RaceMechanicProfiles.build("practice"))
	mechanics.install(geometry, options)

static func restore_practice(data: Dictionary) -> PracticeRaceSim:
	if not WeekendDefinition.agrees_with_snapshot(data): return null
	if not RaceCheckpoint.integral(data.get("version"), 1, TacticalDuels.CHECKPOINT_VERSION): return null
	var native = int(data.version) >= 9
	var native_styles = int(data.version) >= PRACTICE_CHECKPOINT_VERSION
	var native_duels = int(data.version) == TacticalDuels.CHECKPOINT_VERSION
	if not native_duels and data.has("duel_state"): return null
	if not native and data.get("phase") in ["practice", "practice_results"]: return null
	var inherited = data.duplicate(true)
	if native: inherited.version = 8; inherited.erase("practice_state"); inherited.erase("rival_styles"); inherited.erase("duel_state")
	var base = RecoveryRaceSim.restore_recovery(inherited)
	if base == null: return null
	var state = data.get("practice_state") if native else PracticeEvidence.create(base.cars, base.tuning.practice_duration(base.track.estimate), "legacy")
	if not PracticeEvidence.valid(state, base) or not PracticeEvidence.valid_records(base.strategy_state.records, state): return null
	var styles = data.get("rival_styles") if native_styles else RivalStyles.create(base.cars, false)
	if not RivalStyles.valid(styles, base.cars, base.total_time, base.tuning.competition, base.tuning.to_record().has("competition")): return null
	if native_duels and not TacticalDuels.valid(data.get("duel_state"), base): return null
	var options = base.content_options()
	options.rival_styles = false
	var sim = PracticeRaceSim.new(base.track, options)
	for key in base.snapshot():
		if key not in ["kind", "version", "track", "vehicle", "vehicle_definition", "roster_definition", "tyre_definition", "setup_definition", "tuning_definition", "weekend_definition"]: sim.set(key, base.get(key))
	sim.practice_state = state.duplicate(true)
	sim.rival_styles = styles.duplicate(true)
	if native_duels: sim.duel_state = data.duel_state.duplicate(true)
	return sim
