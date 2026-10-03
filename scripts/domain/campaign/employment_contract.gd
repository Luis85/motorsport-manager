class_name CampaignEmploymentContract
extends RefCounted
## Dated employment terms. Lifecycle status is derived from authoritative time.
const MAX_INSTALLMENTS = 260
const MAX_REASON_LENGTH = 240
const MAX_CAPACITY_BPS = 10000
const MIN_PAY_INTERVAL = CampaignClock.SLOTS_PER_DAY
const MAX_PAY_INTERVAL = CampaignClock.SLOTS_PER_DAY * 366


static func build(input: Dictionary, signed_slot: int) -> Dictionary:
	var start_slot = input.get("start_slot")
	var end_slot = input.get("end_slot")
	var interval = input.get("pay_interval_slots")
	var payroll_ids: Array = []
	if (
		RaceCheckpoint.integral(start_slot, signed_slot, CampaignClock.MAX_ELAPSED_SLOTS)
		and RaceCheckpoint.integral(end_slot, int(start_slot) + 1, CampaignClock.MAX_ELAPSED_SLOTS)
		and RaceCheckpoint.integral(interval, MIN_PAY_INTERVAL, MAX_PAY_INTERVAL)
		and (int(end_slot) - int(start_slot)) % int(interval) == 0
	):
		payroll_ids = payroll_ids_for(
			str(input.get("id", "")), int(start_slot), int(end_slot), int(interval)
		)
	var data = {
		"id": input.get("id"),
		"person_id": input.get("person_id"),
		"account_id": input.get("account_id"),
		"signed_slot": signed_slot,
		"start_slot": start_slot,
		"end_slot": end_slot,
		"pay_interval_slots": interval,
		"pay_minor": input.get("pay_minor"),
		"capacity_bps": input.get("capacity_bps", MAX_CAPACITY_BPS),
		"renewal_window_slots": input.get("renewal_window_slots", interval),
		"predecessor_contract_id": input.get("predecessor_contract_id", ""),
		"successor_contract_id": "",
		"terminated_slot": -1,
		"termination_reason": "",
		"payroll_commitment_ids": payroll_ids
	}
	data["terms_digest"] = terms_digest(data)
	_seal(data)
	return data if validate(data).is_empty() else {}


static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign employment contract exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 17:
		return "Campaign employment contract has an unsupported shape."
	var error = _identity_error(data)
	if not error.is_empty():
		return error
	error = _terms_error(data)
	if not error.is_empty():
		return error
	error = _termination_error(data)
	if not error.is_empty():
		return error
	error = _payroll_error(data)
	if not error.is_empty():
		return error
	return _integrity_error(data)


static func status_at(data: Dictionary, slot: int) -> String:
	if not validate(data).is_empty() or slot < int(data.signed_slot):
		return "unknown"
	if int(data.terminated_slot) >= 0 and slot >= int(data.terminated_slot):
		return "terminated"
	if slot < int(data.start_slot):
		return "signed_future"
	if slot >= int(data.end_slot):
		return "expired"
	if slot >= int(data.end_slot) - int(data.renewal_window_slots):
		return "renewal_window"
	return "active"


static func effective_end(data: Dictionary) -> int:
	return (
		mini(int(data.end_slot), int(data.terminated_slot))
		if int(data.terminated_slot) >= 0
		else int(data.end_slot)
	)


static func terminate(current: Dictionary, slot: int, reason: String) -> Dictionary:
	if (
		not validate(current).is_empty()
		or int(current.terminated_slot) >= 0
		or slot < int(current.signed_slot)
		or slot > int(current.end_slot)
		or reason.strip_edges().is_empty()
		or reason.length() > MAX_REASON_LENGTH
	):
		return {}
	var data = current.duplicate(true)
	data.terminated_slot = slot
	data.termination_reason = reason
	_seal(data)
	return data if validate(data).is_empty() else {}


static func with_successor(current: Dictionary, successor_id: String) -> Dictionary:
	if (
		not validate(current).is_empty()
		or not current.successor_contract_id.is_empty()
		or not CampaignIdentity.valid(successor_id)
	):
		return {}
	var data = current.duplicate(true)
	data.successor_contract_id = successor_id
	_seal(data)
	return data if validate(data).is_empty() else {}


static func payroll_ids_for(
	contract_id: String, start_slot: int, end_slot: int, interval: int
) -> Array:
	var result: Array = []
	if not CampaignIdentity.valid(contract_id) or interval <= 0:
		return result
	var due_slot = start_slot + interval
	while due_slot <= end_slot and result.size() < MAX_INSTALLMENTS:
		result.append(_payroll_id(contract_id, due_slot))
		due_slot += interval
	return result


static func payroll_inputs(contract: Dictionary) -> Array:
	var result: Array = []
	if not validate(contract).is_empty():
		return result
	var due_slot = int(contract.start_slot) + int(contract.pay_interval_slots)
	for commitment_id in contract.payroll_commitment_ids:
		result.append(
			{
				"id": commitment_id,
				"account_id": contract.account_id,
				"source_id": contract.id,
				"due_slot": due_slot,
				"amount_minor": -int(contract.pay_minor),
				"category": "payroll"
			}
		)
		due_slot += int(contract.pay_interval_slots)
	return result


