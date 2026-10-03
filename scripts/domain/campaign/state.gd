class_name CampaignState
extends RefCounted
## Authoritative campaign foundation. Time changes only through accepted commands;
## UI observation, persistence and the race weekend remain external concerns.
const KIND = "motorsport-manager-campaign-state"
const VERSION = 1
const MAX_COMMANDS = 20000
const MAX_INTERVENTIONS = 4096
const MAX_ADVANCE_SLOTS = CampaignClock.SLOTS_PER_DAY * 366 * 5

var campaign_id: String
var organization_id: String
var principal_id: String
var clock: CampaignClock
var energy_capacity: int = 6
var energy_available: int = 6
var founder_busy_until_slot: int = 0
var interventions: Dictionary = {}
var commands: Array = []
var revision: int = 0
var last_error: String = ""


static func create(config: Dictionary) -> CampaignState:
	for key in ["campaign_id", "organization_id", "principal_id"]:
		if not CampaignIdentity.valid(config.get(key)):
			return null
	var initial_clock = CampaignClock.create(config.get("start", {}))
	if (
		initial_clock == null
		or not RaceCheckpoint.integral(config.get("energy_capacity", 6), 1, 24)
	):
		return null
	var result = CampaignState.new()
	result.campaign_id = config.campaign_id
	result.organization_id = config.organization_id
	result.principal_id = config.principal_id
	result.clock = initial_clock
	result.energy_capacity = int(config.get("energy_capacity", 6))
	result.energy_available = result.energy_capacity
	return result


func command(action: String, payload: Dictionary = {}) -> bool:
	if commands.size() >= MAX_COMMANDS:
		return _reject("Campaign command history is full; no state changed.")
	if not RaceStateValue.serializable(payload):
		return _reject("Campaign command exceeds serialized-value limits.")
	var accepted_payload = payload.duplicate(true)
	var before = clock.elapsed_slots
	match action:
		"advance_slots":
			if not _advance(accepted_payload):
				return false
		"intervention":
			if not _intervene(accepted_payload):
				return false
		_:
			return _reject("Unsupported campaign command: " + action + ".")
	_record(action, accepted_payload, before)
	last_error = ""
	return true


func snapshot() -> Dictionary:
	var content = _content()
	content["digest"] = RaceStateValue.fingerprint(content)
	return content


func read() -> Dictionary:
	return RaceStateValue.read_only(snapshot())


static func validate(data: Variant) -> String:
	var replay = _replay(data)
	return replay.get("error", "")


static func restore(data: Variant) -> CampaignState:
	var replay = _replay(data)
	return replay.get("state") if replay.get("ok", false) else null


func _content() -> Dictionary:
	return {
		"kind": KIND,
		"version": VERSION,
		"campaign_id": campaign_id,
		"organization_id": organization_id,
		"principal_id": principal_id,
		"revision": revision,
		"clock": clock.snapshot(),
		"energy_capacity": energy_capacity,
		"energy_available": energy_available,
		"founder_busy_until_slot": founder_busy_until_slot,
		"interventions": interventions.duplicate(true),
		"commands": commands.duplicate(true)
	}


func _record(action: String, payload: Dictionary, before: int) -> void:
	revision += 1
	commands.append(
		{
			"sequence": revision,
			"action": action,
			"payload": payload.duplicate(true),
			"slot_before": before,
			"slot_after": clock.elapsed_slots
		}
	)


func _reject(message: String) -> bool:
	last_error = message
	return false


static func _replay(data: Variant) -> Dictionary:
	var structural_error = _structural_error(data)
	if not structural_error.is_empty():
		return {"ok": false, "error": structural_error}
	var state = create(
		{
			"campaign_id": data.campaign_id,
			"organization_id": data.organization_id,
			"principal_id": data.principal_id,
			"start": data.clock.start,
			"energy_capacity": int(data.energy_capacity)
		}
	)
	if state == null:
		return {"ok": false, "error": "Campaign checkpoint cannot recreate its initial state."}
	for index in range(data.commands.size()):
		var row = data.commands[index]
		if not row is Dictionary or row.size() != 5:
			return {"ok": false, "error": "Campaign command record has an unsupported shape."}
		if (
			not RaceCheckpoint.integral(row.get("sequence"), index + 1, index + 1)
			or not row.get("action") is String
			or not row.get("payload") is Dictionary
		):
			return {"ok": false, "error": "Campaign command sequence or payload is invalid."}
		if not RaceCheckpoint.integral(
			row.get("slot_before"), state.clock.elapsed_slots, state.clock.elapsed_slots
		):
			return {"ok": false, "error": "Campaign command history has a broken time chain."}
		if not state.command(row.action, row.payload):
			return {
				"ok": false,
				"error": "Campaign command history cannot be replayed: " + state.last_error
			}
		if not RaceCheckpoint.integral(
			row.get("slot_after"), state.clock.elapsed_slots, state.clock.elapsed_slots
		):
			return {
				"ok": false, "error": "Campaign command result disagrees with its recorded slot."
			}
	var saved = data.duplicate(true)
	saved.erase("digest")
	if RaceStateValue.fingerprint(state._content()) != RaceStateValue.fingerprint(saved):
		return {"ok": false, "error": "Campaign state disagrees with its accepted command history."}
	return {"ok": true, "error": "", "state": state}


