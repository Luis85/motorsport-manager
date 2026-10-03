class_name CampaignRivalPolicy
extends RefCounted
## Tunable rival planning coefficients. Supported plan/archetype names remain
## code-owned behavior contracts; campaigns own their numerical policy.
const MAX_MONEY_MINOR = 1000000000
const LEGACY = {
	"cash_preservation_threshold_minor": 5000,
	"leading_rank_threshold": 2,
	"plan_spend_minor":
	{"reliability": 6000, "balanced_development": 10000, "driver_development": 5000},
	"gain_minor_per_bps": 200,
	"max_gain_bps": 250,
	"reliability_gain_bps": 8000,
	"driver_development_gain_bps": 6000
}


static func fields() -> Dictionary:
	return ContentSchema.object(
		{
			"cash_preservation_threshold_minor": ContentSchema.integer(0, MAX_MONEY_MINOR),
			"leading_rank_threshold": ContentSchema.integer(1, CampaignSeriesRules.MAX_ENTRANTS),
			"plan_spend_minor":
			ContentSchema.object(
				{
					"reliability": ContentSchema.integer(0, MAX_MONEY_MINOR),
					"balanced_development": ContentSchema.integer(0, MAX_MONEY_MINOR),
					"driver_development": ContentSchema.integer(0, MAX_MONEY_MINOR)
				}
			),
			"gain_minor_per_bps": ContentSchema.integer(1, MAX_MONEY_MINOR),
			"max_gain_bps": ContentSchema.integer(1, 5000),
			"reliability_gain_bps": ContentSchema.integer(0, 10000),
			"driver_development_gain_bps": ContentSchema.integer(0, 10000)
		}
	)


static func valid(value: Variant) -> bool:
	return value is Dictionary and ContentValidation.check(value, fields()).is_empty()


static func normalized(value: Variant) -> Dictionary:
	return value.duplicate(true) if valid(value) else LEGACY.duplicate(true)
