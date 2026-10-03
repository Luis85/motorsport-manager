class_name DeveloperCampaignOrganizationActions
extends RefCounted
## Explicit organization transaction allowlist; the existing owners validate and publish.
const SPECS = {
	"finance.add_commitment": [{"input": "Dictionary"}, ["input"]],
	"finance.cancel_commitment": [{"commitment_id": "String"}, ["commitment_id"]],
	"finance.set_reserve_policy":
	[{"account_id": "String", "minimum_cash_minor": "int"}, ["account_id", "minimum_cash_minor"]],
	"finance.settle_due": [{"through_slot": "int"}, ["through_slot"]],
	"personnel.register_person": [{"input": "Dictionary"}, ["input"]],
	"personnel.sign_contract": [{"input": "Dictionary"}, ["input"]],
	"personnel.assign_role": [{"input": "Dictionary"}, ["input"]],
	"personnel.reserve_availability": [{"input": "Dictionary"}, ["input"]],
	"personnel.cancel_reservation": [{"reservation_id": "String"}, ["reservation_id"]],
	"personnel.terminate_contract":
	[{"contract_id": "String", "reason": "String"}, ["contract_id", "reason"]],
	"personnel.renew_contract":
	[{"contract_id": "String", "input": "Dictionary"}, ["contract_id", "input"]],
	"personnel.replace_contract":
	[
		{"outgoing_contract_id": "String", "incoming_terms": "Dictionary", "reason": "String"},
		["outgoing_contract_id", "incoming_terms", "reason"]
	],
	"operations.register_owned": [{"input": "Dictionary"}, ["input"]],
	"operations.register_service": [{"input": "Dictionary"}, ["input"]],
	"operations.schedule_internal": [{"input": "Dictionary"}, ["input"]],
	"operations.schedule_service": [{"input": "Dictionary"}, ["input"]],
	"operations.cancel_work_order": [{"order_id": "String"}, ["order_id"]],
	"engineering.create_project": [{"input": "Dictionary"}, ["input"]],
	"engineering.bind_stage":
	[{"project_id": "String", "work_order_id": "String"}, ["project_id", "work_order_id"]],
	"engineering.complete_stage": [{"project_id": "String"}, ["project_id"]],
}


static func apply(checkpoint: Dictionary, action: String, payload: Dictionary) -> Dictionary:
	var result = {"ok": false, "error": "Unknown campaign planning action."}
	match action.get_slice(".", 0):
		"finance":
			result = _finance(checkpoint, action, payload)
		"personnel":
			result = _personnel(checkpoint, action, payload)
		"operations":
			result = _operations(checkpoint, action, payload)
		"engineering":
			result = _engineering(checkpoint, action, payload)
	return result


static func _finance(checkpoint: Dictionary, action: String, payload: Dictionary) -> Dictionary:
	var result = {"ok": false, "error": "Unknown campaign planning action."}
	match action:
		"finance.add_commitment":
			result = CampaignFinanceTransaction.add_commitment(checkpoint, payload.input)
		"finance.cancel_commitment":
			result = CampaignFinanceTransaction.cancel_commitment(checkpoint, payload.commitment_id)
		"finance.set_reserve_policy":
			result = CampaignFinanceTransaction.set_reserve_policy(
				checkpoint, payload.account_id, int(payload.minimum_cash_minor)
			)
		"finance.settle_due":
			result = CampaignFinanceTransaction.settle_due(checkpoint, int(payload.through_slot))
	return result


static func _personnel(checkpoint: Dictionary, action: String, payload: Dictionary) -> Dictionary:
	var result = {"ok": false, "error": "Unknown campaign planning action."}
	match action:
		"personnel.register_person":
			result = CampaignPersonnelTransaction.register_person(checkpoint, payload.input)
		"personnel.sign_contract":
			result = CampaignPersonnelTransaction.sign_contract(checkpoint, payload.input)
		"personnel.assign_role":
			result = CampaignPersonnelTransaction.assign_role(checkpoint, payload.input)
		"personnel.reserve_availability":
			result = CampaignPersonnelTransaction.reserve_availability(checkpoint, payload.input)
		"personnel.cancel_reservation":
			result = CampaignPersonnelTransaction.cancel_reservation(
				checkpoint, payload.reservation_id
			)
		"personnel.terminate_contract":
			result = CampaignPersonnelTransaction.terminate_contract(
				checkpoint, payload.contract_id, payload.reason
			)
		"personnel.renew_contract":
			result = CampaignPersonnelTransaction.renew_contract(
				checkpoint, payload.contract_id, payload.input
			)
		"personnel.replace_contract":
			result = CampaignPersonnelTransaction.replace_contract(
				checkpoint, payload.outgoing_contract_id, payload.incoming_terms, payload.reason
			)
	return result


static func _operations(checkpoint: Dictionary, action: String, payload: Dictionary) -> Dictionary:
	var result = {"ok": false, "error": "Unknown campaign planning action."}
	match action:
		"operations.register_owned":
			result = CampaignOperationsTransaction.register_owned(checkpoint, payload.input)
		"operations.register_service":
			result = CampaignOperationsTransaction.register_service(checkpoint, payload.input)
		"operations.schedule_internal":
			result = CampaignOperationsTransaction.schedule_internal(checkpoint, payload.input)
		"operations.schedule_service":
			result = CampaignOperationsTransaction.schedule_service(checkpoint, payload.input)
		"operations.cancel_work_order":
			result = CampaignOperationsTransaction.cancel_work_order(checkpoint, payload.order_id)
	return result


static func _engineering(checkpoint: Dictionary, action: String, payload: Dictionary) -> Dictionary:
	var result = {"ok": false, "error": "Unknown campaign planning action."}
	match action:
		"engineering.create_project":
			result = CampaignEngineeringTransaction.create_project(checkpoint, payload.input)
		"engineering.bind_stage":
			result = CampaignEngineeringTransaction.bind_stage(
				checkpoint, payload.project_id, payload.work_order_id
			)
		"engineering.complete_stage":
			result = CampaignEngineeringTransaction.complete_stage(checkpoint, payload.project_id)
	return result
