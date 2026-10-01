class_name CampaignDelegation
extends RefCounted
## Persistent bounded authority. Mandates survive UI sessions and staff handover;
## autonomous execution must pass a scope-specific guard before changing authority.
const MAX_MANDATES = 256
const MAX_DECISIONS = 4096
const SCOPES = ["finance", "operations", "engineering", "commercial", "event_readiness", "personnel"]
const RISK_POSTURES = ["conservative", "balanced", "opportunistic"]

static func empty() -> Dictionary:
	return {"mandates": {}, "decisions": []}

static func create(current: Dictionary, input: Dictionary, created_slot: int) -> Dictionary:
	var error = validate(current)
	if not error.is_empty(): return _reject(error, current)
	if current.mandates.size() >= MAX_MANDATES:
		return _reject("Campaign mandate registry is full.", current)
	var mandate = _build(input, created_slot)
	if mandate.is_empty() or current.mandates.has(mandate.get("id")):
		return _reject("Campaign mandate is invalid or duplicated.", current)
	var data = current.duplicate(true)
	data.mandates[mandate.id] = mandate
	return {"ok": true, "status": "created", "error": "", "delegation": data,
		"mandate": mandate.duplicate(true)}

static func revoke(current: Dictionary, mandate_id: String, slot: int) -> Dictionary:
	var error = validate(current)
	if not error.is_empty(): return _reject(error, current)
	if not current.mandates.has(mandate_id):
		return _reject("Campaign mandate is unknown.", current)
	var mandate: Dictionary = current.mandates[mandate_id]
	if mandate.status != "active" or slot < int(mandate.created_slot) or slot > int(mandate.expiry_slot):
		return _reject("Campaign mandate cannot be revoked in its current state.", current)
	var data = current.duplicate(true)
	mandate = mandate.duplicate(true)
	mandate.status = "revoked"
	mandate.revocation_slot = slot
	_seal_record(mandate)
	data.mandates[mandate_id] = mandate
	return {"ok": true, "status": "revoked", "error": "", "delegation": data}

static func record_decision(current: Dictionary, input: Dictionary) -> Dictionary:
	var error = validate(current)
	if not error.is_empty(): return _reject(error, current)
	if current.decisions.size() >= MAX_DECISIONS:
		return _reject("Delegated decision journal is full.", current)
	var decision = {
		"id": input.get("id"), "mandate_id": input.get("mandate_id"),
		"action": input.get("action"), "subject_id": input.get("subject_id"),
		"slot": input.get("slot"), "amount_minor": input.get("amount_minor", 0),
		"reason": input.get("reason", ""), "source_digest": input.get("source_digest")
	}
	decision["digest"] = RaceStateValue.fingerprint(decision)
	if not _decision_error(decision).is_empty() or not current.mandates.has(decision.mandate_id):
		return _reject("Delegated decision record is invalid.", current)
	for previous in current.decisions:
		if previous.id == decision.id:
			return _reject("Delegated decision identity is duplicated.", current)
	var data = current.duplicate(true)
	data.decisions.append(decision)
	return {"ok": true, "status": "recorded", "error": "", "delegation": data,
		"decision": decision.duplicate(true)}

static func validate(data: Variant) -> String:
	if not data is Dictionary or data.size() != 2 or not data.get("mandates") is Dictionary 			or data.mandates.size() > MAX_MANDATES or not data.get("decisions") is Array 			or data.decisions.size() > MAX_DECISIONS:
		return "Campaign delegation projection is invalid."
	for mandate_id in data.mandates:
		if mandate_id != data.mandates[mandate_id].get("id"):
			return "Campaign mandate key disagrees with its identity."
		var error = _mandate_error(data.mandates[mandate_id])
		if not error.is_empty(): return error
	var ids = {}
	for decision in data.decisions:
		var error = _decision_error(decision)
		if not error.is_empty() or ids.has(decision.get("id")) or not data.mandates.has(decision.get("mandate_id")):
			return "Campaign delegated decision history is invalid."
		ids[decision.id] = true
	return ""

