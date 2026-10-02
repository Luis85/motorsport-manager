class_name CampaignFinanceQuery
extends RefCounted
## Read-only forecast queries over a validated checkpoint. They do not persist
## assumptions or proposed commitments, issue commands, advance time or mutate
## the caller value.

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

static func commitment_preview(checkpoint: Dictionary, input: Dictionary,
		through_slot: int, assumptions: Array = []) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return {"ok": false, "error": restored.error}
	var staged = CampaignEconomy.add_commitment(
		restored.economy,
		input.duplicate(true),
		restored.state.clock.elapsed_slots
	)
	if not staged.ok:
		return {"ok": false, "error": staged.error}
	var account_id = input.get("account_id", "")
	var forecast = CampaignCashForecast.build(
		staged.economy,
		account_id,
		restored.state.clock.elapsed_slots,
		through_slot,
		assumptions.duplicate(true)
	)
	if not forecast.ok:
		return forecast
	return {
		"ok": true,
		"error": "",
		"source_checkpoint_digest": checkpoint.get("digest", ""),
		"commitment": staged.economy.commitments[input.get("id")].duplicate(true),
		"forecast": forecast.forecast
	}
