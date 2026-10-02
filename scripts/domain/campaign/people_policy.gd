class_name CampaignPeoplePolicy
extends RefCounted
## Numerical recruitment/development tuning. Interaction states and validation
## envelopes remain code-owned behavior contracts.
static func fields() -> Dictionary:
	return ContentSchema.object({
		"counter_offer_ratio_bps": ContentSchema.integer(1, 10000),
		"productive_load_min_bps": ContentSchema.integer(0, 10000),
		"productive_load_max_bps": ContentSchema.integer(0, 10000),
		"productive_gain": ContentSchema.integer(0, 10),
		"other_gain": ContentSchema.integer(0, 10),
		"morale_safe_load_bps": ContentSchema.integer(0, 10000),
		"morale_safe_delta": ContentSchema.integer(-10, 10),
		"morale_overload_delta": ContentSchema.integer(-10, 10),
		"new_hire_morale": ContentSchema.integer(0, 100),
		"new_hire_trust": ContentSchema.integer(0, 100)})

static func valid(value: Variant) -> bool:
	if not value is Dictionary or not ContentValidation.check(value, fields()).is_empty(): return false
	return int(value.productive_load_min_bps) <= int(value.productive_load_max_bps)

static func normalized(value: Variant) -> Dictionary:
	return value.duplicate(true) if valid(value) else {}
