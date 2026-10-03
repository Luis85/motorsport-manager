class_name CampaignSupplyValidation
extends RefCounted
## Pure validation of detached campaign records.
const MAX_SUPPLIERS = CampaignSupplyNetwork.MAX_SUPPLIERS
const MAX_ORDERS = CampaignSupplyNetwork.MAX_ORDERS
const MAX_MATERIALS = CampaignSupplyNetwork.MAX_MATERIALS
const MAX_EVIDENCE = CampaignSupplyNetwork.MAX_EVIDENCE
const MAX_PARTS = CampaignSupplyNetwork.MAX_PARTS
const MAX_HISTORY = CampaignSupplyNetwork.MAX_HISTORY
const ORDER_STATES = CampaignSupplyNetwork.ORDER_STATES


static func validate(data: Variant) -> String:
	if (
		not data is Dictionary
		or data.size() != 6
		or not data.get("suppliers") is Dictionary
		or data.suppliers.size() > MAX_SUPPLIERS
		or not data.get("orders") is Dictionary
		or data.orders.size() > MAX_ORDERS
		or not data.get("materials") is Dictionary
		or data.materials.size() > MAX_MATERIALS
		or not data.get("project_evidence") is Dictionary
		or data.project_evidence.size() > MAX_EVIDENCE
		or not data.get("part_service") is Dictionary
		or data.part_service.size() > MAX_PARTS
		or not data.get("history") is Array
		or data.history.size() > MAX_HISTORY
	):
		return "Campaign supply projection is invalid."
	for id in data.suppliers:
		if (
			not data.suppliers[id] is Dictionary
			or id != data.suppliers[id].get("id")
			or not _supplier_error(data.suppliers[id]).is_empty()
		):
			return "Campaign supplier registry is invalid."
	for id in data.orders:
		if (
			not data.orders[id] is Dictionary
			or id != data.orders[id].get("id")
			or not data.suppliers.has(data.orders[id].get("supplier_id"))
			or not _order_error(data.orders[id]).is_empty()
		):
			return "Campaign procurement registry is invalid."
	var material_error = _material_error(data)
	if not material_error.is_empty():
		return material_error
	for id in data.project_evidence:
		if (
			not data.project_evidence[id] is Dictionary
			or id != data.project_evidence[id].get("project_id")
			or not _evidence_error(data.project_evidence[id]).is_empty()
		):
			return "Campaign engineering evidence is invalid."
	for id in data.part_service:
		if (
			not data.part_service[id] is Dictionary
			or id != data.part_service[id].get("part_id")
			or not _part_error(data.part_service[id]).is_empty()
		):
			return "Campaign part service registry is invalid."
	return ""


