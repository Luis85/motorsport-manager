class_name CampaignGroup
extends RefCounted
## Founder business, academy, era profiles and dynasty milestones. No daily-login loop.
const MAX_ORDERS=512
const MAX_TRANSFERS=512
const MAX_PROSPECTS=64
const MAX_ERAS=16
const MAX_SUCCESSIONS=32
const MAX_GOALS=64
const ERA_CAPABILITIES=["craft","specialists","commercial","data","regulated"]

static func empty()->Dictionary:
	return {"initialized":false,"founder_id":"","opening_parent_cash_minor":0,"parent_cash_minor":0,"business_orders":{},
		"transfers":[],"academy":{"capacity":0,"prospects":{}},"eras":{},"active_era_id":"",
		"dynasty":{"operating_principal_id":"","successions":[],"legacy_goals":{}}}

static func initialize(current:Dictionary,founder_id:String,parent_cash_minor:int,era:Dictionary,slot:int)->Dictionary:
	if not validate(current).is_empty() or current.initialized or not CampaignIdentity.valid(founder_id) 			or not RaceCheckpoint.integral(parent_cash_minor,0,CampaignEconomy.MAX_MINOR):return _reject("Campaign group initialization is invalid.",current)
	var profile=_era(era,slot);if profile.is_empty():return _reject("Initial era profile is invalid.",current)
	var data=current.duplicate(true);data.initialized=true;data.founder_id=founder_id;data.opening_parent_cash_minor=parent_cash_minor;data.parent_cash_minor=parent_cash_minor
	data.eras[profile.id]=profile;data.active_era_id=profile.id;data.dynasty.operating_principal_id=founder_id
	return _result(data,"initialized",current)

static func create_business_order(current:Dictionary,input:Dictionary,slot:int)->Dictionary:
	var error=validate(current);if not error.is_empty():return _reject(error,current)
	if not current.initialized or current.business_orders.size()>=MAX_ORDERS:return _reject("Founder business is unavailable or full.",current)
	var order={"id":input.get("id"),"customer":input.get("customer"),"work_order_id":input.get("work_order_id"),
		"value_minor":input.get("value_minor"),"created_slot":slot,"due_slot":input.get("due_slot"),
		"status":"open","completed_slot":-1}
	_seal(order)
	if not _business_order_error(order).is_empty() or current.business_orders.has(order.get("id")):return _reject("Founder business order is invalid or duplicated.",current)
	var data=current.duplicate(true);data.business_orders[order.id]=order
	return _result(data,"business_order_created",current)

static func complete_business_order(current:Dictionary,order_id:String,slot:int)->Dictionary:
	var error=validate(current);if not error.is_empty():return _reject(error,current)
	if not current.business_orders.has(order_id):return _reject("Founder business order is unknown.",current)
	var order:Dictionary=current.business_orders[order_id]
	if order.status!="open" or slot<int(order.due_slot):return _reject("Founder business order is not ready to complete.",current)
	var data=current.duplicate(true);order=order.duplicate(true);order.status="completed";order.completed_slot=slot;_seal(order)
	data.business_orders[order_id]=order;data.parent_cash_minor=int(data.parent_cash_minor)+int(order.value_minor)
	return _result(data,"business_order_completed",current)

static func transfer_to_team(current:Dictionary,input:Dictionary,slot:int)->Dictionary:
	var error=validate(current);if not error.is_empty():return _reject(error,current)
	var amount=input.get("amount_minor")
	if current.transfers.size()>=MAX_TRANSFERS or not RaceCheckpoint.integral(amount,1,CampaignEconomy.MAX_MINOR) or int(amount)>int(current.parent_cash_minor):return _reject("Parent-to-team transfer exceeds available parent cash.",current)
	var id=input.get("id");if not CampaignIdentity.valid(id):return _reject("Parent-to-team transfer identity is invalid.",current)
	for prior in current.transfers:
		if prior.id==id:return _reject("Parent-to-team transfer is duplicated.",current)
	var commitment_id="ownertransfer."+RaceStateValue.fingerprint([id,slot]).substr(0,24)
	var row={"id":id,"slot":slot,"amount_minor":int(amount),"commitment_id":commitment_id};_seal(row)
	var data=current.duplicate(true);data.parent_cash_minor=int(data.parent_cash_minor)-int(amount);data.transfers.append(row)
	var result=_result(data,"transferred",current)
	if result.ok:result["commitment_input"]={"id":commitment_id,"source_id":id,"due_slot":slot,"amount_minor":int(amount),"category":"owner_transfer"}
	return result

