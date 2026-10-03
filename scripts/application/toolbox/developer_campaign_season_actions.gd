class_name DeveloperCampaignSeasonActions
extends RefCounted
## Explicit season transaction allowlist; the existing owners validate and publish.
const SPECS = {
	"competition.register_series": [{"rules": "Dictionary"}, ["rules"]],
	"competition.create_season": [{"definition": "Dictionary"}, ["definition"]],
	"competition.transition_season":
	[{"season_id": "String", "target": "String"}, ["season_id", "target"]],
	"competition.submit_entry":
	[{"season_id": "String", "entry": "Dictionary"}, ["season_id", "entry"]],
	"competition.decide_entry":
	[
		{"season_id": "String", "entrant_id": "String", "accept": "bool"},
		["season_id", "entrant_id", "accept"]
	],
	"competition.withdraw_entry":
	[{"season_id": "String", "entrant_id": "String"}, ["season_id", "entrant_id"]],
	"competition.cancel_event":
	[
		{"season_id": "String", "event_id": "String", "reason": "String"},
		["season_id", "event_id", "reason"]
	],
	"season_progression.set_plan": [{"input": "Dictionary"}, ["input"]],
	"season_progression.offer_promotion":
	[
		{
			"source_season_id": "String",
			"target_series_id": "String",
			"deadline_slot": "int",
			"minimum_cash_minor": "int"
		},
		["source_season_id", "target_series_id", "deadline_slot", "minimum_cash_minor"]
	],
	"season_progression.decide_promotion":
	[{"offer_id": "String", "accept": "bool"}, ["offer_id", "accept"]],
	"season_progression.begin_next_season":
	[
		{
			"source_season_id": "String",
			"next_definition": "Dictionary",
			"target_rules": "Dictionary",
			"decision": "String",
			"prize_minor": "int"
		},
		["source_season_id", "next_definition", "target_rules", "decision", "prize_minor"]
	],
	"group.initialize":
	[{"parent_cash_minor": "int", "era": "Dictionary"}, ["parent_cash_minor", "era"]],
	"group.create_service_order": [{"input": "Dictionary"}, ["input"]],
	"group.complete_service_order": [{"order_id": "String"}, ["order_id"]],
	"group.transfer_to_team": [{"id": "String", "amount_minor": "int"}, ["id", "amount_minor"]],
	"group.set_academy_capacity": [{"capacity": "int"}, ["capacity"]],
	"group.add_academy_prospect": [{"candidate_id": "String"}, ["candidate_id"]],
	"group.register_era": [{"input": "Dictionary"}, ["input"]],
	"group.activate_era": [{"era_id": "String"}, ["era_id"]],
	"group.appoint_successor": [{"person_id": "String"}, ["person_id"]],
	"group.add_legacy_goal": [{"input": "Dictionary"}, ["input"]],
	"group.complete_legacy_goal":
	[{"goal_id": "String", "evidence_id": "String"}, ["goal_id", "evidence_id"]],
	"supply.register_supplier": [{"input": "Dictionary"}, ["input"]],
	"supply.order_material": [{"input": "Dictionary"}, ["input"]],
	"supply.receive_order": [{"order_id": "String"}, ["order_id"]],
	"supply.consume_material":
	[
		{"material_id": "String", "quantity": "int", "source_id": "String"},
		["material_id", "quantity", "source_id"]
	],
	"supply.register_project_evidence":
	[{"project_id": "String", "latent_bps": "int"}, ["project_id", "latent_bps"]],
	"supply.observe_project": [{"project_id": "String"}, ["project_id"]],
	"supply.register_part": [{"part_id": "String"}, ["part_id"]],
	"supply.wear_part": [{"part_id": "String", "wear": "int"}, ["part_id", "wear"]],
	"supply.repair_part":
	[{"part_id": "String", "work_order_id": "String"}, ["part_id", "work_order_id"]],
}


static func apply(checkpoint: Dictionary, action: String, payload: Dictionary) -> Dictionary:
	var result = {"ok": false, "error": "Unknown campaign planning action."}
	match action.get_slice(".", 0):
		"competition":
			result = _competition(checkpoint, action, payload)
		"season_progression":
			result = _season_progression(checkpoint, action, payload)
		"group":
			result = _group(checkpoint, action, payload)
		"supply":
			result = _supply(checkpoint, action, payload)
	return result


