class_name CampaignInventory
extends RefCounted
## Exact returned race resources by stable car identity. Consumption is not inferred.
const KIND = "motorsport-manager-campaign-inventory"
const VERSION = 1
const MAX_EVENTS = 1024
const MAX_CARS = 4096
const MAX_TYRE_SETS = 64

static func empty(campaign_id: String) -> Dictionary:
	if not CampaignIdentity.valid(campaign_id):
		return {}
	var data = {
		"kind": KIND,
		"version": VERSION,
		"campaign_id": campaign_id,
		"cars": {},
		"events": {}
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data

static func stage(current: Dictionary, receipt: Dictionary, return_slot: int) -> Dictionary:
	var data = empty(receipt.get("campaign_id", "")) if current.is_empty() else current.duplicate(true)
	var error = validate(data)
	if not error.is_empty():
		return {"ok": false, "status": "rejected", "error": error}
	error = CampaignWeekendReceipt.validate(receipt)
	if not error.is_empty():
		return {"ok": false, "status": "rejected", "error": error}
	if data.campaign_id != receipt.campaign_id or not RaceCheckpoint.integral(return_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return {"ok": false, "status": "rejected", "error": "Campaign inventory identity or return slot is invalid."}
	var event_id: String = receipt.campaign_event_id
	if data.events.has(event_id):
		var previous: Dictionary = data.events[event_id]
		if previous.result_digest == receipt.result_digest:
			return {"ok": true, "status": "already_applied", "inventory": data}
		return {"ok": false, "status": "conflict", "error": "Inventory return already exists for this event under different evidence."}
	if data.events.size() >= MAX_EVENTS:
		return {"ok": false, "status": "rejected", "error": "Campaign inventory event history is full."}
	var returns: Array = []
	for row in receipt.returned_resources:
		var returned = row.duplicate(true)
		returned["event_id"] = event_id
		returned["result_digest"] = receipt.result_digest
		returned["return_slot"] = return_slot
		returns.append(returned)
		data.cars[returned.car_id] = returned.duplicate(true)
	data.events[event_id] = {
		"result_digest": receipt.result_digest,
		"return_slot": return_slot,
		"returns": returns
	}
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
	error = validate(data)
	return {"ok": error.is_empty(), "status": "applied" if error.is_empty() else "rejected",
		"error": error, "inventory": data if error.is_empty() else current.duplicate(true)}

static func correct_event(current: Dictionary, receipt: Dictionary, return_slot: int) -> Dictionary:
	var data = current.duplicate(true)
	var error = validate(data)
	if not error.is_empty(): return {"ok": false, "status": "rejected", "error": error, "inventory": current.duplicate(true)}
	error = CampaignWeekendReceipt.validate(receipt)
	if not error.is_empty(): return {"ok": false, "status": "rejected", "error": error, "inventory": current.duplicate(true)}
	var event_id: String = receipt.campaign_event_id
	if not data.events.has(event_id) or int(data.events[event_id].return_slot) != return_slot:
		return {"ok": false, "status": "rejected", "error": "Inventory correction requires the original event return slot.", "inventory": current.duplicate(true)}
	var returns: Array = []
	for row in receipt.returned_resources:
		var returned = row.duplicate(true)
		returned["event_id"] = event_id
		returned["result_digest"] = receipt.result_digest
		returned["return_slot"] = return_slot
		returns.append(returned)
	data.events[event_id] = {"result_digest": receipt.result_digest, "return_slot": return_slot, "returns": returns}
	var refs: Array = []
	for id in data.events: refs.append({"id": id, "slot": int(data.events[id].return_slot)})
	refs.sort_custom(func(a,b): return int(a.slot) < int(b.slot) or (int(a.slot)==int(b.slot) and str(a.id)<str(b.id)))
	data.cars = {}
	for ref in refs:
		for returned in data.events[ref.id].returns: data.cars[returned.car_id] = returned.duplicate(true)
	data.erase("digest"); data["digest"] = RaceStateValue.fingerprint(data)
	error = validate(data)
	return {"ok": error.is_empty(), "status": "corrected" if error.is_empty() else "rejected",
		"error": error, "inventory": data if error.is_empty() else current.duplicate(true)}

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign inventory exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 6 or data.get("kind") != KIND:
		return "Unsupported campaign inventory projection."
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION) or not CampaignIdentity.valid(data.get("campaign_id")):
		return "Campaign inventory version or identity is invalid."
	if not data.get("cars") is Dictionary or data.cars.size() > MAX_CARS or not data.get("events") is Dictionary or data.events.size() > MAX_EVENTS:
		return "Campaign inventory collections are invalid."
	var ordered_events: Array = []
	for event_id in data.events:
		if not CampaignIdentity.valid(event_id):
			return "Campaign inventory has an invalid event identity."
		var event = data.events[event_id]
		if not event is Dictionary or event.size() != 3 or not CampaignIdentity.valid_hash(event.get("result_digest")):
			return "Campaign inventory event has an unsupported shape."
		if not RaceCheckpoint.integral(event.get("return_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS):
			return "Campaign inventory event has an invalid return slot."
		if not event.get("returns") is Array or event.returns.size() < 2 or event.returns.size() > CampaignWeekendReceipt.MAX_ENTRANTS:
			return "Campaign inventory event has an invalid return collection."
		var cars = {}
		for returned in event.returns:
			var row_error = _return_error(returned, event_id, event.result_digest, int(event.return_slot))
			if not row_error.is_empty():
				return row_error
			if cars.has(returned.car_id):
				return "Campaign inventory event repeats a car identity."
			cars[returned.car_id] = true
		ordered_events.append({"id": event_id, "slot": int(event.return_slot)})
	ordered_events.sort_custom(func(a, b): return int(a.slot) < int(b.slot) \
		or (int(a.slot) == int(b.slot) and str(a.id) < str(b.id)))
	var rebuilt = {}
	for event_ref in ordered_events:
		for returned in data.events[event_ref.id].returns:
			rebuilt[returned.car_id] = returned
	if RaceStateValue.fingerprint(rebuilt) != RaceStateValue.fingerprint(data.cars):
		return "Campaign current inventory disagrees with its dated return history."
	for car_id in data.cars:
		if car_id != data.cars[car_id].get("car_id"):
			return "Campaign inventory key and car identity disagree."
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign inventory integrity check failed."
	return ""

static func _return_error(data: Variant, event_id: String, result_digest: String, return_slot: int) -> String:
	if not data is Dictionary or data.size() != 9:
		return "Campaign returned resource has an unsupported shape."
	for key in ["person_id", "team_id", "car_id"]:
		if not CampaignIdentity.valid(data.get(key)):
			return "Campaign returned resource has an invalid stable identity."
	if data.get("event_id") != event_id or data.get("result_digest") != result_digest or int(data.get("return_slot", -1)) != return_slot:
		return "Campaign returned resource provenance is invalid."
	if not RaceCheckpoint.number(data.get("health"), 0, 100) or not RaceCheckpoint.number(data.get("damage"), 0, 100):
		return "Campaign returned resource condition is invalid."
	if not data.get("tyres") is Array or data.tyres.size() > MAX_TYRE_SETS or not RaceStateValue.serializable(data.tyres):
		return "Campaign returned tyre inventory is invalid."
	return ""
