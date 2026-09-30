class_name CampaignFinanceQuery
extends RefCounted
## Read-only forecast query over a validated checkpoint. It does not persist
## assumptions, issue commands, advance time or mutate the caller value.

static func cash_forecast(checkpoint: Dictionary, account_id: String,
		through_slot: int, assumptions: Array = []) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return {"ok": false, "error": restored.error}
	return CampaignCashForecast.build(
		restored.economy,
		account_id,
		restored.state.clock.elapsed_slots,
		through_slot,
		assumptions.duplicate(true)
	)
