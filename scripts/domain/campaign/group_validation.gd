class_name CampaignGroupValidation
extends RefCounted
## Pure validation of detached campaign records.
const MAX_ORDERS = CampaignGroup.MAX_ORDERS
const MAX_TRANSFERS = CampaignGroup.MAX_TRANSFERS
const MAX_PROSPECTS = CampaignGroup.MAX_PROSPECTS
const MAX_ERAS = CampaignGroup.MAX_ERAS
const MAX_SUCCESSIONS = CampaignGroup.MAX_SUCCESSIONS
const MAX_GOALS = CampaignGroup.MAX_GOALS
const ERA_CAPABILITIES = CampaignGroup.ERA_CAPABILITIES


static func validate(data: Variant) -> String:
	if (
		not data is Dictionary
		or data.size() != 10
		or not data.get("initialized") is bool
		or not data.get("founder_id") is String
		or not RaceCheckpoint.integral(
			data.get("opening_parent_cash_minor"), 0, CampaignEconomy.MAX_MINOR
		)
		or not RaceCheckpoint.integral(data.get("parent_cash_minor"), 0, CampaignEconomy.MAX_MINOR)
		or not data.get("business_orders") is Dictionary
		or data.business_orders.size() > MAX_ORDERS
		or not data.get("transfers") is Array
		or data.transfers.size() > MAX_TRANSFERS
		or not data.get("academy") is Dictionary
		or data.academy.size() != 2
		or not data.get("eras") is Dictionary
		or data.eras.size() > MAX_ERAS
		or not data.get("active_era_id") is String
		or not data.get("dynasty") is Dictionary
	):
		return "Campaign group projection is invalid."
	if data.initialized:
		if (
			not CampaignIdentity.valid(data.founder_id)
			or not data.eras.has(data.active_era_id)
			or not CampaignIdentity.valid(data.dynasty.get("operating_principal_id"))
		):
			return "Campaign group initialization is invalid."
	elif not data.founder_id.is_empty() or not data.active_era_id.is_empty():
		return "Uninitialized campaign group has identity."
	var business_error = _business_error(data)
	if not business_error.is_empty():
		return business_error
	if (
		not RaceCheckpoint.integral(data.academy.get("capacity"), 0, MAX_PROSPECTS)
		or not data.academy.get("prospects") is Dictionary
		or data.academy.prospects.size() > int(data.academy.capacity)
	):
		return "Campaign academy is invalid."
	for id in data.academy.prospects:
		if (
			not data.academy.prospects[id] is Dictionary
			or id != data.academy.prospects[id].get("candidate_id")
			or not _prospect_error(data.academy.prospects[id]).is_empty()
		):
			return "Campaign academy prospect is invalid."
	for id in data.eras:
		if (
			not data.eras[id] is Dictionary
			or id != data.eras[id].get("id")
			or not _era_error(data.eras[id]).is_empty()
		):
			return "Campaign era registry is invalid."
	var dynasty_error = _dynasty_error(data)
	if not dynasty_error.is_empty():
		return dynasty_error
	return ""


static func _era_error(d: Variant) -> String:
	if (
		not d is Dictionary
		or d.size() != 6
		or not CampaignIdentity.valid(d.get("id"))
		or not d.get("display_name") is String
		or d.display_name.is_empty()
		or not RaceCheckpoint.integral(d.get("start_year"), 1900, 2200)
		or not d.get("capabilities") is Array
	):
		return "era"
	var seen = {}
	for cap in d.capabilities:
		if cap not in ERA_CAPABILITIES or seen.has(cap):
			return "era cap"
		seen[cap] = true
	return CampaignGroup._digest_error(d)


