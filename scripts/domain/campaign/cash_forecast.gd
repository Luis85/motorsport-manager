class_name CampaignCashForecast
extends RefCounted
## Read-only committed/conservative/optimistic cash projection. Assumptions are
## explicit detached inputs and never become spendable cash or ledger postings.
const KIND = "motorsport-manager-campaign-cash-forecast"
const VERSION = 1
const MAX_ASSUMPTIONS = 512
const SCENARIOS = ["conservative", "optimistic"]
const MAX_MINOR = CampaignWeekendPolicy.MAX_MINOR

static func build(economy: Dictionary, account_id: String, from_slot: int,
		through_slot: int, assumptions: Array = []) -> Dictionary:
	var error = CampaignEconomy.validate(economy)
	if not error.is_empty():
		return {"ok": false, "error": error}
	if int(economy.version) != CampaignEconomy.VERSION:
		return {"ok": false, "error": "Cash forecast requires commitment-aware campaign economy version 2."}
	if not economy.accounts.has(account_id):
		return {"ok": false, "error": "Cash forecast references an unknown account."}
	if not RaceCheckpoint.integral(from_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS) \
			or not RaceCheckpoint.integral(through_slot, from_slot, CampaignClock.MAX_ELAPSED_SLOTS):
		return {"ok": false, "error": "Cash forecast has an invalid horizon."}
	var assumption_error = _assumption_error(assumptions, account_id, from_slot, through_slot)
	if not assumption_error.is_empty():
		return {"ok": false, "error": assumption_error}
	var committed: Array = []
	for commitment in economy.commitments.values():
		if commitment.account_id != account_id or commitment.status != "open" \
				or int(commitment.due_slot) > through_slot:
			continue
		committed.append(_movement(
			commitment.id,
			maxi(from_slot, int(commitment.due_slot)),
			int(commitment.amount_minor),
			commitment.category,
			"commitment",
			int(commitment.due_slot) < from_slot,
			int(commitment.due_slot)
		))
	var conservative = committed.duplicate(true)
	var optimistic = committed.duplicate(true)
	for assumption in assumptions:
		var movement = _movement(
			assumption.id,
			int(assumption.slot),
			int(assumption.amount_minor),
			assumption.category,
			"assumption",
			false,
			int(assumption.slot)
		)
		if assumption.scenario == "conservative":
			conservative.append(movement)
			optimistic.append(movement.duplicate(true))
		else:
			optimistic.append(movement)
	var reserve_minor = 0
	if economy.reserve_policies.has(account_id):
		reserve_minor = int(economy.reserve_policies[account_id].minimum_cash_minor)
	var current_cash = int(economy.accounts[account_id].cash_minor)
	var data = {
		"kind": KIND,
		"version": VERSION,
		"source_digest": economy.digest,
		"account_id": account_id,
		"from_slot": from_slot,
		"through_slot": through_slot,
		"coverage_from_slot": int(economy.authority_from_slot),
		"coverage_complete": from_slot >= int(economy.authority_from_slot),
		"current_cash_minor": current_cash,
		"reserve_minor": reserve_minor,
		"scenarios": {
			"committed": _scenario(current_cash, from_slot, committed, reserve_minor),
			"conservative": _scenario(current_cash, from_slot, conservative, reserve_minor),
			"optimistic": _scenario(current_cash, from_slot, optimistic, reserve_minor)
		},
		"assumptions_digest": RaceStateValue.fingerprint(assumptions)
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return {"ok": true, "error": "", "forecast": data}

static func _assumption_error(assumptions: Variant, account_id: String,
		from_slot: int, through_slot: int) -> String:
	if not assumptions is Array or assumptions.size() > MAX_ASSUMPTIONS:
		return "Cash forecast assumptions are not a bounded array."
	var ids = {}
	for item in assumptions:
		if not item is Dictionary or item.size() != 7:
			return "Cash forecast assumption has an unsupported shape."
		for key in ["id", "account_id", "source_id"]:
			if not CampaignIdentity.valid(item.get(key)):
				return "Cash forecast assumption has an invalid " + key + "."
		if item.account_id != account_id or ids.has(item.id):
			return "Cash forecast assumption has a repeated identity or another account."
		ids[item.id] = true
		if not RaceCheckpoint.integral(item.get("slot"), from_slot, through_slot) \
				or not RaceCheckpoint.integral(item.get("amount_minor"), -MAX_MINOR, MAX_MINOR) \
				or int(item.amount_minor) == 0:
			return "Cash forecast assumption has invalid timing or amount."
		if item.get("category") not in CampaignCashCommitment.CATEGORIES \
				or item.get("scenario") not in SCENARIOS:
			return "Cash forecast assumption has an invalid category or scenario."
	return ""

static func _movement(id: String, slot: int, amount_minor: int, category: String,
		kind: String, overdue: bool, source_slot: int) -> Dictionary:
	return {
		"id": id,
		"slot": slot,
		"source_slot": source_slot,
		"amount_minor": amount_minor,
		"category": category,
		"kind": kind,
		"overdue": overdue
	}

static func _scenario(opening_cash: int, from_slot: int,
		movements: Array, reserve_minor: int) -> Dictionary:
	var ordered = _ordered(movements)
	var cash = opening_cash
	var minimum = opening_cash
	var minimum_slot = from_slot
	var index = 0
	while index < ordered.size():
		var slot = int(ordered[index].slot)
		var delta = 0
		while index < ordered.size() and int(ordered[index].slot) == slot:
			delta += int(ordered[index].amount_minor)
			index += 1
		cash += delta
		if cash < minimum:
			minimum = cash
			minimum_slot = slot
	return {
		"ending_cash_minor": cash,
		"minimum_cash_minor": minimum,
		"minimum_slot": minimum_slot,
		"reserve_gap_minor": maxi(0, reserve_minor - minimum),
		"breaches_reserve": minimum < reserve_minor,
		"movements": ordered
	}

static func _ordered(source: Array) -> Array:
	var ordered: Array = []
	for movement in source:
		var inserted = false
		for index in range(ordered.size()):
			if int(movement.slot) < int(ordered[index].slot) \
					or (int(movement.slot) == int(ordered[index].slot) and str(movement.id) < str(ordered[index].id)):
				ordered.insert(index, movement.duplicate(true))
				inserted = true
				break
		if not inserted:
			ordered.append(movement.duplicate(true))
	return ordered
