class_name CampaignSupplyNetwork
extends RefCounted
## Procurement/material conservation, persistent engineering evidence and part service history.
const MAX_SUPPLIERS = 128
const MAX_ORDERS = 2048
const MAX_MATERIALS = 128
const MAX_EVIDENCE = 512
const MAX_PARTS = CampaignEngineering.MAX_PARTS
const MAX_HISTORY = 4096
const ORDER_STATES = ["ordered", "received", "cancelled"]

static func empty() -> Dictionary:
	return {"suppliers": {}, "orders": {}, "materials": {}, "project_evidence": {},
		"part_service": {}, "history": []}

static func register_supplier(current: Dictionary, input: Dictionary, slot: int) -> Dictionary:
	var error = validate(current)
	if not error.is_empty(): return _reject(error, current)
	if current.suppliers.size() >= MAX_SUPPLIERS: return _reject("Supplier registry is full.", current)
	var supplier = {"id": input.get("id"), "display_name": input.get("display_name"),
		"material_id": input.get("material_id"), "unit_price_minor": input.get("unit_price_minor"),
		"lead_slots": input.get("lead_slots"), "capacity_units": input.get("capacity_units"),
		"reliability_bps": input.get("reliability_bps"), "created_slot": slot}
	_seal(supplier)
	if not _supplier_error(supplier).is_empty() or current.suppliers.has(supplier.get("id")):
		return _reject("Supplier is invalid or duplicated.", current)
	var data=current.duplicate(true); data.suppliers[supplier.id]=supplier
	return _result(data,"supplier_registered",current)

static func order_material(current: Dictionary, input: Dictionary, slot: int,
		account_id: String) -> Dictionary:
	var error=validate(current)
	if not error.is_empty(): return _reject(error,current)
	if current.orders.size()>=MAX_ORDERS or not current.suppliers.has(input.get("supplier_id")):
		return _reject("Procurement order is invalid or supplier is unknown.",current)
	var supplier:Dictionary=current.suppliers[input.supplier_id]
	var quantity=input.get("quantity")
	if not RaceCheckpoint.integral(quantity,1,int(supplier.capacity_units)):
		return _reject("Procurement quantity exceeds reserved supplier capacity.",current)
	var amount=int(quantity)*int(supplier.unit_price_minor)
	if not RaceCheckpoint.integral(amount,1,CampaignEconomy.MAX_MINOR): return _reject("Procurement amount is invalid.",current)
	var order={"id":input.get("id"),"supplier_id":supplier.id,"material_id":supplier.material_id,
		"quantity":int(quantity),"ordered_slot":slot,"due_slot":slot+int(supplier.lead_slots),
		"amount_minor":amount,"status":"ordered","received_slot":-1,
		"commitment_id":"supplier."+RaceStateValue.fingerprint([input.get("id"),supplier.id]).substr(0,24)}
	_seal(order)
	if not _order_error(order).is_empty() or current.orders.has(order.get("id")):
		return _reject("Procurement order is invalid or duplicated.",current)
	var data=current.duplicate(true);data.orders[order.id]=order
	var result=_result(data,"ordered",current)
	if result.ok: result["commitment_input"]={"id":order.commitment_id,"account_id":account_id,
		"source_id":order.id,"due_slot":order.due_slot,"amount_minor":-amount,"category":"supplier"}
	return result

static func receive_order(current:Dictionary,order_id:String,slot:int)->Dictionary:
	var error=validate(current)
	if not error.is_empty():return _reject(error,current)
	if not current.orders.has(order_id):return _reject("Procurement order is unknown.",current)
	var order:Dictionary=current.orders[order_id]
	if order.status!="ordered" or slot<int(order.due_slot):return _reject("Procurement order has not reached its promised delivery.",current)
	var data=current.duplicate(true);order=order.duplicate(true);order.status="received";order.received_slot=slot;_seal(order);data.orders[order_id]=order
	var stock:Dictionary=data.materials.get(order.material_id,{"material_id":order.material_id,"quantity":0,"received_units":0,"consumed_units":0})
	stock.quantity=int(stock.quantity)+int(order.quantity);stock.received_units=int(stock.received_units)+int(order.quantity)
	data.materials[order.material_id]=stock
	_history(data,"received",order_id,slot,int(order.quantity))
	return _result(data,"received",current)

