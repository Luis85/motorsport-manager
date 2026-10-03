class_name CampaignCheckpointMigration
extends RefCounted
## Lossless normalization of supported campaign envelope versions.


static func upgrade(data: Variant) -> Dictionary:
	var error = CampaignCheckpoint.validate(data)
	if not error.is_empty():
		return {}
	if int(data.version) == CampaignCheckpoint.VERSION:
		return data.duplicate(true)
	var state = CampaignState.restore(data.state)
	if state == null:
		return {}
	if int(data.version) == CampaignCheckpoint.ENGINEERING_VERSION:
		var management = CampaignManagement.empty(
			state.campaign_id, state.organization_id, state.clock.elapsed_slots
		)
		return CampaignCheckpoint.build(
			state,
			data.settlements,
			data.active_manifest,
			data.competition,
			data.economy,
			data.inventory,
			data.personnel,
			data.operations,
			data.engineering,
			management
		)
	if int(data.version) == CampaignCheckpoint.OPERATIONS_VERSION:
		var engineering = CampaignEngineering.empty(
			state.campaign_id,
			state.organization_id,
			state.clock.elapsed_slots,
			_legacy_development_ids(data.economy)
		)
		return CampaignCheckpoint.build(
			state,
			data.settlements,
			data.active_manifest,
			data.competition,
			data.economy,
			data.inventory,
			data.personnel,
			data.operations,
			engineering
		)
	if int(data.version) == CampaignCheckpoint.PERSONNEL_VERSION:
		var operations = CampaignOperations.empty(
			state.campaign_id,
			state.organization_id,
			state.clock.elapsed_slots,
			_legacy_facility_ids(data.economy)
		)
		var engineering = CampaignEngineering.empty(
			state.campaign_id,
			state.organization_id,
			state.clock.elapsed_slots,
			_legacy_development_ids(data.economy)
		)
		return CampaignCheckpoint.build(
			state,
			data.settlements,
			data.active_manifest,
			data.competition,
			data.economy,
			data.inventory,
			data.personnel,
			operations,
			engineering
		)
	if int(data.version) == CampaignCheckpoint.CONSEQUENCE_VERSION:
		var personnel = CampaignPersonnel.empty(
			state.campaign_id,
			state.organization_id,
			state.clock.elapsed_slots,
			_legacy_payroll_ids(data.economy)
		)
		var operations = CampaignOperations.empty(
			state.campaign_id,
			state.organization_id,
			state.clock.elapsed_slots,
			_legacy_facility_ids(data.economy)
		)
		var engineering = CampaignEngineering.empty(
			state.campaign_id,
			state.organization_id,
			state.clock.elapsed_slots,
			_legacy_development_ids(data.economy)
		)
		return CampaignCheckpoint.build(
			state,
			data.settlements,
			data.active_manifest,
			data.competition,
			data.economy,
			data.inventory,
			personnel,
			operations,
			engineering
		)
	return CampaignCheckpoint.build(state, data.settlements, data.active_manifest)


static func _legacy_payroll_ids(economy: Dictionary) -> Array:
	var result: Array = []
	if int(economy.get("version", 0)) != CampaignEconomy.VERSION:
		return result
	for commitment_id in economy.get("commitments", {}):
		if economy.commitments[commitment_id].get("category") == "payroll":
			result.append(commitment_id)
	result.sort()
	return result


static func _legacy_facility_ids(economy: Dictionary) -> Array:
	var result: Array = []
	if int(economy.get("version", 0)) != CampaignEconomy.VERSION:
		return result
	for commitment_id in economy.get("commitments", {}):
		if economy.commitments[commitment_id].get("category") == "facility":
			result.append(commitment_id)
	result.sort()
	return result


static func _legacy_development_ids(economy: Dictionary) -> Array:
	var result: Array = []
	if int(economy.get("version", 0)) != CampaignEconomy.VERSION:
		return result
	for commitment_id in economy.get("commitments", {}):
		if economy.commitments[commitment_id].get("category") == "development":
			result.append(commitment_id)
	result.sort()
	return result