static func terms_digest(data: Dictionary) -> String:
	return RaceStateValue.fingerprint(
		{
			"id": data.get("id"),
			"person_id": data.get("person_id"),
			"account_id": data.get("account_id"),
			"signed_slot": data.get("signed_slot"),
			"start_slot": data.get("start_slot"),
			"end_slot": data.get("end_slot"),
			"pay_interval_slots": data.get("pay_interval_slots"),
			"pay_minor": data.get("pay_minor"),
			"capacity_bps": data.get("capacity_bps"),
			"renewal_window_slots": data.get("renewal_window_slots"),
			"predecessor_contract_id": data.get("predecessor_contract_id"),
			"payroll_commitment_ids": data.get("payroll_commitment_ids")
		}
	)


static func _identity_error(data: Dictionary) -> String:
	for key in ["id", "person_id", "account_id"]:
		if not CampaignIdentity.valid(data.get(key)):
			return "Campaign employment contract has an invalid " + key + "."
	for key in ["predecessor_contract_id", "successor_contract_id"]:
		if (
			not data.get(key) is String
			or (not data[key].is_empty() and not CampaignIdentity.valid(data[key]))
		):
			return "Campaign employment contract has an invalid " + key + "."
	return ""


static func _terms_error(data: Dictionary) -> String:
	if (
		not RaceCheckpoint.integral(data.get("signed_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
		or not RaceCheckpoint.integral(
			data.get("start_slot"), int(data.signed_slot), CampaignClock.MAX_ELAPSED_SLOTS
		)
		or not RaceCheckpoint.integral(
			data.get("end_slot"), int(data.start_slot) + 1, CampaignClock.MAX_ELAPSED_SLOTS
		)
	):
		return "Campaign employment contract has invalid effective dates."
	if not RaceCheckpoint.integral(
		data.get("pay_interval_slots"), MIN_PAY_INTERVAL, MAX_PAY_INTERVAL
	):
		return "Campaign employment contract has an invalid payroll interval."
	var duration = int(data.end_slot) - int(data.start_slot)
	if duration % int(data.pay_interval_slots) != 0:
		return "Campaign employment contract duration must contain complete payroll intervals."
	var installment_count = int(duration / int(data.pay_interval_slots))
	if installment_count < 1 or installment_count > MAX_INSTALLMENTS:
		return "Campaign employment contract has an unsupported payroll installment count."
	if (
		not RaceCheckpoint.integral(data.get("pay_minor"), 1, CampaignEconomy.MAX_MINOR)
		or not RaceCheckpoint.integral(data.get("capacity_bps"), 1, MAX_CAPACITY_BPS)
	):
		return "Campaign employment contract has invalid compensation or capacity."
	if not RaceCheckpoint.integral(data.get("renewal_window_slots"), 0, duration):
		return "Campaign employment contract has an invalid renewal window."
	return ""


static func _termination_error(data: Dictionary) -> String:
	if (
		not RaceCheckpoint.integral(
			data.get("terminated_slot"), -1, CampaignClock.MAX_ELAPSED_SLOTS
		)
		or not data.get("termination_reason") is String
		or data.termination_reason.length() > MAX_REASON_LENGTH
	):
		return "Campaign employment contract has invalid termination evidence."
	if int(data.terminated_slot) == -1:
		if data.termination_reason.is_empty():
			return ""
		return "Active campaign employment contract has a termination reason."
	if (
		int(data.terminated_slot) < int(data.signed_slot)
		or int(data.terminated_slot) > int(data.end_slot)
		or data.termination_reason.strip_edges().is_empty()
	):
		return "Terminated campaign employment contract has invalid dated evidence."
	return ""


static func _payroll_error(data: Dictionary) -> String:
	var expected_ids = payroll_ids_for(
		data.id, int(data.start_slot), int(data.end_slot), int(data.pay_interval_slots)
	)
	if (
		not data.get("payroll_commitment_ids") is Array
		or data.payroll_commitment_ids != expected_ids
	):
		return "Campaign employment contract payroll schedule is invalid."
	if (
		not CampaignIdentity.valid_hash(data.get("terms_digest"))
		or data.terms_digest != terms_digest(data)
	):
		return "Campaign employment contract terms integrity check failed."
	return ""


static func _integrity_error(data: Dictionary) -> String:
	var content = data.duplicate(true)
	content.erase("digest")
	if (
		not CampaignIdentity.valid_hash(data.get("digest"))
		or data.digest != RaceStateValue.fingerprint(content)
	):
		return "Campaign employment contract integrity check failed."
	return ""


static func _payroll_id(contract_id: String, due_slot: int) -> String:
	return "payroll." + RaceStateValue.fingerprint([contract_id, due_slot]).substr(0, 24)


static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
