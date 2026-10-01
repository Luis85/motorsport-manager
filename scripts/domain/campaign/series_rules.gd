class_name CampaignSeriesRules
extends RefCounted
## Immutable entry and sporting rules for one campaign competition family.
## Ordinary settlement accepts final classifications only. A separate explicit
## correction workflow can preview and atomically replace a settled final result.
const KIND = "motorsport-manager-campaign-series-rules"
const VERSION = 1
const MAX_NAME_LENGTH = 80
const MAX_ENTRANTS = 32
const MAX_CARS_PER_ENTRANT = 4
const MAX_EVENTS = 32
const MAX_POINTS = CampaignWeekendPolicy.MAX_POINTS
const CLASSIFICATION_POLICY = "final_only"

static func build(input: Dictionary) -> Dictionary:
	var data = {
		"kind": KIND,
		"version": VERSION,
		"series_id": input.get("series_id"),
		"name": input.get("name", ""),
		"cars_per_entrant": input.get("cars_per_entrant", 2),
		"min_entrants": input.get("min_entrants", 2),
		"max_entrants": input.get("max_entrants", 8),
		"min_events": input.get("min_events", 4),
		"max_events": input.get("max_events", 8),
		"points_by_position": input.get("points_by_position", []).duplicate(true),
		"countback_depth": input.get("countback_depth", CampaignWeekendReceipt.MAX_ENTRANTS),
		"classification_policy": CLASSIFICATION_POLICY
	}
	data["digest"] = RaceStateValue.fingerprint(data)
	return data if validate(data).is_empty() else {}

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data):
		return "Campaign series rules exceed serialized-value limits."
	if not data is Dictionary or data.size() != 13 or data.get("kind") != KIND:
		return "Unsupported campaign series rules."
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION):
		return "Unsupported campaign series-rules version."
	if not CampaignIdentity.valid(data.get("series_id")):
		return "Campaign series rules have an invalid identity."
	if not data.get("name") is String or data.name.is_empty() or data.name.length() > MAX_NAME_LENGTH:
		return "Campaign series rules have an invalid display name."
	if not RaceCheckpoint.integral(data.get("cars_per_entrant"), 1, MAX_CARS_PER_ENTRANT):
		return "Campaign series rules have an invalid cars-per-entrant limit."
	if not RaceCheckpoint.integral(data.get("min_entrants"), 1, MAX_ENTRANTS) \
			or not RaceCheckpoint.integral(data.get("max_entrants"), int(data.min_entrants), MAX_ENTRANTS):
		return "Campaign series rules have invalid entrant limits."
	if not RaceCheckpoint.integral(data.get("min_events"), 1, MAX_EVENTS) \
			or not RaceCheckpoint.integral(data.get("max_events"), int(data.min_events), MAX_EVENTS):
		return "Campaign series rules have invalid event limits."
	if data.get("classification_policy") != CLASSIFICATION_POLICY:
		return "Campaign series rules use an unsupported classification policy."
	if not RaceCheckpoint.integral(data.get("countback_depth"), 1, CampaignWeekendReceipt.MAX_ENTRANTS):
		return "Campaign series rules have an invalid countback depth."
	var points_error = _points_error(data.get("points_by_position"))
	if not points_error.is_empty():
		return points_error
	var content = data.duplicate(true)
	content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign series-rules integrity check failed."
	return ""

static func _points_error(value: Variant) -> String:
	if not value is Array or value.is_empty() or value.size() > CampaignWeekendReceipt.MAX_ENTRANTS:
		return "Campaign series points must be a bounded ordered table."
	var previous = MAX_POINTS
	for item in value:
		if not RaceCheckpoint.integral(item, 0, MAX_POINTS):
			return "Campaign series points contain an out-of-range value."
		if int(item) > previous:
			return "Campaign series points must not increase for a lower position."
		previous = int(item)
	if int(value[0]) <= 0:
		return "Campaign series points must award the winner."
	return ""
