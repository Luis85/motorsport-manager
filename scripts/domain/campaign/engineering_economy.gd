class_name CampaignEngineeringEconomy
extends RefCounted
## Production materials are explicit development commitments in CampaignEconomy.

static func validate(engineering: Dictionary, economy: Dictionary,
		operations: Dictionary, current_slot: int) -> String:
	var error = CampaignEngineering.validate(engineering)
	if not error.is_empty(): return error
	error = CampaignEconomy.validate(economy)
	if not error.is_empty(): return error
	if engineering.campaign_id != economy.campaign_id 			or not economy.accounts.has(engineering.organization_id):
		return "Campaign engineering and economy belong to different authorities."
	if not RaceCheckpoint.integral(current_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign engineering finance has no valid authoritative time."
	var legacy = {}
	for commitment_id in engineering.legacy_development_commitment_ids:
		if legacy.has(commitment_id) or not economy.commitments.has(commitment_id) 				or economy.commitments[commitment_id].category != "development":
			return "Campaign engineering legacy development index is invalid."
		legacy[commitment_id] = true
	var indexed = {}
	for project in engineering.projects.values():
		if project.material_commitment_id.is_empty():
			continue
		var commitment_id: String = project.material_commitment_id
		var production_order_id = project.stage_orders.get("production", "")
		if indexed.has(commitment_id) or not economy.commitments.has(commitment_id) 				or not operations.work_orders.has(production_order_id):
			return "Campaign engineering material commitment or production work is missing."
		var commitment: Dictionary = economy.commitments[commitment_id]
		var production: Dictionary = operations.work_orders[production_order_id]
		if commitment.account_id != engineering.organization_id 				or commitment.source_id != project.id 				or int(commitment.due_slot) != int(production.start_slot) 				or int(commitment.amount_minor) != -int(project.material_cost_minor) 				or commitment.category != "development":
			return "Campaign engineering material commitment disagrees with project terms."
		if commitment.status == "cancelled":
			return "Campaign engineering material commitment was cancelled while the project remains binding."
		if commitment.status == "settled" and int(commitment.due_slot) > current_slot:
			return "Campaign engineering material commitment settled before its due slot."
		indexed[commitment_id] = true
	for commitment_id in economy.commitments:
		var commitment: Dictionary = economy.commitments[commitment_id]
		if commitment.category != "development" or commitment_id in legacy:
			continue
		if int(commitment.created_slot) >= int(engineering.authority_from_slot) 				and not indexed.has(commitment_id):
			return "Campaign economy contains development spending outside engineering authority."
	return ""
