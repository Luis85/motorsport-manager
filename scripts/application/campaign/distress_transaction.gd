class_name CampaignDistressTransaction
extends RefCounted
static func evaluate(checkpoint:Dictionary)->Dictionary:
	var r=_restore(checkpoint)
	if not r.ok:return r
	var horizon=mini(CampaignClock.MAX_ELAPSED_SLOTS,r.state.clock.elapsed_slots+30*CampaignClock.SLOTS_PER_DAY)
	var f=CampaignFinanceQuery.cash_forecast(checkpoint,r.state.organization_id,horizon)
	if not f.ok:return _reject(f.error,checkpoint)
	var account:Dictionary=r.economy.accounts[r.state.organization_id]
	var changed=CampaignDistress.evaluate(r.management.distress,int(account.cash_minor),
		int(f.forecast.scenarios.committed.minimum_cash_minor),int(f.forecast.reserve_minor),r.state.clock.elapsed_slots)
	return _publish(r,changed,r.economy,checkpoint)
static func bridge_financing(checkpoint:Dictionary,amount_minor:int)->Dictionary:
	var r=_restore(checkpoint)
	if not r.ok:return r
	if not RaceCheckpoint.integral(amount_minor,1,CampaignEconomy.MAX_MINOR/2):return _reject("Bridge amount is invalid.",checkpoint)
	var slot=r.state.clock.elapsed_slots;var economy=r.economy
	for input in [
		{"id":"bridge.receipt."+str(slot),"account_id":r.state.organization_id,"source_id":"bridge."+str(slot),"due_slot":slot,"amount_minor":amount_minor,"category":"financing"},
		{"id":"bridge.repayment."+str(slot),"account_id":r.state.organization_id,"source_id":"bridge."+str(slot),"due_slot":mini(CampaignClock.MAX_ELAPSED_SLOTS,slot+30*CampaignClock.SLOTS_PER_DAY),"amount_minor":-int(round(amount_minor*1.10)),"category":"financing"}]:
		var a=CampaignEconomy.add_commitment(economy,input,slot)
		if not a.ok: return _reject(a.error,checkpoint)
		economy=a.economy
	var settled=CampaignEconomy.settle_due(economy,slot)
	if not settled.ok:return _reject(settled.error,checkpoint)
	var changed=CampaignDistress.record_recovery(r.management.distress,"bridge_financing",amount_minor,slot)
	return _publish(r,changed,settled.economy,checkpoint)
static func _restore(checkpoint:Dictionary)->Dictionary:
	var r=CampaignCheckpoint.restore(checkpoint)
	if not r.ok:return _reject(r.error,checkpoint)
	if not r.active_manifest.is_empty():
		return _reject("Financial distress actions are frozen while a campaign weekend is active.",checkpoint)
	return r
static func _publish(r:Dictionary,changed:Dictionary,economy:Dictionary,original:Dictionary)->Dictionary:
	if not changed.ok:return _reject(changed.error,original)
	var m=CampaignManagement.with_distress(r.management,changed.distress)
	if m.is_empty():return _reject("Distress state could not update management authority.",original)
	var c=CampaignCheckpoint.build(r.state,r.settlements,r.active_manifest,r.competition,economy,r.inventory,r.personnel,r.operations,r.engineering,m)
	return {"ok":not c.is_empty(),"status":changed.status if not c.is_empty() else "rejected","error":"" if not c.is_empty() else "Distress change could not form a valid checkpoint.","checkpoint":c if not c.is_empty() else original.duplicate(true)}
static func _reject(message:String,checkpoint:Dictionary)->Dictionary:return {"ok":false,"status":"rejected","error":message,"checkpoint":checkpoint.duplicate(true)}
