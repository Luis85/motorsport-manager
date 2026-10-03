class_name StrategyRaceSim
extends RaceSim
## Compatibility construction/restore profile. Runtime rules live in composed mechanics.
const GLOBAL_COMMANDS = [
	"qualify", "close_qualifying", "prepare_race", "formation", "lights", "pause", "speed"
]
const POLICY_COMMANDS = [
	"approve_plan",
	"clear_plan",
	"delegation",
	"resource_intent",
	"hold_decision",
	"retire_car",
	"team_order",
	"cancel_team_order"
]


func _init(
	geometry: TrackGeometry = null, options: Dictionary = {}, roster: RosterDefinition = null
) -> void:
	super(geometry, options, roster)
	if not last_error.is_empty():
		return
	if (
		not mechanics.configure(RaceMechanicProfiles.build("strategy", mechanic_definition))
		or not mechanics.install(geometry, options)
	):
		last_error = mechanics.last_error


static func restore_weekend(data: Dictionary) -> StrategyRaceSim:
	if not WeekendDefinition.agrees_with_snapshot(data):
		return null
	if not RaceCheckpoint.integral(data.get("version"), 1, 6):
		return null
	var legacy = data.duplicate(true)
	var is_strategy = int(legacy.version) >= 5
	var is_living = int(legacy.version) == 6
	if is_strategy:
		legacy.version = 4
		legacy.erase("strategy_state")
	for key in ["battle_state", "team_state", "rival_state"]:
		legacy.erase(key)
	var base = RaceSim.restore(legacy)
	if base == null:
		return null
	var state = data.get("strategy_state") if is_strategy else RaceJournal.create(base.cars)
	if not RaceJournal.valid(state, base.cars, base.laps):
		return null
	var battles = data.get("battle_state") if is_living else RacecraftController.create(base.cars)
	var team = data.get("team_state") if is_living else TeamOrders.create()
	var rivals = data.get("rival_state") if is_living else RivalStrategy.create(base.cars)
	if (
		not RacecraftController.valid(battles, base.cars, base.total_time)
		or not TeamOrders.valid(team, base.cars, base.total_time)
		or not RivalStrategy.valid(rivals, base.cars, base.total_time)
	):
		return null
	var sim = StrategyRaceSim.new(base.track, base.content_options())
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
				"mechanic_definition"
			]
		):
			sim.set(key, base.get(key))
	sim.battle_state = battles.duplicate(true)
	sim.team_state = team.duplicate(true)
	sim.rival_state = rivals.duplicate(true)
	sim.strategy_state = state.duplicate(true)
	sim.strategy_state.sequence = int(sim.strategy_state.sequence)
	for record in sim.strategy_state.records:
		record.driver_id = int(record.driver_id)
		record.tick = int(record.tick)
	for car in sim.cars:
		var p = sim.policy(car.id)
		if not p.has("notices"):
			p.notices = {}
		p.revision = int(p.revision)
		p.next_stop = int(p.next_stop)
		p.driver_id = int(p.driver_id)
		for channel in p.overrides:
			p.overrides[channel].value = int(p.overrides[channel].value)
			p.overrides[channel].previous_value = int(p.overrides[channel].previous_value)
		sim.sync_ownership(car)
	return sim
