class_name CampaignSeasonPlanningAuthority
extends RefCounted
## Multi-season plans must refer to actual championship history and cannot be future-dated.


static func validate(planning: Dictionary, competition: Dictionary, current_slot: int) -> String:
	var error = CampaignSeasonPlanning.validate(planning)
	if not error.is_empty():
		return error
	error = CampaignCompetition.validate(competition)
	if not error.is_empty():
		return error
	for plan in planning.plans.values():
		if (
			not competition.seasons.has(plan.season_id)
			or int(plan.created_slot) > current_slot
			or (
				int(plan.last_review_slot if plan.has("last_review_slot") else plan.created_slot)
				> current_slot
			)
		):
			return "Season plan references an unknown or future season."
	for offer in planning.promotion_offers.values():
		if (
			not competition.seasons.has(offer.source_season_id)
			or int(offer.created_slot) > current_slot
			or int(offer.resolved_slot) > current_slot
		):
			return "Promotion offer references an unknown or future season."
	for transition in planning.transitions:
		if (
			not competition.seasons.has(transition.source_season_id)
			or not competition.seasons.has(transition.next_season_id)
			or not competition.series.has(transition.target_series_id)
			or int(transition.slot) > current_slot
		):
			return "Season transition lacks authoritative championship evidence."
		if competition.series[transition.target_series_id].digest != transition.rules_digest:
			return "Season transition rule digest differs from its target series."
	return ""
