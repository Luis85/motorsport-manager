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
	match action:
		"finance.add_commitment":
			return CampaignFinanceTransaction.add_commitment(checkpoint, payload.input)
		"finance.cancel_commitment":
			return CampaignFinanceTransaction.cancel_commitment(checkpoint, payload.commitment_id)
		"finance.set_reserve_policy":
			return CampaignFinanceTransaction.set_reserve_policy(
				checkpoint, payload.account_id, int(payload.minimum_cash_minor)
			)
		"finance.settle_due":
			return CampaignFinanceTransaction.settle_due(checkpoint, int(payload.through_slot))
		"personnel.register_person":
			return CampaignPersonnelTransaction.register_person(checkpoint, payload.input)
		"personnel.sign_contract":
			return CampaignPersonnelTransaction.sign_contract(checkpoint, payload.input)
		"personnel.assign_role":
			return CampaignPersonnelTransaction.assign_role(checkpoint, payload.input)
		"personnel.reserve_availability":
			return CampaignPersonnelTransaction.reserve_availability(checkpoint, payload.input)
		"personnel.cancel_reservation":
			return CampaignPersonnelTransaction.cancel_reservation(
				checkpoint, payload.reservation_id
			)
		"personnel.terminate_contract":
			return CampaignPersonnelTransaction.terminate_contract(
				checkpoint, payload.contract_id, payload.reason
			)
		"personnel.renew_contract":
			return CampaignPersonnelTransaction.renew_contract(
				checkpoint, payload.contract_id, payload.input
			)
		"personnel.replace_contract":
			return CampaignPersonnelTransaction.replace_contract(
				checkpoint, payload.outgoing_contract_id, payload.incoming_terms, payload.reason
			)
		"operations.register_owned":
			return CampaignOperationsTransaction.register_owned(checkpoint, payload.input)
		"operations.register_service":
			return CampaignOperationsTransaction.register_service(checkpoint, payload.input)
		"operations.schedule_internal":
			return CampaignOperationsTransaction.schedule_internal(checkpoint, payload.input)
		"operations.schedule_service":
			return CampaignOperationsTransaction.schedule_service(checkpoint, payload.input)
		"operations.cancel_work_order":
			return CampaignOperationsTransaction.cancel_work_order(checkpoint, payload.order_id)
		"engineering.create_project":
			return CampaignEngineeringTransaction.create_project(checkpoint, payload.input)
		"engineering.bind_stage":
			return CampaignEngineeringTransaction.bind_stage(
				checkpoint, payload.project_id, payload.work_order_id
			)
		"engineering.complete_stage":
			return CampaignEngineeringTransaction.complete_stage(checkpoint, payload.project_id)
	return {"ok": false, "error": "Unknown campaign planning action."}