static func consume_material(current:Dictionary,material_id:String,quantity:int,
		source_id:String,slot:int)->Dictionary:
	var error=validate(current)
	if not error.is_empty():return _reject(error,current)
	if not current.materials.has(material_id) or not RaceCheckpoint.integral(quantity,1,1000000) 			or int(current.materials[material_id].quantity)<quantity or not CampaignIdentity.valid(source_id):
		return _reject("Material consumption exceeds physical stock or has invalid provenance.",current)
	var data=current.duplicate(true);var stock:Dictionary=data.materials[material_id]
	stock.quantity=int(stock.quantity)-quantity;stock.consumed_units=int(stock.consumed_units)+quantity
	data.materials[material_id]=stock;_history(data,"consumed",material_id,slot,quantity)
	return _result(data,"consumed",current)

static func register_project_evidence(current:Dictionary,project_id:String,
		latent_outcome_bps:int,slot:int,policy:Dictionary={})->Dictionary:
	var error=validate(current)
	var tuning=CampaignSupplyPolicy.normalized(policy)
	if not error.is_empty():return _reject(error,current)
	if current.project_evidence.size()>=MAX_EVIDENCE or current.project_evidence.has(project_id) 			or not CampaignIdentity.valid(project_id) or not RaceCheckpoint.integral(latent_outcome_bps,-2500,2500):
		return _reject("Engineering evidence seed is invalid or duplicated.",current)
	var record={"project_id":project_id,"latent_outcome_bps":latent_outcome_bps,
		"confidence_bps":int(tuning.initial_confidence_bps),"observations":0,"created_slot":slot,"last_observed_slot":-1}
	_seal(record);var data=current.duplicate(true);data.project_evidence[project_id]=record
	return _result(data,"evidence_registered",current)

static func observe_project(current:Dictionary,project_id:String,slot:int,policy:Dictionary={})->Dictionary:
	var error=validate(current)
	var tuning=CampaignSupplyPolicy.normalized(policy)
	if not error.is_empty():return _reject(error,current)
	if not current.project_evidence.has(project_id):return _reject("Engineering evidence is unknown.",current)
	var data=current.duplicate(true);var record:Dictionary=data.project_evidence[project_id]
	record.observations=int(record.observations)+1
	record.confidence_bps=mini(int(tuning.max_confidence_bps),
		int(record.confidence_bps)+int(tuning.observation_gain_bps))
	record.last_observed_slot=slot;_seal(record);data.project_evidence[project_id]=record
	return _result(data,"observed",current)

static func project_range(current:Dictionary,project_id:String,policy:Dictionary={})->Dictionary:
	if not validate(current).is_empty() or not current.project_evidence.has(project_id):return {}
	var tuning=CampaignSupplyPolicy.normalized(policy)
	var record:Dictionary=current.project_evidence[project_id]
	var spread=maxi(int(tuning.spread_floor_bps),
		int(round(float(tuning.spread_scale_bps)*(10000-int(record.confidence_bps))/10000.0)))
	return {"project_id":project_id,"confidence_bps":record.confidence_bps,
		"low_bps":int(record.latent_outcome_bps)-spread,
		"high_bps":int(record.latent_outcome_bps)+spread,
		"observations":record.observations}

static func register_part(current:Dictionary,part_id:String,slot:int)->Dictionary:
	var error=validate(current)
	if not error.is_empty():return _reject(error,current)
	if current.part_service.size()>=MAX_PARTS or current.part_service.has(part_id) or not CampaignIdentity.valid(part_id):
		return _reject("Part service record is invalid or duplicated.",current)
	var record={"part_id":part_id,"condition":100,"wear_events":0,"repairs":0,
		"created_slot":slot,"last_change_slot":slot}
	_seal(record);var data=current.duplicate(true);data.part_service[part_id]=record
	return _result(data,"part_registered",current)

static func wear_part(current:Dictionary,part_id:String,wear:int,slot:int)->Dictionary:
	var error=validate(current)
	if not error.is_empty():return _reject(error,current)
	if not current.part_service.has(part_id) or not RaceCheckpoint.integral(wear,1,100):
		return _reject("Part wear request is invalid.",current)
	var data=current.duplicate(true);var record:Dictionary=data.part_service[part_id]
	record.condition=maxi(0,int(record.condition)-wear);record.wear_events=int(record.wear_events)+1;record.last_change_slot=slot
	_seal(record);data.part_service[part_id]=record;_history(data,"part_wear",part_id,slot,wear)
	return _result(data,"part_worn",current)

