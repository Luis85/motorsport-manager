extends RefCounted
## A bounded, persistent mandate for ONE next stop. Physical pit execution stays in RaceSim.
const VERSION = 1
const LEGACY_CHECKPOINT_VERSION = 11
const CHECKPOINT_VERSION = 12
const LEGACY_MODEL = "race-weekend-0.15-duels-v1"
const MODEL = "race-weekend-0.20-performance-v1"
const HISTORY_LIMIT = 8
const EVENT_LIMIT = 20
const STATES = [
	"approved",
	"preparing",
	"ordered",
	"executing",
	"evaluating",
	"review",
	"completed",
	"abandoned"
]
const TERMINAL = ["completed", "abandoned"]
const ACTIONS = ["duel_approve", "duel_cancel"]
## Bounded saved-duel state, active ownership and history validation.


static func valid(state: Variant, sim: RaceSim) -> bool:
	if (
		not state is Dictionary
		or state.size() != 4
		or state.get("version") != VERSION
		or (not state.get("enabled") is bool or not state.enabled)
	):
		return false
	if (
		not RaceCheckpoint.integral(state.get("sequence"), 0, 1000000)
		or not state.get("drivers") is Array
		or state.drivers.size() != sim.cars.size()
	):
		return false
	var ids: Array = []
	for id in range(sim.cars.size()):
		var d = state.drivers[id]
		if (
			not d is Dictionary
			or d.size() != 5
			or d.get("driver_id") != id
			or not RaceCheckpoint.integral(d.get("revision"), 0, 1000000)
		):
			return false
		if (
			not d.get("active") is Dictionary
			or not d.get("history") is Array
			or d.history.size() > HISTORY_LIMIT
			or not d.get("truncated") is bool
		):
			return false
		if (
			not sim.cars[id].player
			and (
				not d.active.is_empty()
				or not d.history.is_empty()
				or d.revision != 0
				or d.truncated
			)
		):
			return false
		var records: Array = d.history.duplicate()
		if not d.active.is_empty():
			records.append(d.active)
		var last = -1.0
		for r in records:
			if not valid_record(r, sim, id) or r.id in ids or r.created_at < last:
				return false
			ids.append(r.id)
			last = r.created_at
			if int(r.id.trim_prefix("duel-")) > state.sequence:
				return false
			if r != d.active and (r.status not in TERMINAL or r.borrowed_pits):
				return false
		if owns(d.active):
			if (
				sim.policy(id).owners.pit != "engineer"
				or sim.policy(id).revision != d.active.policy_revision
			):
				return false
		if not valid_active(d.active, sim, id):
			return false
	return true


static func valid_active(r: Dictionary, sim: RaceSim, id: int) -> bool:
	if r.is_empty() or r.status in TERMINAL + ["review"]:
		return true
	if r.status in ["approved", "preparing"]:
		return r.order_id.is_empty() and r.own_entry < 0 and r.own_exit < 0
	if sim.phase != "race":
		return false
	if r.status == "evaluating":
		return r.own_exit >= 0 and not r.borrowed_pits
	# A claimed accepted/executing tactic must refer to the actual current pit
	# transaction. Otherwise a corrupt save could suppress ordinary pit control
	# forever while waiting for an order which the physical model never received.
	var car = sim.cars[id]
	if not r.borrowed_pits or not car.pit_order or sim.policy(id).last_order_id != r.order_id:
		return false
	if absf(float(car.pit_gate) - float(r.gate)) > 0.00001:
		return false
	if r.status == "ordered":
		return car.route == "track" and r.own_entry < 0
	return r.status == "executing" and car.route == "pit" and r.own_entry >= 0 and r.own_exit < 0


