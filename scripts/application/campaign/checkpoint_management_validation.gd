class_name CampaignCheckpointManagementValidation
extends RefCounted
## Pure validation of detached campaign records.


static func validate(data: Dictionary) -> String:
	var error = CampaignManagement.validate(data.get("management"))
	if not error.is_empty():
		return error
	if (
		data.management.campaign_id != data.campaign_id
		or data.management.organization_id != data.state.organization_id
	):
		return "Campaign management belongs to another campaign or organization."
	if int(data.management.authority_from_slot) > int(data.state.clock.elapsed_slots):
		return "Campaign management authority begins after authoritative campaign time."
	error = CampaignCommercialAuthority.validate(
		data.management.commercial,
		data.personnel,
		data.economy,
		int(data.state.clock.elapsed_slots)
	)
	if not error.is_empty():
		return error
	error = CampaignDelegationAuthority.validate(
		data.management.delegation,
		data.personnel,
		data.economy,
		int(data.state.clock.elapsed_slots)
	)
	if not error.is_empty():
		return error
	error = CampaignRivalsAuthority.validate(
		data.management.rivals, data.competition, int(data.state.clock.elapsed_slots)
	)
	if not error.is_empty():
		return error
	error = CampaignPeopleDevelopmentAuthority.validate(
		data.management.people, data.personnel, int(data.state.clock.elapsed_slots)
	)
	if not error.is_empty():
		return error
	error = CampaignSeasonPlanningAuthority.validate(
		data.management.season_planning, data.competition, int(data.state.clock.elapsed_slots)
	)
	if not error.is_empty():
		return error
	error = CampaignSupplyAuthority.validate(
		data.management.supply,
		data.economy,
		data.engineering,
		data.operations,
		int(data.state.clock.elapsed_slots)
	)
	if not error.is_empty():
		return error
	error = CampaignGroupAuthority.validate(
		data.management.group,
		data.economy,
		data.operations,
		data.engineering,
		data.management.people,
		data.personnel,
		int(data.state.clock.elapsed_slots)
	)
	if not error.is_empty():
		return error
	for row in data.management.distress.history:
		if int(row.slot) > int(data.state.clock.elapsed_slots):
			return "Campaign distress history is dated after authoritative campaign time."
	return ""