static func repair_part(current:Dictionary,part_id:String,slot:int)->Dictionary:
	var error=validate(current)
	if not error.is_empty():return _reject(error,current)
	if not current.part_service.has(part_id) or int(current.part_service[part_id].condition)>=100:
		return _reject("Part does not require a recorded repair.",current)
	var data=current.duplicate(true);var record:Dictionary=data.part_service[part_id]
	record.condition=100;record.repairs=int(record.repairs)+1;record.last_change_slot=slot
	_seal(record);data.part_service[part_id]=record;_history(data,"part_repair",part_id,slot,1)
	return _result(data,"part_repaired",current)

static func validate(data:Variant)->String:
	if not data is Dictionary or data.size()!=6 or not data.get("suppliers") is Dictionary or data.suppliers.size()>MAX_SUPPLIERS 			or not data.get("orders") is Dictionary or data.orders.size()>MAX_ORDERS 			or not data.get("materials") is Dictionary or data.materials.size()>MAX_MATERIALS 			or not data.get("project_evidence") is Dictionary or data.project_evidence.size()>MAX_EVIDENCE 			or not data.get("part_service") is Dictionary or data.part_service.size()>MAX_PARTS 			or not data.get("history") is Array or data.history.size()>MAX_HISTORY:
		return "Campaign supply projection is invalid."
	for id in data.suppliers:
		if id!=data.suppliers[id].get("id") or not _supplier_error(data.suppliers[id]).is_empty():return "Campaign supplier registry is invalid."
	for id in data.orders:
		if id!=data.orders[id].get("id") or not data.suppliers.has(data.orders[id].get("supplier_id")) or not _order_error(data.orders[id]).is_empty():return "Campaign procurement registry is invalid."
	var rebuilt={}
	for order in data.orders.values():
		if order.status=="received":
			var row:Dictionary=rebuilt.get(order.material_id,{"material_id":order.material_id,"quantity":0,"received_units":0,"consumed_units":0})
			row.quantity=int(row.quantity)+int(order.quantity);row.received_units=int(row.received_units)+int(order.quantity);rebuilt[order.material_id]=row
	for history in data.history:
		if not _history_error(history).is_empty():return "Campaign supply history is invalid."
		if history.kind=="consumed":
			if not rebuilt.has(history.material_or_source_id):continue
			var row:Dictionary=rebuilt[history.material_or_source_id];row.quantity=int(row.quantity)-int(history.quantity);row.consumed_units=int(row.consumed_units)+int(history.quantity);rebuilt[history.material_or_source_id]=row
	for material_id in data.materials:
		var stock=data.materials[material_id]
		if material_id!=stock.get("material_id") or not RaceCheckpoint.integral(stock.get("quantity"),0,100000000) 				or not RaceCheckpoint.integral(stock.get("received_units"),0,100000000) or not RaceCheckpoint.integral(stock.get("consumed_units"),0,100000000):
			return "Campaign material stock is invalid."
	if RaceStateValue.fingerprint(rebuilt)!=RaceStateValue.fingerprint(data.materials):
		return "Campaign material stock does not conserve received and consumed units."
	for id in data.project_evidence:
		if id!=data.project_evidence[id].get("project_id") or not _evidence_error(data.project_evidence[id]).is_empty():return "Campaign engineering evidence is invalid."
	for id in data.part_service:
		if id!=data.part_service[id].get("part_id") or not _part_error(data.part_service[id]).is_empty():return "Campaign part service registry is invalid."
	return ""

static func _supplier_error(d:Variant)->String:
	if not d is Dictionary or d.size()!=9:return "shape"
	for key in ["id","material_id"]:
		if not CampaignIdentity.valid(d.get(key)):return "identity"
	if not d.get("display_name") is String or d.display_name.is_empty() or d.display_name.length()>100:return "name"
	if not RaceCheckpoint.integral(d.get("unit_price_minor"),1,CampaignEconomy.MAX_MINOR) or not RaceCheckpoint.integral(d.get("lead_slots"),1,CampaignClock.SLOTS_PER_DAY*90) 			or not RaceCheckpoint.integral(d.get("capacity_units"),1,1000000) or not RaceCheckpoint.integral(d.get("reliability_bps"),0,10000) 			or not RaceCheckpoint.integral(d.get("created_slot"),0,CampaignClock.MAX_ELAPSED_SLOTS):return "terms"
	return _digest_error(d)