static func valid_record(r: Variant, sim: RaceSim, id: int) -> bool:
	if not r is Dictionary or r.size() != 23 or r.get("driver_id") != id:
		return false
	if (
		not r.get("id") is String
		or not r.id.begins_with("duel-")
		or r.id != "duel-%d" % int(r.id.trim_prefix("duel-"))
		or int(r.id.trim_prefix("duel-")) < 1
	):
		return false
	if (
		not TacticalForecast.validate_plan(r.get("plan"), sim.cars, id, sim.laps).is_empty()
		or r.get("status") not in STATES
	):
		return false
	if (
		not r.get("reason") is String
		or r.reason.length() > 700
		or not r.get("borrowed_pits") is bool
		or r.get("previous_owner") not in ["engineer", "player"]
	):
		return false
	if (
		r.borrowed_pits
		and (r.plan.authority != "execute" or r.status in TERMINAL + ["review", "evaluating"])
	):
		return false
	if not _valid_record_times(r, sim):
		return false
	if not _valid_record_transaction(r, sim, id):
		return false
	if not _valid_record_events(r):
		return false
	var f = r.get("forecast")
	if (
		not f is Dictionary
		or f.size() != 9
		or not f.get("key") is String
		or f.key.length() != 64
		or not f.key.is_valid_hex_number(false)
	):
		return false
	if not f.get("rival_cases") is String or f.rival_cases.length() > 1600:
		return false
	for key in ["time", "seconds", "pit_loss", "warmup", "traffic"]:
		if not RaceCheckpoint.number(f.get(key), 0, 10000000):
			return false
	for key in ["gain", "gap"]:
		if not RaceCheckpoint.number(f.get(key), -10000000, 10000000):
			return false
	return f.time <= r.created_at


static func current(sim, id: int) -> Dictionary:
	if sim.duel_state.is_empty() or not sim.duel_state.enabled:
		return {}
	return sim.duel_state.drivers[id].active


static func live(record: Dictionary) -> bool:
	return not record.is_empty() and record.status not in TERMINAL


static func owns(record: Dictionary) -> bool:
	return live(record) and record.borrowed_pits


static func _valid_record_times(r: Dictionary, sim: RaceSim) -> bool:
	for key in ["created_at", "updated_at"]:
		if not RaceCheckpoint.number(r.get(key), 0, sim.total_time + RaceSim.STEP):
			return false
	if (
		r.updated_at < r.created_at
		or not RaceCheckpoint.number(r.get("next_review"), 0, sim.total_time + 1.1)
	):
		return false
	for key in ["own_entry", "own_exit", "target_entry", "target_exit"]:
		if not RaceCheckpoint.number(r.get(key), -1, sim.total_time + RaceSim.STEP):
			return false
	if r.own_entry >= 0 and r.own_entry < r.created_at:
		return false
	if r.target_entry >= 0 and r.target_entry < r.created_at:
		return false
	if r.own_exit >= 0 and (r.own_entry < 0 or r.own_exit < r.own_entry):
		return false
	if r.target_exit >= 0 and (r.target_entry < 0 or r.target_exit < r.target_entry):
		return false
	return true


static func _valid_record_transaction(r: Dictionary, sim: RaceSim, id: int) -> bool:
	for key in ["own_stops", "target_stops", "policy_revision"]:
		if not RaceCheckpoint.integral(r.get(key), 0, 1000000):
			return false
	if not RaceCheckpoint.integral(r.get("replaced_stop"), -1, 2):
		return false
	if (
		not RaceCheckpoint.number(r.get("gate"), -1, sim.laps * sim.track.length)
		or not r.get("order_id") is String
		or r.order_id.length() > 40
	):
		return false
	if (
		r.order_id.is_empty()
		and (r.gate != -1 or r.own_entry >= 0 or r.status in ["ordered", "executing", "evaluating"])
	):
		return false
	if not r.order_id.is_empty() and r.gate < 0:
		return false
	if r.status == "executing" and r.own_entry < 0:
		return false
	if r.status == "evaluating" and r.own_exit < 0:
		return false
	if (
		r.own_stops > sim.cars[id].pit_stops
		or r.target_stops > sim.cars[int(r.plan.target_id)].pit_stops
	):
		return false
	return true


static func _valid_record_events(r: Dictionary) -> bool:
	if (
		not r.get("events") is Array
		or r.events.is_empty()
		or r.events.size() > EVENT_LIMIT
		or not r.get("events_truncated") is bool
	):
		return false
	var previous = float(r.created_at)
	for event in r.events:
		if (
			not event is Dictionary
			or event.size() != 3
			or event.get("status") not in STATES
			or not event.get("reason") is String
			or event.reason.length() > 700
		):
			return false
		if not RaceCheckpoint.number(event.get("time"), previous, r.updated_at):
			return false
		previous = float(event.time)
	if not r.events_truncated:
		var latest = r.events.back()
		if (
			latest.status != r.status
			or latest.reason != r.reason
			or absf(float(latest.time) - float(r.updated_at)) > 0.00001
		):
			return false
	return true
