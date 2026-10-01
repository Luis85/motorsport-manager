class_name CampaignSupplyTransaction
extends RefCounted
static func register_supplier(checkpoint:Dictionary,input:Dictionary)->Dictionary:
	var r=_restore(checkpoint)
	if not r.ok:return r
	return _publish_supply(r,CampaignSupplyNetwork.register_supplier(r.management.supply,input,r.state.clock.elapsed_slots),r.economy,checkpoint)
static func order_material(checkpoint:Dictionary,input:Dictionary)->Dictionary:
	var r=_restore(checkpoint)
	if not r.ok:return r
	var changed=CampaignSupplyNetwork.order_material(r.management.supply,input,r.state.clock.elapsed_slots,r.state.organization_id)
	if not changed.ok:return _reject(changed.error,checkpoint)
	var added=CampaignEconomy.add_commitment(r.economy,changed.commitment_input,r.state.clock.elapsed_slots)
	if not added.ok:return _reject(added.error,checkpoint)
	return _publish_supply(r,changed,added.economy,checkpoint)
static func receive_order(checkpoint:Dictionary,order_id:String)->Dictionary:
	var r=_restore(checkpoint)
	if not r.ok:return r
	var due=CampaignEconomy.settle_due(r.economy,r.state.clock.elapsed_slots)
	if not due.ok:return _reject(due.error,checkpoint)
	var changed=CampaignSupplyNetwork.receive_order(r.management.supply,order_id,r.state.clock.elapsed_slots)
	return _publish_supply(r,changed,due.economy,checkpoint)
static func consume_material(checkpoint:Dictionary,material_id:String,quantity:int,source_id:String)->Dictionary:
	var r=_restore(checkpoint)
	if not r.ok:return r
	var changed=CampaignSupplyNetwork.consume_material(r.management.supply,material_id,quantity,source_id,r.state.clock.elapsed_slots)
	return _publish_supply(r,changed,r.economy,checkpoint)
static func register_project_evidence(checkpoint:Dictionary,project_id:String,latent_bps:int)->Dictionary:
	var r=_restore(checkpoint)
	if not r.ok:return r
	if not r.engineering.projects.has(project_id):return _reject("Engineering project is unknown.",checkpoint)
	var changed=CampaignSupplyNetwork.register_project_evidence(r.management.supply,project_id,latent_bps,r.state.clock.elapsed_slots)
	return _publish_supply(r,changed,r.economy,checkpoint)
static func observe_project(checkpoint:Dictionary,project_id:String)->Dictionary:
	var r=_restore(checkpoint)
	if not r.ok:return r
	var changed=CampaignSupplyNetwork.observe_project(r.management.supply,project_id,r.state.clock.elapsed_slots)
	return _publish_supply(r,changed,r.economy,checkpoint)
static func register_part(checkpoint:Dictionary,part_id:String)->Dictionary:
	var r=_restore(checkpoint)
	if not r.ok:return r
	if not r.engineering.parts.has(part_id):return _reject("Physical part is unknown.",checkpoint)
	return _publish_supply(r,CampaignSupplyNetwork.register_part(r.management.supply,part_id,r.state.clock.elapsed_slots),r.economy,checkpoint)
static func wear_part(checkpoint:Dictionary,part_id:String,wear:int)->Dictionary:
	var r=_restore(checkpoint)
	if not r.ok: return r
	var changed=CampaignSupplyNetwork.wear_part(r.management.supply,part_id,wear,r.state.clock.elapsed_slots)
	if not changed.ok: return _reject(changed.error,checkpoint)
	var condition=int(changed.supply.part_service[part_id].condition)
	var engineering=CampaignEngineering.set_part_condition(r.engineering,part_id,condition)
	if not engineering.ok: return _reject(engineering.error,checkpoint)
	return _publish_supply(r,changed,r.economy,checkpoint,engineering.engineering)
static func repair_part(checkpoint:Dictionary,part_id:String,work_order_id:String)->Dictionary:
	var r=_restore(checkpoint)
	if not r.ok: return r
	if not r.operations.work_orders.has(work_order_id): return _reject("Repair work order is unknown.",checkpoint)
	var work:Dictionary=r.operations.work_orders[work_order_id]
	if work.family not in ["preparation_workshop","fabrication_shop"] or CampaignWorkOrder.state_at(work,r.state.clock.elapsed_slots)!="complete":
		return _reject("Part repair requires completed preparation/fabrication capacity.",checkpoint)
	var changed=CampaignSupplyNetwork.repair_part(r.management.supply,part_id,r.state.clock.elapsed_slots)
	if not changed.ok: return _reject(changed.error,checkpoint)
	var engineering=CampaignEngineering.set_part_condition(r.engineering,part_id,100)
	if not engineering.ok: return _reject(engineering.error,checkpoint)
	return _publish_supply(r,changed,r.economy,checkpoint,engineering.engineering)
static func _restore(checkpoint:Dictionary)->Dictionary:
	var r=CampaignCheckpoint.restore(checkpoint)
	if not r.ok:return _reject(r.error,checkpoint)
	if not r.active_manifest.is_empty():return _reject("Supply planning is frozen while a weekend is active.",checkpoint)
	return r
static func _publish_supply(r:Dictionary,changed:Dictionary,economy:Dictionary,original:Dictionary,
		engineering:Dictionary={})->Dictionary:
	if not changed.ok: return _reject(changed.error,original,changed.get("status","rejected"))
	var m=CampaignManagement.with_supply(r.management,changed.supply)
	if m.is_empty(): return _reject("Supply change could not update management authority.",original)
	var actual_engineering=r.engineering if engineering.is_empty() else engineering
	var candidate=CampaignCheckpoint.build(r.state,r.settlements,r.active_manifest,r.competition,economy,r.inventory,r.personnel,r.operations,actual_engineering,m)
	if candidate.is_empty():return _reject("Supply change could not form one valid checkpoint.",original)
	return {"ok":true,"status":changed.status,"error":"","checkpoint":candidate}
static func _reject(message:String,checkpoint:Dictionary,status:String="rejected")->Dictionary:return {"ok":false,"status":status,"error":message,"checkpoint":checkpoint.duplicate(true)}