static func set_academy_capacity(current:Dictionary,capacity:int)->Dictionary:
	var error=validate(current);if not error.is_empty():return _reject(error,current)
	if not RaceCheckpoint.integral(capacity,0,MAX_PROSPECTS) or capacity<current.academy.prospects.size():return _reject("Academy capacity is invalid.",current)
	var data=current.duplicate(true);data.academy.capacity=capacity;return _result(data,"academy_capacity_set",current)

static func add_academy_prospect(current:Dictionary,candidate_id:String,slot:int)->Dictionary:
	var error=validate(current);if not error.is_empty():return _reject(error,current)
	if current.academy.prospects.size()>=int(current.academy.capacity) or current.academy.prospects.has(candidate_id) or not CampaignIdentity.valid(candidate_id):return _reject("Academy has no place or prospect is duplicated.",current)
	var data=current.duplicate(true);var row={"candidate_id":candidate_id,"joined_slot":slot,"status":"developing"};_seal(row);data.academy.prospects[candidate_id]=row
	return _result(data,"academy_prospect_added",current)

static func register_era(current:Dictionary,input:Dictionary,slot:int)->Dictionary:
	var error=validate(current);if not error.is_empty():return _reject(error,current)
	if current.eras.size()>=MAX_ERAS:return _reject("Era profile registry is full.",current)
	var profile=_era(input,slot)
	if profile.is_empty() or current.eras.has(profile.get("id")):return _reject("Era profile is invalid or duplicated.",current)
	var data=current.duplicate(true);data.eras[profile.id]=profile;return _result(data,"era_registered",current)

static func activate_era(current:Dictionary,era_id:String,slot:int)->Dictionary:
	var error=validate(current);if not error.is_empty():return _reject(error,current)
	if not current.eras.has(era_id) or current.active_era_id==era_id:return _reject("Era transition is unavailable.",current)
	var data=current.duplicate(true);data.active_era_id=era_id
	var goal_id="era."+era_id
	if not data.dynasty.legacy_goals.has(goal_id):
		var goal={"id":goal_id,"title":"Progress into "+data.eras[era_id].display_name,"status":"completed","created_slot":slot,"completed_slot":slot,"evidence_id":era_id};_seal(goal);data.dynasty.legacy_goals[goal_id]=goal
	return _result(data,"era_activated",current)

static func appoint_successor(current:Dictionary,person_id:String,slot:int)->Dictionary:
	var error=validate(current);if not error.is_empty():return _reject(error,current)
	if not CampaignIdentity.valid(person_id) or person_id==current.dynasty.operating_principal_id or current.dynasty.successions.size()>=MAX_SUCCESSIONS:return _reject("Succession choice is invalid.",current)
	var data=current.duplicate(true);var row={"id":"succession."+RaceStateValue.fingerprint([person_id,slot]).substr(0,24),
		"from_person_id":data.dynasty.operating_principal_id,"to_person_id":person_id,"slot":slot};_seal(row)
	data.dynasty.successions.append(row);data.dynasty.operating_principal_id=person_id
	return _result(data,"successor_appointed",current)

static func add_legacy_goal(current:Dictionary,input:Dictionary,slot:int)->Dictionary:
	var error=validate(current);if not error.is_empty():return _reject(error,current)
	if current.dynasty.legacy_goals.size()>=MAX_GOALS:return _reject("Legacy goal registry is full.",current)
	var goal={"id":input.get("id"),"title":input.get("title"),"status":"active","created_slot":slot,"completed_slot":-1,"evidence_id":input.get("evidence_id","")};_seal(goal)
	if not _goal_error(goal).is_empty() or current.dynasty.legacy_goals.has(goal.get("id")):return _reject("Legacy goal is invalid or duplicated.",current)
	var data=current.duplicate(true);data.dynasty.legacy_goals[goal.id]=goal;return _result(data,"legacy_goal_added",current)

