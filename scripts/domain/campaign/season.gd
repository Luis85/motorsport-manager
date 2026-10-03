class_name CampaignSeason
extends RefCounted
## Stable campaign-season API; cohesive rules live in the bounded record helpers.
const KIND = CampaignSeasonRecord.KIND
const VERSION = CampaignSeasonRecord.VERSION
const STATUSES = CampaignSeasonRecord.STATUSES


static func build(definition: Dictionary, rules: Dictionary) -> Dictionary:
	return CampaignSeasonRecord.build(definition, rules)


static func transition(
	current: Dictionary, target: String, rules: Dictionary, events: Dictionary
) -> Dictionary:
	return CampaignSeasonRecord.transition(current, target, rules, events)


static func submit_entry(
	current: Dictionary, entry: Dictionary, rules: Dictionary, events: Dictionary
) -> Dictionary:
	return CampaignSeasonRecord.submit_entry(current, entry, rules, events)


static func decide_entry(
	current: Dictionary, entrant_id: String, accept: bool, rules: Dictionary, events: Dictionary
) -> Dictionary:
	return CampaignSeasonRecord.decide_entry(current, entrant_id, accept, rules, events)


static func withdraw_entry(
	current: Dictionary, entrant_id: String, rules: Dictionary, events: Dictionary
) -> Dictionary:
	return CampaignSeasonRecord.withdraw_entry(current, entrant_id, rules, events)


static func cancel_next_event(
	current: Dictionary, event_id: String, reason: String, rules: Dictionary, events: Dictionary
) -> Dictionary:
	return CampaignSeasonRecord.cancel_next_event(current, event_id, reason, rules, events)


static func manifest_error(
	current: Dictionary, manifest: Dictionary, rules: Dictionary, events: Dictionary
) -> String:
	return CampaignSeasonRecord.manifest_error(current, manifest, rules, events)


static func result_error(
	current: Dictionary,
	receipt: Dictionary,
	policy: Dictionary,
	rules: Dictionary,
	events: Dictionary
) -> String:
	return CampaignSeasonRecord.result_error(current, receipt, policy, rules, events)


static func apply_event(
	current: Dictionary, event_id: String, event: Dictionary, rules: Dictionary, events: Dictionary
) -> Dictionary:
	return CampaignSeasonRecord.apply_event(current, event_id, event, rules, events)


static func next_scheduled_event_id(data: Dictionary) -> String:
	return CampaignSeasonRecord.next_scheduled_event_id(data)


static func calendar_event(data: Dictionary, event_id: String) -> Dictionary:
	return CampaignSeasonRecord.calendar_event(data, event_id)


static func rebuild(current: Dictionary, events: Dictionary, rules: Dictionary) -> Dictionary:
	return CampaignSeasonRecord.rebuild(current, events, rules)


static func validate(data: Variant, rules: Dictionary, events: Dictionary) -> String:
	return CampaignSeasonRecord.validate(data, rules, events)