static func _order_error(d:Variant)->String:
	if not d is Dictionary or d.size()!=11:return "shape"
	for key in ["id","supplier_id","material_id","commitment_id"]:
		if not CampaignIdentity.valid(d.get(key)):return "identity"
	if not RaceCheckpoint.integral(d.get("quantity"),1,1000000) or not RaceCheckpoint.integral(d.get("ordered_slot"),0,CampaignClock.MAX_ELAPSED_SLOTS) 			or not RaceCheckpoint.integral(d.get("due_slot"),int(d.ordered_slot)+1,CampaignClock.MAX_ELAPSED_SLOTS) or not RaceCheckpoint.integral(d.get("amount_minor"),1,CampaignEconomy.MAX_MINOR) 			or d.get("status") not in ORDER_STATES or not RaceCheckpoint.integral(d.get("received_slot"),-1,CampaignClock.MAX_ELAPSED_SLOTS):return "terms"
	if d.status=="ordered" and int(d.received_slot)!=-1:return "open order received"
	if d.status=="received" and int(d.received_slot)<int(d.due_slot):return "early receipt"
	return _digest_error(d)

static func _evidence_error(d:Variant)->String:
	if not d is Dictionary or d.size()!=7 or not CampaignIdentity.valid(d.get("project_id")) 			or not RaceCheckpoint.integral(d.get("latent_outcome_bps"),-2500,2500) or not RaceCheckpoint.integral(d.get("confidence_bps"),0,10000) 			or not RaceCheckpoint.integral(d.get("observations"),0,100) or not RaceCheckpoint.integral(d.get("created_slot"),0,CampaignClock.MAX_ELAPSED_SLOTS) 			or not RaceCheckpoint.integral(d.get("last_observed_slot"),-1,CampaignClock.MAX_ELAPSED_SLOTS):return "evidence"
	return _digest_error(d)

static func _part_error(d:Variant)->String:
	if not d is Dictionary or d.size()!=7 or not CampaignIdentity.valid(d.get("part_id")) 			or not RaceCheckpoint.integral(d.get("condition"),0,100) or not RaceCheckpoint.integral(d.get("wear_events"),0,100000) 			or not RaceCheckpoint.integral(d.get("repairs"),0,100000) or not RaceCheckpoint.integral(d.get("created_slot"),0,CampaignClock.MAX_ELAPSED_SLOTS) 			or not RaceCheckpoint.integral(d.get("last_change_slot"),int(d.created_slot),CampaignClock.MAX_ELAPSED_SLOTS):return "part"
	return _digest_error(d)

static func _history(data:Dictionary,kind:String,source:String,slot:int,quantity:int)->void:
	var material=source
	if kind=="consumed":
		material=source
	var row={"id":"supplyhistory."+RaceStateValue.fingerprint([kind,source,slot,data.history.size()]).substr(0,24),
		"kind":kind,"material_or_source_id":material,"slot":slot,"quantity":quantity}
	row["digest"]=RaceStateValue.fingerprint(row);data.history.append(row)

static func _history_error(d:Variant)->String:
	if not d is Dictionary or d.size()!=6 or not CampaignIdentity.valid(d.get("id")) or d.get("kind") not in ["received","consumed","part_wear","part_repair"] 			or not CampaignIdentity.valid(d.get("material_or_source_id")) or not RaceCheckpoint.integral(d.get("slot"),0,CampaignClock.MAX_ELAPSED_SLOTS) 			or not RaceCheckpoint.integral(d.get("quantity"),1,100000000):return "history"
	return _digest_error(d)

static func _result(data:Dictionary,status:String,current:Dictionary)->Dictionary:
	var error=validate(data);return {"ok":error.is_empty(),"status":status if error.is_empty() else "rejected","error":error,
		"supply":data if error.is_empty() else current.duplicate(true)}
static func _reject(message:String,current:Dictionary)->Dictionary:return {"ok":false,"status":"rejected","error":message,"supply":current.duplicate(true)}
static func _digest_error(d:Dictionary)->String:
	var content=d.duplicate(true);content.erase("digest");return "" if CampaignIdentity.valid_hash(d.get("digest")) and d.digest==RaceStateValue.fingerprint(content) else "digest"
static func _seal(d:Dictionary)->void:d.erase("digest");d["digest"]=RaceStateValue.fingerprint(d)
