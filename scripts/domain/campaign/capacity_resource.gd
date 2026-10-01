class_name CampaignCapacityResource
extends RefCounted
## Dated internal facility or external rented-service capacity.
const FAMILIES = ["preparation_workshop", "design_office", "test_validation"]
const ACCESS = ["owned", "service"]
const MAX_UNITS = 64
const MAX_NAME_LENGTH = 80

static func build(input: Dictionary, created_slot: int) -> Dictionary:
	var data = {
		"id": input.get("id"),
		"display_name": input.get("display_name"),
		"family": input.get("family"),
		"access": input.get("access"),
		"created_slot": created_slot,
		"available_from_slot": input.get("available_from_slot", created_slot),
		"available_until_slot": input.get("available_until_slot"),
		"capacity_units": input.get("capacity_units"),
		"rate_minor_per_unit_slot": input.get("rate_minor_per_unit_slot", 0)
	}
	_seal(data)
	return data if validate(data).is_empty() else {}

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign capacity resource exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 10:
		return "Campaign capacity resource has an unsupported shape."
	if not CampaignIdentity.valid(data.get("id")):
		return "Campaign capacity resource has an invalid identity."
	if not data.get("display_name") is String or data.display_name.strip_edges().is_empty() \
			or data.display_name.length() > MAX_NAME_LENGTH:
		return "Campaign capacity resource has an invalid display name."
	if data.get("family") not in FAMILIES or data.get("access") not in ACCESS:
		return "Campaign capacity resource has an unsupported family or access model."
	if not RaceCheckpoint.integral(data.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS) \
			or not RaceCheckpoint.integral(data.get("available_from_slot"), int(data.created_slot), CampaignClock.MAX_ELAPSED_SLOTS) \
			or not RaceCheckpoint.integral(data.get("available_until_slot"), int(data.available_from_slot) + 1, CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign capacity resource has invalid availability dates."
	if not RaceCheckpoint.integral(data.get("capacity_units"), 1, MAX_UNITS) \
			or not RaceCheckpoint.integral(data.get("rate_minor_per_unit_slot"), 0, CampaignEconomy.MAX_MINOR):
		return "Campaign capacity resource has invalid capacity or rate."
	if data.access == "owned" and int(data.rate_minor_per_unit_slot) != 0:
		return "Owned campaign capacity cannot hide a rented-service rate."
	if data.access == "service" and int(data.rate_minor_per_unit_slot) <= 0:
		return "Rented campaign service capacity requires an explicit positive rate."
	return _integrity_error(data)

static func quote_minor(data: Dictionary, start_slot: int, end_slot: int, units: int) -> int:
	if not validate(data).is_empty() or data.access != "service" \
			or start_slot < int(data.available_from_slot) or end_slot > int(data.available_until_slot) \
			or end_slot <= start_slot or units < 1 or units > int(data.capacity_units):
		return -1
	var duration = end_slot - start_slot
	var rate = int(data.rate_minor_per_unit_slot)
	if duration <= 0 or rate > int(CampaignEconomy.MAX_MINOR / duration / units):
		return -1
	var amount = rate * duration * units
	return amount if RaceCheckpoint.integral(amount, 1, CampaignEconomy.MAX_MINOR) else -1

static func _integrity_error(data: Dictionary) -> String:
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) \
			or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign capacity resource integrity check failed."
	return ""

static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