static func _structural_error(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign state exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 13 or data.get("kind") != KIND:
		return "Unsupported campaign state."
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION):
		return "Unsupported campaign state version."
	for key in ["campaign_id", "organization_id", "principal_id"]:
		if not CampaignIdentity.valid(data.get(key)):
			return "Campaign state has an invalid " + key + "."
	if not RaceCheckpoint.integral(data.get("revision"), 0, MAX_COMMANDS):
		return "Campaign state revision is invalid."
	var clock_error = CampaignClock.validate(data.get("clock"))
	if not clock_error.is_empty():
		return clock_error
	if (
		not RaceCheckpoint.integral(data.get("energy_capacity"), 1, 24)
		or not RaceCheckpoint.integral(data.get("energy_available"), 0, int(data.energy_capacity))
	):
		return "Campaign intervention energy is invalid."
	if not RaceCheckpoint.integral(
		data.get("founder_busy_until_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS
	):
		return "Campaign principal availability is invalid."
	if not data.get("interventions") is Dictionary or data.interventions.size() > MAX_INTERVENTIONS:
		return "Campaign intervention collection is invalid."
	var intervention_records_error = _intervention_records_error(data)
	if not intervention_records_error.is_empty():
		return intervention_records_error
	if (
		not data.get("commands") is Array
		or data.commands.size() > MAX_COMMANDS
		or int(data.revision) != data.commands.size()
	):
		return "Campaign command history and revision disagree."
	var content = data.duplicate(true)
	content.erase("digest")
	if (
		not CampaignIdentity.valid_hash(data.get("digest"))
		or data.digest != RaceStateValue.fingerprint(content)
	):
		return "Campaign state integrity check failed."
	return ""


func _advance(accepted_payload: Dictionary) -> bool:
	if (
		accepted_payload.size() != 1
		or not RaceCheckpoint.integral(accepted_payload.get("slots"), 1, MAX_ADVANCE_SLOTS)
	):
		return _reject("Advance requires a bounded positive number of fifteen-minute slots.")
	accepted_payload.slots = int(accepted_payload.slots)
	var previous_day = clock.day_key()
	if not clock.advance(accepted_payload.slots):
		return _reject("Advance would exceed the supported campaign calendar.")
	if clock.day_key() != previous_day:
		energy_available = energy_capacity
	return true


func _intervene(accepted_payload: Dictionary) -> bool:
	if accepted_payload.size() != 3 or not CampaignIdentity.valid(accepted_payload.get("id")):
		return _reject("Intervention requires a stable identity, energy cost and duration.")
	if (
		not RaceCheckpoint.integral(accepted_payload.get("energy"), 1, 2)
		or not RaceCheckpoint.integral(
			accepted_payload.get("duration_slots"), 1, CampaignClock.SLOTS_PER_DAY
		)
	):
		return _reject("Intervention cost or duration is outside the supported bounds.")
	accepted_payload.energy = int(accepted_payload.energy)
	accepted_payload.duration_slots = int(accepted_payload.duration_slots)
	var intervention_error = _intervention_error(accepted_payload)
	if not intervention_error.is_empty():
		return _reject(intervention_error)
	energy_available -= accepted_payload.energy
	founder_busy_until_slot = clock.elapsed_slots + accepted_payload.duration_slots
	interventions[accepted_payload.id] = {
		"energy": accepted_payload.energy,
		"duration_slots": accepted_payload.duration_slots,
		"start_slot": clock.elapsed_slots,
		"end_slot": founder_busy_until_slot
	}
	return true


func _intervention_error(accepted_payload: Dictionary) -> String:
	if interventions.has(accepted_payload.id):
		return "This intervention was already committed."
	if interventions.size() >= MAX_INTERVENTIONS:
		return "Campaign intervention history is full; no state changed."
	if clock.elapsed_slots < founder_busy_until_slot:
		return "The principal is already committed during this campaign slot."
	if accepted_payload.energy > energy_available:
		return "The principal does not have enough intervention energy today."
	if clock.elapsed_slots + accepted_payload.duration_slots > CampaignClock.MAX_ELAPSED_SLOTS:
		return "Intervention would exceed the supported campaign calendar."
	return ""


static func _intervention_records_error(data: Dictionary) -> String:
	for identity in data.interventions:
		var row = data.interventions[identity]
		if not CampaignIdentity.valid(identity) or not row is Dictionary or row.size() != 4:
			return "Campaign intervention record has an unsupported shape."
		if (
			not RaceCheckpoint.integral(row.get("energy"), 1, 2)
			or not RaceCheckpoint.integral(
				row.get("duration_slots"), 1, CampaignClock.SLOTS_PER_DAY
			)
			or not RaceCheckpoint.integral(
				row.get("start_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS
			)
			or not RaceCheckpoint.integral(
				row.get("end_slot"),
				int(row.start_slot) + int(row.duration_slots),
				int(row.start_slot) + int(row.duration_slots)
			)
		):
			return "Campaign intervention record has invalid cost or timing."
	return ""
