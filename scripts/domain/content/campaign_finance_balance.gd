class_name CampaignFinanceBalance
extends RefCounted
## Frozen campaign policy. Missing tuning preserves the legacy record and hash.
const LEGACY = {"distress_forecast_days": 30, "bridge_maturity_days": 30, "bridge_fee_bps": 1000}


static func fields() -> Dictionary:
	return ContentSchema.object(
		{
			"distress_forecast_days": ContentSchema.integer(1, CampaignDefinition.MAX_DAYS),
			"bridge_maturity_days": ContentSchema.integer(1, CampaignDefinition.MAX_DAYS),
			"bridge_fee_bps": ContentSchema.integer(0, 10000)
		}
	)


static func for_definition(definition: Dictionary) -> Dictionary:
	return RaceStateValue.read_only(definition.get("tuning", {}).get("finance", LEGACY))


static func repayment(amount_minor: int, fee_bps: int) -> int:
	# The old float expression is an immutable compatibility contract, including
	# its rounding. Other authored rates use exact integer minor-unit arithmetic.
	if fee_bps == LEGACY.bridge_fee_bps:
		return int(round(amount_minor * 1.10))
	@warning_ignore("integer_division")
	return (amount_minor * (10000 + fee_bps) + 5000) / 10000