static func complete_legacy_goal(current:Dictionary,goal_id:String,evidence_id:String,slot:int)->Dictionary:
	var error=validate(current);if not error.is_empty():return _reject(error,current)
	if not current.dynasty.legacy_goals.has(goal_id) or current.dynasty.legacy_goals[goal_id].status!="active" or not CampaignIdentity.valid(evidence_id):return _reject("Legacy goal completion is invalid.",current)
	var data=current.duplicate(true);var goal:Dictionary=data.dynasty.legacy_goals[goal_id];goal.status="completed";goal.completed_slot=slot;goal.evidence_id=evidence_id;_seal(goal);data.dynasty.legacy_goals[goal_id]=goal
	return _result(data,"legacy_goal_completed",current)

static func validate(data:Variant)->String:
	if not data is Dictionary or data.size()!=9 or not data.get("initialized") is bool or not data.get("founder_id") is String 			or not RaceCheckpoint.integral(data.get("parent_cash_minor"),0,CampaignEconomy.MAX_MINOR) 			or not data.get("business_orders") is Dictionary or data.business_orders.size()>MAX_ORDERS 			or not data.get("transfers") is Array or data.transfers.size()>MAX_TRANSFERS 			or not data.get("academy") is Dictionary or data.academy.size()!=2 			or not data.get("eras") is Dictionary or data.eras.size()>MAX_ERAS 			or not data.get("active_era_id") is String or not data.get("dynasty") is Dictionary:return "Campaign group projection is invalid."
	if data.initialized:
		if not CampaignIdentity.valid(data.founder_id) or not data.eras.has(data.active_era_id) or not CampaignIdentity.valid(data.dynasty.get("operating_principal_id")):return "Campaign group initialization is invalid."
	elif not data.founder_id.is_empty() or not data.active_era_id.is_empty():return "Uninitialized campaign group has identity."
	for id in data.business_orders:
		if id!=data.business_orders[id].get("id") or not _business_order_error(data.business_orders[id]).is_empty():return "Campaign founder-business order is invalid."
	var transfer_ids={}
	for row in data.transfers:
		if not _transfer_error(row).is_empty() or transfer_ids.has(row.id):return "Campaign group transfer history is invalid."
		transfer_ids[row.id]=true
	if not RaceCheckpoint.integral(data.academy.get("capacity"),0,MAX_PROSPECTS) or not data.academy.get("prospects") is Dictionary or data.academy.prospects.size()>int(data.academy.capacity):return "Campaign academy is invalid."
	for id in data.academy.prospects:
		if id!=data.academy.prospects[id].get("candidate_id") or not _prospect_error(data.academy.prospects[id]).is_empty():return "Campaign academy prospect is invalid."
	for id in data.eras:
		if id!=data.eras[id].get("id") or not _era_error(data.eras[id]).is_empty():return "Campaign era registry is invalid."
	if data.dynasty.size()!=3 or not data.dynasty.get("successions") is Array or data.dynasty.successions.size()>MAX_SUCCESSIONS or not data.dynasty.get("legacy_goals") is Dictionary or data.dynasty.legacy_goals.size()>MAX_GOALS:return "Campaign dynasty projection is invalid."
	for row in data.dynasty.successions:
		if not _succession_error(row).is_empty():return "Campaign succession history is invalid."
	for id in data.dynasty.legacy_goals:
		if id!=data.dynasty.legacy_goals[id].get("id") or not _goal_error(data.dynasty.legacy_goals[id]).is_empty():return "Campaign legacy goal registry is invalid."
	return ""

static func _era(input:Dictionary,slot:int)->Dictionary:
	var data={"id":input.get("id"),"display_name":input.get("display_name"),"start_year":input.get("start_year"),"capabilities":input.get("capabilities",[]).duplicate(true),"created_slot":slot};_seal(data);return data if _era_error(data).is_empty() else {}
