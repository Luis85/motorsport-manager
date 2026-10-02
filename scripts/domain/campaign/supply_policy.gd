class_name CampaignSupplyPolicy
extends RefCounted
## Numerical evidence-confidence tuning for authored campaigns.
static func fields() -> Dictionary:
	return ContentSchema.object({
		"initial_confidence_bps": ContentSchema.integer(0, 10000),
		"observation_gain_bps": ContentSchema.integer(0, 10000),
		"max_confidence_bps": ContentSchema.integer(0, 10000),
		"spread_floor_bps": ContentSchema.integer(0, 5000),
		"spread_scale_bps": ContentSchema.integer(0, 10000)})

static func valid(value: Variant) -> bool:
	if not value is Dictionary or not ContentValidation.check(value, fields()).is_empty(): return false
	return int(value.initial_confidence_bps) <= int(value.max_confidence_bps)

static func normalized(value: Variant) -> Dictionary:
	return value.duplicate(true) if valid(value) else {}
