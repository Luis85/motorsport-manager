class_name CampaignEngineeringOperations
extends RefCounted
## Engineering gates consume existing completed/scheduled CampaignOperations work.


static func validate(engineering: Dictionary, operations: Dictionary, current_slot: int) -> String:
	var error = CampaignEngineering.validate(engineering)
	if not error.is_empty():
		return error
	error = CampaignOperations.validate(operations)
	if not error.is_empty():
		return error
	if (
		engineering.campaign_id != operations.campaign_id
		or engineering.organization_id != operations.organization_id
	):
		return "Campaign engineering and operations belong to different organizations."
	for work_order_id in engineering.used_work_orders:
		if not operations.work_orders.has(work_order_id):
			return "Campaign engineering references a missing operations work order."
		var record: Dictionary = engineering.used_work_orders[work_order_id]
		var project: Dictionary = engineering.projects[record.project_id]
		var order: Dictionary = operations.work_orders[work_order_id]
		if (
			order.status != "scheduled"
			or order.family != CampaignEngineeringProject.expected_family(record.stage)
		):
			return "Campaign engineering gate uses incompatible or cancelled operations work."
		var project_stage_index = CampaignEngineeringProject.STAGES.find(project.stage)
		var record_stage_index = CampaignEngineeringProject.STAGES.find(record.stage)
		if (
			record_stage_index < project_stage_index
			and CampaignWorkOrder.state_at(order, current_slot) != "complete"
		):
			return "Completed campaign engineering gate no longer has completed operations evidence."
	return ""


static func work_order_available(
	engineering: Dictionary,
	operations: Dictionary,
	project_id: String,
	work_order_id: String,
	current_slot: int
) -> String:
	var error = validate(engineering, operations, current_slot)
	if not error.is_empty():
		return error
	if not engineering.projects.has(project_id) or not operations.work_orders.has(work_order_id):
		return "Engineering project or work order is unknown."
	if engineering.used_work_orders.has(work_order_id):
		return "Operations work order is already owned by another engineering gate."
	var project: Dictionary = engineering.projects[project_id]
	var order: Dictionary = operations.work_orders[work_order_id]
	if project.stage == "complete" or project.stage_orders.has(project.stage):
		return "Engineering project cannot accept another work order at this gate."
	if (
		order.status != "scheduled"
		or order.family != CampaignEngineeringProject.expected_family(project.stage)
	):
		return "Operations work does not match the current engineering gate."
	if current_slot < int(order.created_slot) or current_slot > int(order.start_slot):
		return "Engineering gate must bind its work before execution begins."
	return ""
