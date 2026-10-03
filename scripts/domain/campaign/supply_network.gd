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
	return {
		"suppliers": {},
		"orders": {},
		"materials": {},
		"project_evidence": {},
		"part_service": {},
		"history": []
	}


static func register_supplier(current: Dictionary, input: Dictionary, slot: int) -> Dictionary:
	var error = validate(current)
	if not error.is_empty():
		return _reject(error, current)
	if current.suppliers.size() >= MAX_SUPPLIERS:
		return _reject("Supplier registry is full.", current)
	var supplier = {
		"id": input.get("id"),
		"display_name": input.get("display_name"),
		"material_id": input.get("material_id"),
		"unit_price_minor": input.get("unit_price_minor"),
		"lead_slots": input.get("lead_slots"),
		"capacity_units": input.get("capacity_units"),
		"reliability_bps": input.get("reliability_bps"),
		"created_slot": slot
	}
	_seal(supplier)
	if (
		not CampaignSupplyValidation._supplier_error(supplier).is_empty()
		or current.suppliers.has(supplier.get("id"))
	):
		return _reject("Supplier is invalid or duplicated.", current)
	var data = current.duplicate(true)
	data.suppliers[supplier.id] = supplier
	return _result(data, "supplier_registered", current)


static func order_material(
	current: Dictionary, input: Dictionary, slot: int, account_id: String
) -> Dictionary:
	var error = validate(current)
	if not error.is_empty():
		return _reject(error, current)
	if current.orders.size() >= MAX_ORDERS or not current.suppliers.has(input.get("supplier_id")):
		return _reject("Procurement order is invalid or supplier is unknown.", current)
	var supplier: Dictionary = current.suppliers[input.supplier_id]
	var quantity = input.get("quantity")
	if not RaceCheckpoint.integral(quantity, 1, int(supplier.capacity_units)):
		return _reject("Procurement quantity exceeds reserved supplier capacity.", current)
	var amount = int(quantity) * int(supplier.unit_price_minor)
	if not RaceCheckpoint.integral(amount, 1, CampaignEconomy.MAX_MINOR):
		return _reject("Procurement amount is invalid.", current)
	var order = {
		"id": input.get("id"),
		"supplier_id": supplier.id,
		"material_id": supplier.material_id,
		"quantity": int(quantity),
		"ordered_slot": slot,
		"due_slot": slot + int(supplier.lead_slots),
		"amount_minor": amount,
		"status": "ordered",
		"received_slot": -1,
		"commitment_id":
		"supplier." + RaceStateValue.fingerprint([input.get("id"), supplier.id]).substr(0, 24)
	}
	_seal(order)
	if (
		not CampaignSupplyValidation._order_error(order).is_empty()
		or current.orders.has(order.get("id"))
	):
		return _reject("Procurement order is invalid or duplicated.", current)
	var data = current.duplicate(true)
	data.orders[order.id] = order
	var result = _result(data, "ordered", current)
	if result.ok:
		result["commitment_input"] = {
			"id": order.commitment_id,
			"account_id": account_id,
			"source_id": order.id,
			"due_slot": order.due_slot,
			"amount_minor": -amount,
			"category": "supplier"
		}
	return result


static func receive_order(current: Dictionary, order_id: String, slot: int) -> Dictionary:
	var error = validate(current)
	if not error.is_empty():
		return _reject(error, current)
	if not current.orders.has(order_id):
		return _reject("Procurement order is unknown.", current)
	var order: Dictionary = current.orders[order_id]
	if order.status != "ordered" or slot < int(order.due_slot):
		return _reject("Procurement order has not reached its promised delivery.", current)
	var data = current.duplicate(true)
	order = order.duplicate(true)
	order.status = "received"
	order.received_slot = slot
	_seal(order)
	data.orders[order_id] = order
	var stock: Dictionary = data.materials.get(
		order.material_id,
		{"material_id": order.material_id, "quantity": 0, "received_units": 0, "consumed_units": 0}
	)
	stock.quantity = int(stock.quantity) + int(order.quantity)
	stock.received_units = int(stock.received_units) + int(order.quantity)
	data.materials[order.material_id] = stock
	_history(data, "received", order_id, slot, int(order.quantity))
	return _result(data, "received", current)


static func consume_material(
	current: Dictionary, material_id: String, quantity: int, source_id: String, slot: int
) -> Dictionary:
	var error = validate(current)
	if not error.is_empty():
		return _reject(error, current)
	if (
		not current.materials.has(material_id)
		or not RaceCheckpoint.integral(quantity, 1, 1000000)
		or int(current.materials[material_id].quantity) < quantity
		or not CampaignIdentity.valid(source_id)
	):
		return _reject(
			"Material consumption exceeds physical stock or has invalid provenance.", current
		)
	var data = current.duplicate(true)
	var stock: Dictionary = data.materials[material_id]
	stock.quantity = int(stock.quantity) - quantity
	stock.consumed_units = int(stock.consumed_units) + quantity
	data.materials[material_id] = stock
	_history(data, "consumed", material_id, slot, quantity)
	return _result(data, "consumed", current)