static func _build(input: Dictionary, created_slot: int) -> Dictionary:
	var data = {
		"id": input.get("id"), "owner_person_id": input.get("owner_person_id"),
		"scope": input.get("scope"), "created_slot": created_slot,
		"review_slot": input.get("review_slot"), "expiry_slot": input.get("expiry_slot"),
		"spending_ceiling_minor": input.get("spending_ceiling_minor"),
		"future_obligation_ceiling_minor": input.get("future_obligation_ceiling_minor"),
		"minimum_cash_minor": input.get("minimum_cash_minor"),
		"allowed_categories": input.get("allowed_categories", []).duplicate(true),
		"protected_ids": input.get("protected_ids", []).duplicate(true),
		"risk_posture": input.get("risk_posture", "balanced"),
		"status": "active", "revocation_slot": -1
	}
	_seal_record(data)
	return data if _mandate_error(data).is_empty() else {}

static func _mandate_error(data: Variant) -> String:
	if not data is Dictionary or data.size() != 15:
		return "Campaign mandate has an unsupported shape."
	for key in ["id", "owner_person_id"]:
		if not CampaignIdentity.valid(data.get(key)): return "Campaign mandate has an invalid " + key + "."
	if data.get("scope") not in SCOPES or data.get("risk_posture") not in RISK_POSTURES 			or data.get("status") not in ["active", "revoked"]:
		return "Campaign mandate has an invalid scope, posture or status."
	if not RaceCheckpoint.integral(data.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS) 			or not RaceCheckpoint.integral(data.get("review_slot"), int(data.created_slot), CampaignClock.MAX_ELAPSED_SLOTS) 			or not RaceCheckpoint.integral(data.get("expiry_slot"), int(data.review_slot), CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign mandate has invalid review or expiry timing."
	for key in ["spending_ceiling_minor", "future_obligation_ceiling_minor", "minimum_cash_minor"]:
		if not RaceCheckpoint.integral(data.get(key), 0, CampaignEconomy.MAX_MINOR):
			return "Campaign mandate has an invalid financial limit."
	if int(data.future_obligation_ceiling_minor) < int(data.spending_ceiling_minor):
		return "Campaign mandate future-obligation ceiling cannot be below its transaction ceiling."
	if not data.get("allowed_categories") is Array or data.allowed_categories.is_empty() 			or not data.get("protected_ids") is Array:
		return "Campaign mandate category or protected-resource list is invalid."
	var categories = {}
	for category in data.allowed_categories:
		if category not in CampaignCashCommitment.CATEGORIES or categories.has(category):
			return "Campaign mandate contains an invalid or repeated cash category."
		categories[category] = true
	var protected = {}
	for identity in data.protected_ids:
		if not CampaignIdentity.valid(identity) or protected.has(identity):
			return "Campaign mandate contains an invalid or repeated protected identity."
		protected[identity] = true
	if data.status == "active" and int(data.revocation_slot) != -1:
		return "Active campaign mandate already has revocation evidence."
	if data.status == "revoked" and (not RaceCheckpoint.integral(data.get("revocation_slot"),
			int(data.created_slot), int(data.expiry_slot))):
		return "Revoked campaign mandate has invalid revocation evidence."
	return _record_digest_error(data)

static func _decision_error(data: Variant) -> String:
	if not data is Dictionary or data.size() != 9:
		return "invalid shape"
	for key in ["id", "mandate_id", "subject_id"]:
		if not CampaignIdentity.valid(data.get(key)): return "invalid identity"
	if data.get("action") != "add_commitment" or not data.get("reason") is String 			or data.reason.is_empty() or data.reason.length() > 240:
		return "invalid action"
	if not RaceCheckpoint.integral(data.get("slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS) 			or not RaceCheckpoint.integral(data.get("amount_minor"), -CampaignEconomy.MAX_MINOR, CampaignEconomy.MAX_MINOR) 			or int(data.amount_minor) >= 0 or not CampaignIdentity.valid_hash(data.get("source_digest")):
		return "invalid evidence"
	return _record_digest_error(data)

static func _record_digest_error(data: Dictionary) -> String:
	var content = data.duplicate(true); content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) 			or data.digest != RaceStateValue.fingerprint(content): return "invalid digest"
	return ""

static func _seal_record(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)

static func _reject(message: String, current: Dictionary) -> Dictionary:
	return {"ok": false, "status": "rejected", "error": message, "delegation": current.duplicate(true)}