static func _era_error(d:Variant)->String:
	if not d is Dictionary or d.size()!=6 or not CampaignIdentity.valid(d.get("id")) or not d.get("display_name") is String or d.display_name.is_empty() or not RaceCheckpoint.integral(d.get("start_year"),1900,2200) or not d.get("capabilities") is Array:return "era"
	var seen={}
	for cap in d.capabilities:
		if cap not in ERA_CAPABILITIES or seen.has(cap): return "era cap"
		seen[cap]=true
	return _digest_error(d)
static func _business_order_error(d:Variant)->String:
	if not d is Dictionary or d.size()!=9 or not CampaignIdentity.valid(d.get("id")) or not d.get("customer") is String or d.customer.is_empty() or not CampaignIdentity.valid(d.get("work_order_id")) or not RaceCheckpoint.integral(d.get("value_minor"),1,CampaignEconomy.MAX_MINOR) or not RaceCheckpoint.integral(d.get("created_slot"),0,CampaignClock.MAX_ELAPSED_SLOTS) or not RaceCheckpoint.integral(d.get("due_slot"),int(d.created_slot),CampaignClock.MAX_ELAPSED_SLOTS) or d.get("status") not in ["open","completed"] or not RaceCheckpoint.integral(d.get("completed_slot"),-1,CampaignClock.MAX_ELAPSED_SLOTS):return "order"
	if d.status=="open" and int(d.completed_slot)!=-1:return "open completed"
	if d.status=="completed" and int(d.completed_slot)<int(d.due_slot):return "early completion"
	return _digest_error(d)
static func _transfer_error(d:Variant)->String:
	if not d is Dictionary or d.size()!=5 or not CampaignIdentity.valid(d.get("id")) or not CampaignIdentity.valid(d.get("commitment_id")) or not RaceCheckpoint.integral(d.get("slot"),0,CampaignClock.MAX_ELAPSED_SLOTS) or not RaceCheckpoint.integral(d.get("amount_minor"),1,CampaignEconomy.MAX_MINOR):return "transfer"
	return _digest_error(d)
static func _prospect_error(d:Variant)->String:
	if not d is Dictionary or d.size()!=4 or not CampaignIdentity.valid(d.get("candidate_id")) or not RaceCheckpoint.integral(d.get("joined_slot"),0,CampaignClock.MAX_ELAPSED_SLOTS) or d.get("status")!="developing":return "prospect"
	return _digest_error(d)
static func _succession_error(d:Variant)->String:
	if not d is Dictionary or d.size()!=5:return "succession"
	for key in ["id","from_person_id","to_person_id"]:
		if not CampaignIdentity.valid(d.get(key)):return "succession id"
	if not RaceCheckpoint.integral(d.get("slot"),0,CampaignClock.MAX_ELAPSED_SLOTS):return "succession slot"
	return _digest_error(d)
static func _goal_error(d:Variant)->String:
	if not d is Dictionary or d.size()!=7 or not CampaignIdentity.valid(d.get("id")) or not d.get("title") is String or d.title.is_empty() or d.get("status") not in ["active","completed"] or not RaceCheckpoint.integral(d.get("created_slot"),0,CampaignClock.MAX_ELAPSED_SLOTS) or not RaceCheckpoint.integral(d.get("completed_slot"),-1,CampaignClock.MAX_ELAPSED_SLOTS) or not d.get("evidence_id") is String:return "goal"
	if d.status=="active" and int(d.completed_slot)!=-1:return "active goal complete"
	if d.status=="completed" and (int(d.completed_slot)<int(d.created_slot) or not CampaignIdentity.valid(d.evidence_id)):return "goal completion"
	return _digest_error(d)
static func _result(data:Dictionary,status:String,current:Dictionary)->Dictionary:
	var error=validate(data);return {"ok":error.is_empty(),"status":status if error.is_empty() else "rejected","error":error,"group":data if error.is_empty() else current.duplicate(true)}
static func _reject(message:String,current:Dictionary)->Dictionary:return {"ok":false,"status":"rejected","error":message,"group":current.duplicate(true)}
static func _digest_error(d:Dictionary)->String:
	var x=d.duplicate(true);x.erase("digest");return "" if CampaignIdentity.valid_hash(d.get("digest")) and d.digest==RaceStateValue.fingerprint(x) else "digest"
static func _seal(d:Dictionary)->void:d.erase("digest");d["digest"]=RaceStateValue.fingerprint(d)