static func _competition(checkpoint: Dictionary, action: String, payload: Dictionary) -> Dictionary:
	var result = {"ok": false, "error": "Unknown campaign planning action."}
	match action:
		"competition.register_series":
			result = CampaignCompetitionTransaction.register_series(checkpoint, payload.rules)
		"competition.create_season":
			result = CampaignCompetitionTransaction.create_season(checkpoint, payload.definition)
		"competition.transition_season":
			result = CampaignCompetitionTransaction.transition_season(
				checkpoint, payload.season_id, payload.target
			)
		"competition.submit_entry":
			result = CampaignCompetitionTransaction.submit_entry(
				checkpoint, payload.season_id, payload.entry
			)
		"competition.decide_entry":
			result = CampaignCompetitionTransaction.decide_entry(
				checkpoint, payload.season_id, payload.entrant_id, payload.accept
			)
		"competition.withdraw_entry":
			result = CampaignCompetitionTransaction.withdraw_entry(
				checkpoint, payload.season_id, payload.entrant_id
			)
		"competition.cancel_event":
			result = CampaignCompetitionTransaction.cancel_event(
				checkpoint, payload.season_id, payload.event_id, payload.reason
			)
	return result


static func _season_progression(
	checkpoint: Dictionary, action: String, payload: Dictionary
) -> Dictionary:
	var result = {"ok": false, "error": "Unknown campaign planning action."}
	match action:
		"season_progression.set_plan":
			result = CampaignSeasonProgressionTransaction.set_plan(checkpoint, payload.input)
		"season_progression.offer_promotion":
			result = CampaignSeasonProgressionTransaction.offer_promotion(
				checkpoint,
				payload.source_season_id,
				payload.target_series_id,
				int(payload.deadline_slot),
				int(payload.minimum_cash_minor)
			)
		"season_progression.decide_promotion":
			result = CampaignSeasonProgressionTransaction.decide_promotion(
				checkpoint, payload.offer_id, payload.accept
			)
		"season_progression.begin_next_season":
			result = CampaignSeasonProgressionTransaction.begin_next_season(
				checkpoint,
				payload.source_season_id,
				payload.next_definition,
				payload.target_rules,
				payload.decision,
				int(payload.prize_minor)
			)
	return result


static func _group(checkpoint: Dictionary, action: String, payload: Dictionary) -> Dictionary:
	var result = {"ok": false, "error": "Unknown campaign planning action."}
	match action:
		"group.initialize":
			result = CampaignGroupTransaction.initialize(
				checkpoint, int(payload.parent_cash_minor), payload.era
			)
		"group.create_service_order":
			result = CampaignGroupTransaction.create_service_order(checkpoint, payload.input)
		"group.complete_service_order":
			result = CampaignGroupTransaction.complete_service_order(checkpoint, payload.order_id)
		"group.transfer_to_team":
			result = CampaignGroupTransaction.transfer_to_team(
				checkpoint, payload.id, int(payload.amount_minor)
			)
		"group.set_academy_capacity":
			result = CampaignGroupTransaction.set_academy_capacity(
				checkpoint, int(payload.capacity)
			)
		"group.add_academy_prospect":
			result = CampaignGroupTransaction.add_academy_prospect(checkpoint, payload.candidate_id)
		"group.register_era":
			result = CampaignGroupTransaction.register_era(checkpoint, payload.input)
		"group.activate_era":
			result = CampaignGroupTransaction.activate_era(checkpoint, payload.era_id)
		"group.appoint_successor":
			result = CampaignGroupTransaction.appoint_successor(checkpoint, payload.person_id)
		"group.add_legacy_goal":
			result = CampaignGroupTransaction.add_legacy_goal(checkpoint, payload.input)
		"group.complete_legacy_goal":
			result = CampaignGroupTransaction.complete_legacy_goal(
				checkpoint, payload.goal_id, payload.evidence_id
			)
	return result


static func _supply(checkpoint: Dictionary, action: String, payload: Dictionary) -> Dictionary:
	var result = {"ok": false, "error": "Unknown campaign planning action."}
	match action:
		"supply.register_supplier":
			result = CampaignSupplyTransaction.register_supplier(checkpoint, payload.input)
		"supply.order_material":
			result = CampaignSupplyTransaction.order_material(checkpoint, payload.input)
		"supply.receive_order":
			result = CampaignSupplyTransaction.receive_order(checkpoint, payload.order_id)
		"supply.consume_material":
			result = CampaignSupplyTransaction.consume_material(
				checkpoint, payload.material_id, int(payload.quantity), payload.source_id
			)
		"supply.register_project_evidence":
			result = CampaignSupplyTransaction.register_project_evidence(
				checkpoint, payload.project_id, int(payload.latent_bps)
			)
		"supply.observe_project":
			result = CampaignSupplyTransaction.observe_project(checkpoint, payload.project_id)
		"supply.register_part":
			result = CampaignSupplyTransaction.register_part(checkpoint, payload.part_id)
		"supply.wear_part":
			result = CampaignSupplyTransaction.wear_part(
				checkpoint, payload.part_id, int(payload.wear)
			)
		"supply.repair_part":
			result = CampaignSupplyTransaction.repair_part(
				checkpoint, payload.part_id, payload.work_order_id
			)
	return result
