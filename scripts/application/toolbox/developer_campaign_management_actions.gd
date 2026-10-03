class_name DeveloperCampaignManagementActions
extends RefCounted
## Explicit management transaction allowlist; the existing owners validate and publish.
const SPECS = {
	"people.register_candidate": [{"input": "Dictionary"}, ["input"]],
	"people.approach": [{"candidate_id": "String"}, ["candidate_id"]],
	"people.offer_and_hire":
	[
		{
			"candidate_id": "String",
			"role_id": "String",
			"contract_terms": "Dictionary",
			"assignment_id": "String"
		},
		["candidate_id", "role_id", "contract_terms", "assignment_id"]
	],
	"people.add_profile":
	[
		{"person_id": "String", "attributes": "Dictionary", "morale": "int", "trust": "int"},
		["person_id", "attributes"]
	],
	"people.set_development_plan":
	[
		{"person_id": "String", "focus": "String", "review_slot": "int"},
		["person_id", "focus", "review_slot"]
	],
	"people.create_promise": [{"input": "Dictionary"}, ["input"]],
	"people.resolve_promise":
	[{"promise_id": "String", "fulfilled": "bool"}, ["promise_id", "fulfilled"]],
	"people.review_due": [{}, []],
	"commercial.sign_agreement": [{"input": "Dictionary"}, ["input"]],
	"commercial.claim_event_bonus":
	[{"agreement_id": "String", "event_id": "String"}, ["agreement_id", "event_id"]],
	"delegation.create_mandate": [{"input": "Dictionary"}, ["input"]],
	"delegation.revoke_mandate": [{"mandate_id": "String"}, ["mandate_id"]],
	"rival.register_team": [{"input": "Dictionary"}, ["input"]],
	"rival.review_due": [{}, []],
	"distress.evaluate": [{}, []],
	"distress.bridge_financing": [{"amount_minor": "int"}, ["amount_minor"]],
}


static func apply(checkpoint: Dictionary, action: String, payload: Dictionary) -> Dictionary:
	var result = {"ok": false, "error": "Unknown campaign planning action."}
	match action.get_slice(".", 0):
		"people":
			result = _people(checkpoint, action, payload)
		"commercial":
			result = _commercial(checkpoint, action, payload)
		"delegation":
			result = _delegation(checkpoint, action, payload)
		"rival":
			result = _rival(checkpoint, action, payload)
		"distress":
			result = _distress(checkpoint, action, payload)
	return result


static func _people(checkpoint: Dictionary, action: String, payload: Dictionary) -> Dictionary:
	var result = {"ok": false, "error": "Unknown campaign planning action."}
	match action:
		"people.register_candidate":
			result = CampaignPeopleTransaction.register_candidate(checkpoint, payload.input)
		"people.approach":
			result = CampaignPeopleTransaction.approach(checkpoint, payload.candidate_id)
		"people.offer_and_hire":
			result = CampaignPeopleTransaction.offer_and_hire(
				checkpoint,
				payload.candidate_id,
				payload.role_id,
				payload.contract_terms,
				payload.assignment_id
			)
		"people.add_profile":
			result = CampaignPeopleTransaction.add_profile(
				checkpoint,
				payload.person_id,
				payload.attributes,
				int(payload.get("morale", 60)),
				int(payload.get("trust", 60))
			)
		"people.set_development_plan":
			result = CampaignPeopleTransaction.set_development_plan(
				checkpoint, payload.person_id, payload.focus, int(payload.review_slot)
			)
		"people.create_promise":
			result = CampaignPeopleTransaction.create_promise(checkpoint, payload.input)
		"people.resolve_promise":
			result = CampaignPeopleTransaction.resolve_promise(
				checkpoint, payload.promise_id, payload.fulfilled
			)
		"people.review_due":
			result = CampaignPeopleTransaction.review_due(checkpoint)
	return result


static func _commercial(checkpoint: Dictionary, action: String, payload: Dictionary) -> Dictionary:
	var result = {"ok": false, "error": "Unknown campaign planning action."}
	match action:
		"commercial.sign_agreement":
			result = CampaignCommercialTransaction.sign_agreement(checkpoint, payload.input)
		"commercial.claim_event_bonus":
			result = CampaignCommercialTransaction.claim_event_bonus(
				checkpoint, payload.agreement_id, payload.event_id
			)
	return result


static func _delegation(checkpoint: Dictionary, action: String, payload: Dictionary) -> Dictionary:
	var result = {"ok": false, "error": "Unknown campaign planning action."}
	match action:
		"delegation.create_mandate":
			result = CampaignDelegationTransaction.create_mandate(checkpoint, payload.input)
		"delegation.revoke_mandate":
			result = CampaignDelegationTransaction.revoke_mandate(checkpoint, payload.mandate_id)
	return result


static func _rival(checkpoint: Dictionary, action: String, payload: Dictionary) -> Dictionary:
	var result = {"ok": false, "error": "Unknown campaign planning action."}
	match action:
		"rival.register_team":
			result = CampaignRivalTransaction.register_team(checkpoint, payload.input)
		"rival.review_due":
			result = CampaignRivalTransaction.review_due(checkpoint)
	return result


static func _distress(checkpoint: Dictionary, action: String, payload: Dictionary) -> Dictionary:
	var result = {"ok": false, "error": "Unknown campaign planning action."}
	match action:
		"distress.evaluate":
			result = CampaignDistressTransaction.evaluate(checkpoint)
		"distress.bridge_financing":
			result = CampaignDistressTransaction.bridge_financing(
				checkpoint, int(payload.amount_minor)
			)
	return result
