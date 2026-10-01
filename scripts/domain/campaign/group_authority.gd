class_name CampaignGroupAuthority
extends RefCounted
## Cross-envelope conservation and identity checks for founder/academy/dynasty scope.

static func validate(group:Dictionary,economy:Dictionary,operations:Dictionary,
		engineering:Dictionary,people:Dictionary,personnel:Dictionary,current_slot:int)->String:
	var error=CampaignGroup.validate(group)
	if not error.is_empty():return error
	if not group.initialized:return ""
	var expected=int(group.opening_parent_cash_minor)
	for order in group.business_orders.values():
		if not operations.work_orders.has(order.work_order_id):return "Founder business order references unknown shared capacity."
		var work:Dictionary=operations.work_orders[order.work_order_id]
		if work.status != "scheduled" or work.family not in ["preparation_workshop","fabrication_shop"] or engineering.used_work_orders.has(order.work_order_id):
			return "Founder business order reuses incompatible or engineering-owned work."
		if order.status=="completed":
			if CampaignWorkOrder.state_at(work,int(order.completed_slot))!="complete":return "Founder business completed before shared work."
			expected+=int(order.value_minor)
	for transfer in group.transfers:
		if not economy.commitments.has(transfer.commitment_id):return "Group transfer has no team cash receipt."
		var c:Dictionary=economy.commitments[transfer.commitment_id]
		if c.source_id!=transfer.id or c.category!="owner_transfer" or int(c.amount_minor)!=int(transfer.amount_minor) 				or int(c.due_slot)!=int(transfer.slot) or c.status!="settled":
			return "Group transfer disagrees with its team-side cash evidence."
		expected-=int(transfer.amount_minor)
	if expected!=int(group.parent_cash_minor):return "Parent-company cash does not conserve business income and transfers."
	var academy_capacity = 0
	for resource in operations.resources.values():
		if resource.access == "owned" and resource.family == "academy":
			academy_capacity += int(resource.capacity_units)
	if int(group.academy.capacity) > academy_capacity:
		return "Academy places exceed owned academy capacity."
	for candidate_id in group.academy.prospects:
		if not people.candidates.has(candidate_id):return "Academy prospect is absent from the persistent candidate market."
	var principal=group.dynasty.operating_principal_id
	if principal!=group.founder_id:
		if not personnel.people.has(principal):return "Operating principal is not a known campaign person."
		var employed = false
		for contract in personnel.contracts.values():
			if contract.person_id == principal and CampaignEmploymentContract.status_at(contract,current_slot) in ["active","renewal_window"]:
				employed = true
				break
		if not employed:return "Operating successor no longer has active employment."
	for order in group.business_orders.values():
		if int(order.created_slot)>current_slot or int(order.completed_slot)>current_slot:return "Founder business history is future-dated."
	for transfer in group.transfers:
		if int(transfer.slot)>current_slot:return "Group transfer is future-dated."
	for row in group.dynasty.successions:
		if int(row.slot)>current_slot:return "Succession history is future-dated."
	return ""
