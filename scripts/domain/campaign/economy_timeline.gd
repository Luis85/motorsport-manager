class_name CampaignEconomyTimeline
extends RefCounted
## Cross-envelope rule: factual cash and administrative finance history cannot
## be dated after the campaign state that contains them. Open due dates may.

static func validate(value: Variant, elapsed_slot: int) -> String:
	var error = CampaignEconomy.validate(value)
	if not error.is_empty():
		return error
	if not RaceCheckpoint.integral(elapsed_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign economy has no valid authoritative time boundary."
	var economy: Dictionary = value
	for account in economy.accounts.values():
		for posting in account.postings.values():
			if int(posting.slot) > elapsed_slot:
				return "Campaign cash posting is dated after authoritative campaign time."
	if int(economy.version) == CampaignEconomy.LEGACY_VERSION:
		return ""
	if int(economy.authority_from_slot) > elapsed_slot:
		return "Campaign commitment authority begins after authoritative campaign time."
	for commitment in economy.commitments.values():
		if int(commitment.created_slot) > elapsed_slot:
			return "Campaign cash commitment was created after authoritative campaign time."
		if commitment.status != "open" and int(commitment.resolution_slot) > elapsed_slot:
			return "Campaign cash commitment resolves after authoritative campaign time."
	for policy in economy.reserve_policies.values():
		if int(policy.effective_slot) > elapsed_slot:
			return "Campaign reserve policy begins after authoritative campaign time."
	return ""
