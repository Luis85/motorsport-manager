class_name CampaignGroupTransaction
extends RefCounted
## TM-16 opt-in founder business, academy, era and succession actions.

static func initialize(checkpoint:Dictionary,parent_cash_minor:int,era:Dictionary)->Dictionary:
	var r=_restore(checkpoint);if not r.ok:return r
	var changed=CampaignGroup.initialize(r.management.group,r.state.principal_id,parent_cash_minor,era,r.state.clock.elapsed_slots)
	return _publish_group(r,changed,r.economy,checkpoint)

static func create_service_order(checkpoint:Dictionary,input:Dictionary)->Dictionary:
	var r=_restore(checkpoint);if not r.ok:return r
	var work_id=input.get("work_order_id")
	if not r.operations.work_orders.has(work_id):return _reject("Founder service order requires one shared work order.",checkpoint)
	var work:Dictionary=r.operations.work_orders[work_id]
	if work.family not in ["preparation_workshop","fabrication_shop"] or r.engineering.used_work_orders.has(work_id):
		return _reject("Founder service order cannot reuse incompatible or engineering-owned capacity.",checkpoint)
	var data=input.duplicate(true)
	if not data.has("due_slot"):data["due_slot"]=work.end_slot
	var changed=CampaignGroup.create_business_order(r.management.group,data,r.state.clock.elapsed_slots)
	return _publish_group(r,changed,r.economy,checkpoint)

static func complete_service_order(checkpoint:Dictionary,order_id:String)->Dictionary:
	var r=_restore(checkpoint);if not r.ok:return r
	if not r.management.group.business_orders.has(order_id):return _reject("Founder service order is unknown.",checkpoint)
	var order:Dictionary=r.management.group.business_orders[order_id]
	if not r.operations.work_orders.has(order.work_order_id) 			or CampaignWorkOrder.state_at(r.operations.work_orders[order.work_order_id],r.state.clock.elapsed_slots)!="complete":
		return _reject("Founder service order waits for its shared work capacity.",checkpoint)
	var changed=CampaignGroup.complete_business_order(r.management.group,order_id,r.state.clock.elapsed_slots)
	return _publish_group(r,changed,r.economy,checkpoint)

static func transfer_to_team(checkpoint:Dictionary,id:String,amount_minor:int)->Dictionary:
	var r=_restore(checkpoint);if not r.ok:return r
	var changed=CampaignGroup.transfer_to_team(r.management.group,
		{"id":id,"amount_minor":amount_minor},r.state.clock.elapsed_slots)
	if not changed.ok:return _reject(changed.error,checkpoint)
	var input:Dictionary=changed.commitment_input.duplicate(true);input["account_id"]=r.state.organization_id
	var added=CampaignEconomy.add_commitment(r.economy,input,r.state.clock.elapsed_slots)
	if not added.ok:return _reject(added.error,checkpoint)
	var settled=CampaignEconomy.settle_due(added.economy,r.state.clock.elapsed_slots)
	if not settled.ok:return _reject(settled.error,checkpoint)
	return _publish_group(r,changed,settled.economy,checkpoint)

static func set_academy_capacity(checkpoint:Dictionary,capacity:int)->Dictionary:
	var r=_restore(checkpoint);if not r.ok:return r
	var available=0
	for resource in r.operations.resources.values():
		if resource.access=="owned" and resource.family=="academy":available+=int(resource.capacity_units)
	if capacity>available:return _reject("Academy places cannot exceed owned academy capacity.",checkpoint)
	return _publish_group(r,CampaignGroup.set_academy_capacity(r.management.group,capacity),r.economy,checkpoint)

static func add_academy_prospect(checkpoint:Dictionary,candidate_id:String)->Dictionary:
	var r=_restore(checkpoint);if not r.ok:return r
	if not r.management.people.candidates.has(candidate_id) 			or r.management.people.candidates[candidate_id].state not in ["available","approached","negotiating"]:
		return _reject("Academy prospect must be an available persistent candidate.",checkpoint)
	return _publish_group(r,CampaignGroup.add_academy_prospect(r.management.group,candidate_id,r.state.clock.elapsed_slots),r.economy,checkpoint)

static func register_era(checkpoint:Dictionary,input:Dictionary)->Dictionary:
	var r=_restore(checkpoint);if not r.ok:return r
	return _publish_group(r,CampaignGroup.register_era(r.management.group,input,r.state.clock.elapsed_slots),r.economy,checkpoint)

static func activate_era(checkpoint:Dictionary,era_id:String)->Dictionary:
	var r=_restore(checkpoint);if not r.ok:return r
	for season in r.competition.seasons.values():
		if season.status!="completed":return _reject("Era transition requires completed championship seasons.",checkpoint)
	return _publish_group(r,CampaignGroup.activate_era(r.management.group,era_id,r.state.clock.elapsed_slots),r.economy,checkpoint)

static func appoint_successor(checkpoint:Dictionary,person_id:String)->Dictionary:
	var r=_restore(checkpoint);if not r.ok:return r
	if not r.personnel.people.has(person_id):return _reject("Successor must be a known employed campaign person.",checkpoint)
	var employed=false
	for contract in r.personnel.contracts.values():
		if contract.person_id==person_id and CampaignEmploymentContract.status_at(contract,r.state.clock.elapsed_slots) in ["active","renewal_window"]:
			employed=true;break
	if not employed:return _reject("Successor must have active employment.",checkpoint)
	return _publish_group(r,CampaignGroup.appoint_successor(r.management.group,person_id,r.state.clock.elapsed_slots),r.economy,checkpoint)

static func add_legacy_goal(checkpoint:Dictionary,input:Dictionary)->Dictionary:
	var r=_restore(checkpoint);if not r.ok:return r
	return _publish_group(r,CampaignGroup.add_legacy_goal(r.management.group,input,r.state.clock.elapsed_slots),r.economy,checkpoint)

static func complete_legacy_goal(checkpoint:Dictionary,goal_id:String,evidence_id:String)->Dictionary:
	var r=_restore(checkpoint);if not r.ok:return r
	return _publish_group(r,CampaignGroup.complete_legacy_goal(r.management.group,goal_id,evidence_id,r.state.clock.elapsed_slots),r.economy,checkpoint)

static func _restore(checkpoint:Dictionary)->Dictionary:
	var r=CampaignCheckpoint.restore(checkpoint)
	if not r.ok:return _reject(r.error,checkpoint)
	if not r.active_manifest.is_empty():return _reject("Group planning is frozen while a weekend is active.",checkpoint)
	return r

static func _publish_group(r:Dictionary,changed:Dictionary,economy:Dictionary,original:Dictionary)->Dictionary:
	if not changed.ok:return _reject(changed.error,original,changed.get("status","rejected"))
	var m=CampaignManagement.with_group(r.management,changed.group)
	if m.is_empty():return _reject("Group change could not update management authority.",original)
	var c=CampaignCheckpoint.build(r.state,r.settlements,r.active_manifest,r.competition,economy,r.inventory,r.personnel,r.operations,r.engineering,m)
	if c.is_empty():return _reject("Group change could not form one valid campaign checkpoint.",original)
	return {"ok":true,"status":changed.status,"error":"","checkpoint":c}

static func _reject(message:String,checkpoint:Dictionary,status:String="rejected")->Dictionary:
	return {"ok":false,"status":status,"error":message,"checkpoint":checkpoint.duplicate(true)}
