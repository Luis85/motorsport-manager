class_name CampaignDistress
extends RefCounted
## Explicit financial pressure and recovery history. It never invents a bailout.
const STAGES=["normal","reserve_pressure","funding_gap","missed_obligation"]
const ACTIONS=["defer_optional","bridge_financing","asset_sale","lower_ambition"]
const MAX_HISTORY=256
static func empty()->Dictionary:return {"stage":"normal","history":[]}
static func evaluate(current:Dictionary,cash_minor:int,minimum_cash_minor:int,reserve_minor:int,slot:int)->Dictionary:
	var error=validate(current);if not error.is_empty():return _reject(error,current)
	var stage="normal"
	if cash_minor<0:stage="missed_obligation"
	elif minimum_cash_minor<0:stage="funding_gap"
	elif minimum_cash_minor<reserve_minor:stage="reserve_pressure"
	var data=current.duplicate(true)
	if stage!=data.stage:
		var row={"id":"distress."+RaceStateValue.fingerprint([stage,slot,data.history.size()]).substr(0,24),
			"stage":stage,"slot":slot,"action":"","amount_minor":0}
		row["digest"]=RaceStateValue.fingerprint(row);data.history.append(row);data.stage=stage
	return _result(data,"evaluated",current)
static func record_recovery(current:Dictionary,action:String,amount_minor:int,slot:int)->Dictionary:
	var error=validate(current);if not error.is_empty():return _reject(error,current)
	if action not in ACTIONS or not RaceCheckpoint.integral(amount_minor,0,CampaignEconomy.MAX_MINOR):return _reject("Distress recovery evidence is invalid.",current)
	var data=current.duplicate(true);var row={"id":"recovery."+RaceStateValue.fingerprint([action,slot,data.history.size()]).substr(0,24),
		"stage":data.stage,"slot":slot,"action":action,"amount_minor":amount_minor}
	row["digest"]=RaceStateValue.fingerprint(row);data.history.append(row)
	return _result(data,"recovery_recorded",current)
static func validate(data:Variant)->String:
	if not data is Dictionary or data.size()!=2 or data.get("stage") not in STAGES or not data.get("history") is Array or data.history.size()>MAX_HISTORY:return "Campaign distress projection is invalid."
	for row in data.history:
		if not row is Dictionary or row.size()!=6 or not CampaignIdentity.valid(row.get("id")) or row.get("stage") not in STAGES 				or not RaceCheckpoint.integral(row.get("slot"),0,CampaignClock.MAX_ELAPSED_SLOTS) or row.get("action") not in [""]+ACTIONS 				or not RaceCheckpoint.integral(row.get("amount_minor"),0,CampaignEconomy.MAX_MINOR):return "Campaign distress history is invalid."
		var content=row.duplicate(true);content.erase("digest")
		if not CampaignIdentity.valid_hash(row.get("digest")) or row.digest!=RaceStateValue.fingerprint(content):return "Campaign distress history integrity check failed."
	return ""
static func _result(data:Dictionary,status:String,current:Dictionary)->Dictionary:
	var error=validate(data);return {"ok":error.is_empty(),"status":status if error.is_empty() else "rejected","error":error,"distress":data if error.is_empty() else current.duplicate(true)}
static func _reject(message:String,current:Dictionary)->Dictionary:return {"ok":false,"status":"rejected","error":message,"distress":current.duplicate(true)}
