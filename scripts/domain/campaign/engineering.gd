class_name CampaignEngineering
extends RefCounted
## Small campaign engineering portfolio: projects, validated designs and physical part instances.
const KIND = "motorsport-manager-campaign-engineering"
const VERSION = 1
const MAX_PROJECTS = 512
const MAX_PARTS = 2048

static func empty(campaign_id: String, organization_id: String,
		authority_from_slot: int = 0) -> Dictionary:
	if not CampaignIdentity.valid(campaign_id) or not CampaignIdentity.valid(organization_id) 			or not RaceCheckpoint.integral(authority_from_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return {}
	var data = {"kind": KIND, "version": VERSION, "campaign_id": campaign_id,
		"organization_id": organization_id, "authority_from_slot": authority_from_slot,
		"projects": {}, "designs": {}, "parts": {}, "used_work_orders": {}}
	_seal(data)
	return data if validate(data).is_empty() else {}

static func create_project(current: Dictionary, input: Dictionary, created_slot: int) -> Dictionary:
	var data = current.duplicate(true)
	var error = validate(data)
	if not error.is_empty(): return _reject(error, current)
	var project = CampaignEngineeringProject.build(input, created_slot)
	if project.is_empty() or data.projects.has(project.get("id")) 			or data.projects.size() >= MAX_PROJECTS:
		return _reject("Campaign engineering project is invalid, duplicated or the portfolio is full.", current)
	data.projects[project.id] = project
	return _validated(data, "project_created", current)

static func bind_stage(current: Dictionary, project_id: String, work_order_id: String,
		operations: Dictionary, slot: int) -> Dictionary:
	var data = current.duplicate(true)
	var error = validate(data)
	if not error.is_empty(): return _reject(error, current)
	if not data.projects.has(project_id) or not operations.work_orders.has(work_order_id) 			or data.used_work_orders.has(work_order_id):
		return _reject("Engineering stage references an unknown or already consumed work order.", current)
	var project: Dictionary = data.projects[project_id]
	if project.stage == "complete" or project.stage_orders.has(project.stage):
		return _reject("Engineering stage already has work assigned or the project is complete.", current)
	var order: Dictionary = operations.work_orders[work_order_id]
	if order.status != "scheduled" or order.family != CampaignEngineeringProject.expected_family(project.stage) 			or slot < int(order.created_slot) or slot > int(order.start_slot):
		return _reject("Engineering work order does not match the current gate or is already underway.", current)
	var next = project.duplicate(true)
	next.stage_orders[project.stage] = work_order_id
	var commitment_input = {}
	if project.stage == "production":
		next.material_commitment_id = CampaignEngineeringProject.material_commitment_id(project.id)
		commitment_input = {"id": next.material_commitment_id,
			"source_id": project.id, "due_slot": int(order.start_slot),
			"amount_minor": -int(project.material_cost_minor), "category": "development"}
	_reseal_project(next)
	data.projects[project_id] = next
	data.used_work_orders[work_order_id] = {"project_id": project_id, "stage": project.stage}
	var result = _validated(data, "stage_bound", current)
	if result.ok: result["commitment_input"] = commitment_input
	return result

static func complete_stage(current: Dictionary, project_id: String,
		operations: Dictionary, slot: int) -> Dictionary:
	var data = current.duplicate(true)
	var error = validate(data)
	if not error.is_empty(): return _reject(error, current)
	if not data.projects.has(project_id):
		return _reject("Campaign engineering project is unknown.", current)
	var project: Dictionary = data.projects[project_id]
	if project.stage == "complete" or not project.stage_orders.has(project.stage):
		return _reject("Campaign engineering gate has no completed work to accept.", current)
	var work_order_id: String = project.stage_orders[project.stage]
	if not operations.work_orders.has(work_order_id) 			or CampaignWorkOrder.state_at(operations.work_orders[work_order_id], slot) != "complete":
		return _reject("Campaign engineering gate work has not completed.", current)
	var completed_stage: String = project.stage
	var next = project.duplicate(true)
	next.stage = CampaignEngineeringProject.next_stage(completed_stage)
	if completed_stage == "validation":
		var design = CampaignEngineeringDesign.build(next, slot, work_order_id)
		if design.is_empty() or data.designs.has(design.id):
			return _reject("Validated design could not be published exactly once.", current)
		data.designs[design.id] = design
	elif completed_stage == "production":
		if not data.designs.has(project.design_id):
			return _reject("Physical production requires the validated design.", current)
		var part = CampaignPartInstance.build(next, data.designs[project.design_id], slot, work_order_id)
		if part.is_empty() or data.parts.has(part.id) or data.parts.size() >= MAX_PARTS:
			return _reject("Physical part could not be created exactly once.", current)
		data.parts[part.id] = part
	elif completed_stage == "integration":
		if not data.parts.has(project.part_id):
			return _reject("Integration requires the manufactured physical part.", current)
		var installed = CampaignPartInstance.install(
			data.parts[project.part_id], project.target_car_id, slot, work_order_id)
		if installed.is_empty():
			return _reject("Physical part installation evidence is invalid.", current)
		data.parts[project.part_id] = installed
	_reseal_project(next)
	data.projects[project_id] = next
	return _validated(data, "stage_completed", current)

static func set_part_condition(current: Dictionary, part_id: String, condition: int) -> Dictionary:
	var data = current.duplicate(true)
	var error = validate(data)
	if not error.is_empty(): return _reject(error, current)
	if not data.parts.has(part_id) or not RaceCheckpoint.integral(condition, 0, 100):
		return _reject("Campaign physical part condition update is invalid.", current)
	var part: Dictionary = data.parts[part_id].duplicate(true)
	part.condition = condition
	part.erase("digest"); part["digest"] = RaceStateValue.fingerprint(part)
	data.parts[part_id] = part
	return _validated(data, "part_condition_updated", current)

static func performance_profile(data: Dictionary, car_id: String) -> Dictionary:
	if not validate(data).is_empty() or not CampaignIdentity.valid(car_id):
		return {}
	var delta = {"top": 0, "lat": 0, "accel": 0, "brake": 0}
	var sources: Array = []
	for part_id in data.parts:
		var part: Dictionary = data.parts[part_id]
		if part.status != "installed" or part.installed_car_id != car_id:
			continue
		var design: Dictionary = data.designs.get(part.design_id, {})
		if design.is_empty(): return {}
		for key in RacePerformanceProfile.KEYS:
			delta[key] = clampi(int(delta[key]) + int(design.profile_delta.get(key, 0)),
				-RacePerformanceProfile.DELTA_LIMIT, RacePerformanceProfile.DELTA_LIMIT)
		sources.append(part_id)
	sources.sort()
	return RacePerformanceProfile.build(delta, sources)

static func validate(data: Variant) -> String:
	if not RaceStateValue.serializable(data) or not data is Dictionary 			or data.size() != 10 or data.get("kind") != KIND:
		return "Unsupported campaign engineering projection."
	if not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION) 			or not CampaignIdentity.valid(data.get("campaign_id")) 			or not CampaignIdentity.valid(data.get("organization_id")) 			or not RaceCheckpoint.integral(data.get("authority_from_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS):
		return "Campaign engineering version, identity or authority is invalid."
	if not data.get("projects") is Dictionary or data.projects.size() > MAX_PROJECTS 			or not data.get("designs") is Dictionary or data.designs.size() > MAX_PROJECTS 			or not data.get("parts") is Dictionary or data.parts.size() > MAX_PARTS 			or not data.get("used_work_orders") is Dictionary:
		return "Campaign engineering collections are invalid."
	var error = _records_error(data)
	if not error.is_empty(): return error
	return _integrity_error(data)

static func _records_error(data: Dictionary) -> String:
	for project_id in data.projects:
		var project: Dictionary = data.projects[project_id]
		if project_id != project.get("id") or not CampaignEngineeringProject.validate(project).is_empty() 				or int(project.created_slot) < int(data.authority_from_slot):
			return "Campaign engineering contains an invalid project."
	for design_id in data.designs:
		var design: Dictionary = data.designs[design_id]
		if design_id != design.get("id") or not CampaignEngineeringDesign.validate(design).is_empty() 				or not data.projects.has(design.project_id):
			return "Campaign engineering contains an invalid design."
		var project: Dictionary = data.projects[design.project_id]
		if project.design_id != design_id 				or design.validation_work_order_id != project.stage_orders.get("validation", "") 				or design.profile_delta != project.profile_delta:
			return "Campaign engineering design disagrees with its project validation evidence."
	for part_id in data.parts:
		var part: Dictionary = data.parts[part_id]
		if part_id != part.get("id") or not CampaignPartInstance.validate(part).is_empty() 				or not data.projects.has(part.project_id) or not data.designs.has(part.design_id):
			return "Campaign engineering contains an invalid physical part."
		var project: Dictionary = data.projects[part.project_id]
		if project.part_id != part_id 				or part.production_work_order_id != project.stage_orders.get("production", ""):
			return "Campaign physical part disagrees with its project production evidence."
		if part.status == "installed" 				and part.integration_work_order_id != project.stage_orders.get("integration", ""):
			return "Campaign physical part disagrees with its project integration evidence."
	var seen = {}
	for project in data.projects.values():
		var stage_index = CampaignEngineeringProject.STAGES.find(project.stage)
		var validation_index = CampaignEngineeringProject.STAGES.find("production")
		var production_index = CampaignEngineeringProject.STAGES.find("integration")
		if stage_index >= validation_index and not data.designs.has(project.design_id):
			return "Campaign engineering project passed validation without its design evidence."
		if stage_index >= production_index and not data.parts.has(project.part_id):
			return "Campaign engineering project passed production without its physical part."
		if project.stage == "complete":
			var part: Dictionary = data.parts.get(project.part_id, {})
			if part.get("status") != "installed" or part.get("installed_car_id") != project.target_car_id:
				return "Completed campaign engineering project lacks the installed target part."
		for stage in project.stage_orders:
			var order_id: String = project.stage_orders[stage]
			if not data.used_work_orders.has(order_id) 					or data.used_work_orders[order_id].get("project_id") != project.id 					or data.used_work_orders[order_id].get("stage") != stage:
				return "Campaign engineering stage work is not indexed exactly once."
	for work_order_id in data.used_work_orders:
		var record = data.used_work_orders[work_order_id]
		if not CampaignIdentity.valid(work_order_id) or seen.has(work_order_id) 				or not record is Dictionary or record.size() != 2 				or not data.projects.has(record.get("project_id")) 				or record.get("stage") not in CampaignEngineeringProject.STAGES:
			return "Campaign engineering work-order index is invalid."
		var project: Dictionary = data.projects[record.project_id]
		if project.stage_orders.get(record.stage) != work_order_id:
			return "Campaign engineering work-order index disagrees with its project."
		seen[work_order_id] = true
	return ""

static func _validated(data: Dictionary, status: String, current: Dictionary) -> Dictionary:
	_seal(data)
	var error = validate(data)
	return {"ok": error.is_empty(), "status": status if error.is_empty() else "rejected",
		"error": error, "engineering": data if error.is_empty() else current.duplicate(true)}

static func _reject(message: String, current: Dictionary, status: String = "rejected") -> Dictionary:
	return {"ok": false, "status": status, "error": message, "engineering": current.duplicate(true)}

static func _reseal_project(project: Dictionary) -> void:
	project.erase("digest")
	project["digest"] = RaceStateValue.fingerprint(project)

static func _integrity_error(data: Dictionary) -> String:
	var content = data.duplicate(true); content.erase("digest")
	if not CampaignIdentity.valid_hash(data.get("digest")) 			or data.digest != RaceStateValue.fingerprint(content):
		return "Campaign engineering integrity check failed."
	return ""

static func _seal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