static func _supplier_error(d: Variant) -> String:
	if not d is Dictionary or d.size() != 9:
		return "shape"
	for key in ["id", "material_id"]:
		if not CampaignIdentity.valid(d.get(key)):
			return "identity"
	if (
		not d.get("display_name") is String
		or d.display_name.is_empty()
		or d.display_name.length() > 100
	):
		return "name"
	if (
		not RaceCheckpoint.integral(d.get("unit_price_minor"), 1, CampaignEconomy.MAX_MINOR)
		or not RaceCheckpoint.integral(d.get("lead_slots"), 1, CampaignClock.SLOTS_PER_DAY * 90)
		or not RaceCheckpoint.integral(d.get("capacity_units"), 1, 1000000)
		or not RaceCheckpoint.integral(d.get("reliability_bps"), 0, 10000)
		or not RaceCheckpoint.integral(d.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
	):
		return "terms"
	return _digest_error(d)


static func _order_error(d: Variant) -> String:
	if not d is Dictionary or d.size() != 11:
		return "shape"
	for key in ["id", "supplier_id", "material_id", "commitment_id"]:
		if not CampaignIdentity.valid(d.get(key)):
			return "identity"
	if (
		not RaceCheckpoint.integral(d.get("quantity"), 1, 1000000)
		or not RaceCheckpoint.integral(d.get("ordered_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
		or not RaceCheckpoint.integral(
			d.get("due_slot"), int(d.ordered_slot) + 1, CampaignClock.MAX_ELAPSED_SLOTS
		)
		or not RaceCheckpoint.integral(d.get("amount_minor"), 1, CampaignEconomy.MAX_MINOR)
		or d.get("status") not in ORDER_STATES
		or not RaceCheckpoint.integral(d.get("received_slot"), -1, CampaignClock.MAX_ELAPSED_SLOTS)
	):
		return "terms"
	if d.status == "ordered" and int(d.received_slot) != -1:
		return "open order received"
	if d.status == "received" and int(d.received_slot) < int(d.due_slot):
		return "early receipt"
	return _digest_error(d)


static func _evidence_error(d: Variant) -> String:
	if (
		not d is Dictionary
		or d.size() != 7
		or not CampaignIdentity.valid(d.get("project_id"))
		or not RaceCheckpoint.integral(d.get("latent_outcome_bps"), -2500, 2500)
		or not RaceCheckpoint.integral(d.get("confidence_bps"), 0, 10000)
		or not RaceCheckpoint.integral(d.get("observations"), 0, 100)
		or not RaceCheckpoint.integral(d.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
		or not RaceCheckpoint.integral(
			d.get("last_observed_slot"), -1, CampaignClock.MAX_ELAPSED_SLOTS
		)
	):
		return "evidence"
	return _digest_error(d)


static func _part_error(d: Variant) -> String:
	if (
		not d is Dictionary
		or d.size() != 7
		or not CampaignIdentity.valid(d.get("part_id"))
		or not RaceCheckpoint.integral(d.get("condition"), 0, 100)
		or not RaceCheckpoint.integral(d.get("wear_events"), 0, 100000)
		or not RaceCheckpoint.integral(d.get("repairs"), 0, 100000)
		or not RaceCheckpoint.integral(d.get("created_slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
		or not RaceCheckpoint.integral(
			d.get("last_change_slot"), int(d.created_slot), CampaignClock.MAX_ELAPSED_SLOTS
		)
	):
		return "part"
	return _digest_error(d)


static func _history_error(d: Variant) -> String:
	if (
		not d is Dictionary
		or d.size() != 6
		or not CampaignIdentity.valid(d.get("id"))
		or d.get("kind") not in ["received", "consumed", "part_wear", "part_repair"]
		or not CampaignIdentity.valid(d.get("material_or_source_id"))
		or not RaceCheckpoint.integral(d.get("slot"), 0, CampaignClock.MAX_ELAPSED_SLOTS)
		or not RaceCheckpoint.integral(d.get("quantity"), 1, 100000000)
	):
		return "history"
	return _digest_error(d)


static func _digest_error(d: Dictionary) -> String:
	var content = d.duplicate(true)
	content.erase("digest")
	return (
		""
		if (
			CampaignIdentity.valid_hash(d.get("digest"))
			and d.digest == RaceStateValue.fingerprint(content)
		)
		else "digest"
	)


static func _material_error(data: Dictionary) -> String:
	var rebuilt = {}
	for order in data.orders.values():
		if order.status == "received":
			var row: Dictionary = rebuilt.get(
				order.material_id,
				{
					"material_id": order.material_id,
					"quantity": 0,
					"received_units": 0,
					"consumed_units": 0
				}
			)
			row.quantity = int(row.quantity) + int(order.quantity)
			row.received_units = int(row.received_units) + int(order.quantity)
			rebuilt[order.material_id] = row
	for history in data.history:
		if not _history_error(history).is_empty():
			return "Campaign supply history is invalid."
		if history.kind == "consumed":
			if not rebuilt.has(history.material_or_source_id):
				continue
			var row: Dictionary = rebuilt[history.material_or_source_id]
			row.quantity = int(row.quantity) - int(history.quantity)
			row.consumed_units = int(row.consumed_units) + int(history.quantity)
			rebuilt[history.material_or_source_id] = row
	for material_id in data.materials:
		var stock = data.materials[material_id]
		if (
			not stock is Dictionary
			or material_id != stock.get("material_id")
			or not RaceCheckpoint.integral(stock.get("quantity"), 0, 100000000)
			or not RaceCheckpoint.integral(stock.get("received_units"), 0, 100000000)
			or not RaceCheckpoint.integral(stock.get("consumed_units"), 0, 100000000)
		):
			return "Campaign material stock is invalid."
	if RaceStateValue.fingerprint(rebuilt) != RaceStateValue.fingerprint(data.materials):
		return "Campaign material stock does not conserve received and consumed units."
	return ""
