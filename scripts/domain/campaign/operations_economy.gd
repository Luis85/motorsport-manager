class_name CampaignOperationsEconomy
extends RefCounted
## Rented service costs use CampaignEconomy commitments; internal work is not double charged.

static func validate(operations: Dictionary, economy: Dictionary, current_slot: int) -> String:
	var error = CampaignOperations.validate(operations)
	if not error.is_empty():
		return error
	error = CampaignEconomy.validate(economy)
	if not error.is_empty():
		return error
	if operations.campaign_id != economy.campaign_id \
			or not economy.accounts.has(operations.organization_id):
		return "Campaign operations and economy belong to different organizations."
	if not RaceCheckpoint.integral(current_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign operations finance has no valid authoritative time boundary."
	if int(economy.version) == CampaignEconomy.LEGACY_VERSION:
		return "Legacy campaign economy cannot carry operations authority."
	var legacy = {}
	for commitment_id in operations.legacy_facility_commitment_ids:
		if legacy.has(commitment_id) or not economy.commitments.has(commitment_id) \
				or economy.commitments[commitment_id].category != "facility":
			return "Campaign operations legacy facility commitment index is invalid."
		legacy[commitment_id] = true
	var indexed = {}
	for order in operations.work_orders.values():
		if order.mode == "internal":
			continue
		var commitment_id: String = order.commitment_ids[0]
		if indexed.has(commitment_id) or not economy.commitments.has(commitment_id):
			return "Campaign rented service has a missing or duplicated cash commitment."
		var commitment: Dictionary = economy.commitments[commitment_id]
		if commitment.account_id != operations.organization_id or commitment.source_id != order.id \
				or int(commitment.created_slot) != int(order.created_slot) \
				or int(commitment.due_slot) != int(order.start_slot) \
				or int(commitment.amount_minor) != -int(order.quoted_cost_minor) \
				or commitment.category != "facility":
			return "Campaign rented-service commitment disagrees with its work order."
		if order.status == "cancelled" and (commitment.status != "cancelled" \
				or int(commitment.resolution_slot) != int(order.cancellation_slot)):
			return "Cancelled campaign rented service did not cancel its future payment."
		if order.status == "scheduled" and commitment.status == "cancelled":
			return "Campaign rented-service payment was cancelled while work remains scheduled."
		if commitment.status == "settled" and int(commitment.due_slot) > current_slot:
			return "Campaign rented-service payment settled before its contractual due date."
		indexed[commitment_id] = true
	for commitment_id in economy.commitments:
		var commitment: Dictionary = economy.commitments[commitment_id]
		if commitment.category != "facility" or commitment_id in legacy:
			continue
		if int(commitment.created_slot) >= int(operations.authority_from_slot) \
				and not indexed.has(commitment_id):
			return "Campaign economy contains facility spending outside operations authority."
	return ""
