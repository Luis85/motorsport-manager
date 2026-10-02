class_name CampaignCommercialQuery
extends RefCounted
## Detached portfolio summary; guaranteed and conditional sponsor value stay separate.

static func portfolio(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok: return {"ok": false, "error": restored.error}
	var guaranteed_open = 0
	var earned_bonus = 0
	var appearances = 0
	for agreement in restored.management.commercial.agreements.values():
		for input in CampaignCommercial.guaranteed_commitments(agreement):
			if restored.economy.commitments[input.id].status == "open":
				guaranteed_open += int(input.amount_minor)
		appearances += agreement.appearances.size()
	for claim in restored.management.commercial.bonus_claims.values():
		earned_bonus += int(claim.amount_minor)
	return {"ok": true, "error": "", "agreements":
		restored.management.commercial.agreements.values().map(func(a): return a.duplicate(true)),
		"guaranteed_open_minor": guaranteed_open, "earned_bonus_minor": earned_bonus,
		"appearance_obligations": appearances, "source_digest": restored.management.digest}
