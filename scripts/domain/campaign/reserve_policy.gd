class_name CampaignReservePolicy
extends RefCounted
## Current planning floor for one campaign account. It is permission/forecast
## policy, not a second bank account and not a posting.
const KIND = "motorsport-manager-campaign-reserve-policy"
const VERSION = 1
const BASIS = "absolute_minimum_cash"
const MAX_MINOR = CampaignWeekendPolicy.MAX_MINOR

static func build(account_id: String, minimum_cash_minor: int, effective_slot: int) -> Dictionary:
	var data = {
		"kind": KIND,
		"version": VERSION,
		"account_id": account_id,
		"minimum_cash_minor": minimum_cash_minor,
		"effective_slot": effective_slot,
		"basis": BASIS
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data if validate(data).is_empty() else {}

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign reserve policy exceeds serialized-value limits."
	if not data is Dictionary or data.size() != 7 or data.get("kind") != KIND:
		return "Campaign reserve policy has an unsupported shape."
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION) \
			or not CampaignIdentity.valid(data.get("account_id")):
		return "Campaign reserve policy version or account is invalid."
	if not RaceCheckpoint.integral(data.get("minimum_cash_minor"), 0, MAX_MINOR) \
			or not RaceCheckpoint.integral(data.get("effective_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign reserve policy has invalid value or timing."
	if data.get("basis") != BASIS:
		return "Campaign reserve policy uses an unsupported basis."
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign reserve-policy integrity check failed."
	return ""