static func _business_order_error(d: Variant) -> String:
	if (
		not d is Dictionary
		or d.size() != 9
		or not CampaignIdentity.valid(d.get("id"))
		or not d.get("customer") is String
		or d.customer.is_empty()
		or not CampaignIdentity.valid(d.get("work_order_id"))
		or not RaceCheckpoint.integral(d.get("value_minor"), 1, CampaignEconomy.MAX_MINOR)
		or not RaceCheckpoint.integral(d.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
		or not RaceCheckpoint.integral(
			d.get("due_slot"), int(d.created_slot), CampaignClock.MAX_ELAPSED_SLOTS
		)
		or d.get("status") not in ["open", "completed"]
		or not RaceCheckpoint.integral(d.get("completed_slot"), -1, CampaignClock.MAX_ELAPSED_SLOTS)
	):
		return "order"
	if d.status == "open" and int(d.completed_slot) != -1:
		return "open completed"
	if d.status == "completed" and int(d.completed_slot) < int(d.due_slot):
		return "early completion"
	return CampaignGroup._digest_error(d)


static func _transfer_error(d: Variant) -> String:
	if (
		not d is Dictionary
		or d.size() != 5
		or not CampaignIdentity.valid(d.get("id"))
		or not CampaignIdentity.valid(d.get("commitment_id"))
		or not RaceCheckpoint.integral(d.get("slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
		or not RaceCheckpoint.integral(d.get("amount_minor"), 1, CampaignEconomy.MAX_MINOR)
	):
		return "transfer"
	return CampaignGroup._digest_error(d)


static func _prospect_error(d: Variant) -> String:
	if (
		not d is Dictionary
		or d.size() != 4
		or not CampaignIdentity.valid(d.get("candidate_id"))
		or not RaceCheckpoint.integral(d.get("joined_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
		or d.get("status") != "developing"
	):
		return "prospect"
	return CampaignGroup._digest_error(d)


static func _succession_error(d: Variant) -> String:
	if not d is Dictionary or d.size() != 5:
		return "succession"
	for key in ["id", "from_person_id", "to_person_id"]:
		if not CampaignIdentity.valid(d.get(key)):
			return "succession id"
	if not RaceCheckpoint.integral(d.get("slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return "succession slot"
	return CampaignGroup._digest_error(d)


static func _goal_error(d: Variant) -> String:
	if (
		not d is Dictionary
		or d.size() != 7
		or not CampaignIdentity.valid(d.get("id"))
		or not d.get("title") is String
		or d.title.is_empty()
		or d.get("status") not in ["active", "completed"]
		or not RaceCheckpoint.integral(d.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
		or not RaceCheckpoint.integral(d.get("completed_slot"), -1, CampaignClock.MAX_ELAPSED_SLOTS)
		or not d.get("evidence_id") is String
	):
		return "goal"
	if d.status == "active" and int(d.completed_slot) != -1:
		return "active goal complete"
	if (
		d.status == "completed"
		and (
			int(d.completed_slot) < int(d.created_slot) or not CampaignIdentity.valid(d.evidence_id)
		)
	):
		return "goal completion"
	return CampaignGroup._digest_error(d)


static func _business_error(data: Dictionary) -> String:
	var business_work_ids = {}
	for id in data.business_orders:
		var order = data.business_orders[id]
		if (
			not order is Dictionary
			or id != order.get("id")
			or not _business_order_error(order).is_empty()
		):
			return "Campaign founder-business order is invalid."
		if business_work_ids.has(order.work_order_id):
			return "Campaign founder-business work can fund only one customer order."
		business_work_ids[order.work_order_id] = true
	var transfer_ids = {}
	for row in data.transfers:
		if not _transfer_error(row).is_empty() or transfer_ids.has(row.id):
			return "Campaign group transfer history is invalid."
		transfer_ids[row.id] = true
	return ""


static func _dynasty_error(data: Dictionary) -> String:
	if (
		data.dynasty.size() != 3
		or not data.dynasty.get("successions") is Array
		or data.dynasty.successions.size() > MAX_SUCCESSIONS
		or not data.dynasty.get("legacy_goals") is Dictionary
		or data.dynasty.legacy_goals.size() > MAX_GOALS
	):
		return "Campaign dynasty projection is invalid."
	for row in data.dynasty.successions:
		if not _succession_error(row).is_empty():
			return "Campaign succession history is invalid."
	for id in data.dynasty.legacy_goals:
		if (
			not data.dynasty.legacy_goals[id] is Dictionary
			or id != data.dynasty.legacy_goals[id].get("id")
			or not _goal_error(data.dynasty.legacy_goals[id]).is_empty()
		):
			return "Campaign legacy goal registry is invalid."
	return ""