static func register_project_evidence(
	current: Dictionary,
	project_id: String,
	latent_outcome_bps: int,
	slot: int,
	policy: Dictionary = {}
) -> Dictionary:
	var error = validate(current)
	var tuning = CampaignSupplyPolicy.normalized(policy)
	if not error.is_empty():
		return _reject(error, current)
	if (
		current.project_evidence.size() >= MAX_EVIDENCE
		or current.project_evidence.has(project_id)
		or not CampaignIdentity.valid(project_id)
		or not RaceCheckpoint.integral(latent_outcome_bps, -2500, 2500)
	):
		return _reject("Engineering evidence seed is invalid or duplicated.", current)
	var record = {
		"project_id": project_id,
		"latent_outcome_bps": latent_outcome_bps,
		"confidence_bps": int(tuning.initial_confidence_bps),
		"observations": 0,
		"created_slot": slot,
		"last_observed_slot": -1
	}
	_seal(record)
	var data = current.duplicate(true)
	data.project_evidence[project_id] = record
	return _result(data, "evidence_registered", current)


static func observe_project(
	current: Dictionary, project_id: String, slot: int, policy: Dictionary = {}
) -> Dictionary:
	var error = validate(current)
	var tuning = CampaignSupplyPolicy.normalized(policy)
	if not error.is_empty():
		return _reject(error, current)
	if not current.project_evidence.has(project_id):
		return _reject("Engineering evidence is unknown.", current)
	var data = current.duplicate(true)
	var record: Dictionary = data.project_evidence[project_id]
	record.observations = int(record.observations) + 1
	record.confidence_bps = mini(
		int(tuning.max_confidence_bps),
		int(record.confidence_bps) + int(tuning.observation_gain_bps)
	)
	record.last_observed_slot = slot
	_seal(record)
	data.project_evidence[project_id] = record
	return _result(data, "observed", current)


static func project_range(
	current: Dictionary, project_id: String, policy: Dictionary = {}
) -> Dictionary:
	if not validate(current).is_empty() or not current.project_evidence.has(project_id):
		return {}
	var tuning = CampaignSupplyPolicy.normalized(policy)
	var record: Dictionary = current.project_evidence[project_id]
	var spread = maxi(
		int(tuning.spread_floor_bps),
		int(round(float(tuning.spread_scale_bps) * (10000 - int(record.confidence_bps)) / 10000.0))
	)
	return {
		"project_id": project_id,
		"confidence_bps": record.confidence_bps,
		"low_bps": int(record.latent_outcome_bps) - spread,
		"high_bps": int(record.latent_outcome_bps) + spread,
		"observations": record.observations
	}


static func register_part(current: Dictionary, part_id: String, slot: int) -> Dictionary:
	var error = validate(current)
	if not error.is_empty():
		return _reject(error, current)
	if (
		current.part_service.size() >= MAX_PARTS
		or current.part_service.has(part_id)
		or not CampaignIdentity.valid(part_id)
	):
		return _reject("Part service record is invalid or duplicated.", current)
	var record = {
		"part_id": part_id,
		"condition": 100,
		"wear_events": 0,
		"repairs": 0,
		"created_slot": slot,
		"last_change_slot": slot
	}
	_seal(record)
	var data = current.duplicate(true)
	data.part_service[part_id] = record
	return _result(data, "part_registered", current)


static func wear_part(current: Dictionary, part_id: String, wear: int, slot: int) -> Dictionary:
	var error = validate(current)
	if not error.is_empty():
		return _reject(error, current)
	if not current.part_service.has(part_id) or not RaceCheckpoint.integral(wear, 1, 100):
		return _reject("Part wear request is invalid.", current)
	var data = current.duplicate(true)
	var record: Dictionary = data.part_service[part_id]
	record.condition = maxi(0, int(record.condition) - wear)
	record.wear_events = int(record.wear_events) + 1
	record.last_change_slot = slot
	_seal(record)
	data.part_service[part_id] = record
	_history(data, "part_wear", part_id, slot, wear)
	return _result(data, "part_worn", current)


static func repair_part(current: Dictionary, part_id: String, slot: int) -> Dictionary:
	var error = validate(current)
	if not error.is_empty():
		return _reject(error, current)
	if not current.part_service.has(part_id) or int(current.part_service[part_id].condition) >= 100:
		return _reject("Part does not require a recorded repair.", current)
	var data = current.duplicate(true)
	var record: Dictionary = data.part_service[part_id]
	record.condition = 100
	record.repairs = int(record.repairs) + 1
	record.last_change_slot = slot
	_seal(record)
	data.part_service[part_id] = record
	_history(data, "part_repair", part_id, slot, 1)
	return _result(data, "part_repaired", current)


static func validate(data: Variant) -> String:
	return CampaignSupplyValidation.validate(data)


static func _history(
	data: Dictionary, kind: String, source: String, slot: int, quantity: int
) -> void:
	var material = source
	if kind == "consumed":
		material = source
	var row = {
		"id":
		(
			"supplyhistory."
			+ RaceStateValue.fingerprint([kind, source, slot, data.history.size()]).substr(0, 24)
		),
		"kind": kind,
		"material_or_source_id": material,
		"slot": slot,
		"quantity": quantity
	}
	row["digest"] = RaceStateValue.fingerprint(row)
	data.history.append(row)


static func _result(data: Dictionary, status: String, current: Dictionary) -> Dictionary:
	var error = validate(data)
	return {
		"ok": error.is_empty(),
		"status": status if error.is_empty() else "rejected",
		"error": error,
		"supply": data if error.is_empty() else current.duplicate(true)
	}


static func _reject(message: String, current: Dictionary) -> Dictionary:
	return {"ok": false, "status": "rejected", "error": message, "supply": current.duplicate(true)}


static func _seal(d: Dictionary) -> void:
	d.erase("digest")
	d["digest"] = RaceStateValue.fingerprint(d)
