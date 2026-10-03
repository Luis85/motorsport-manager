class_name CampaignSupplyAuthority
extends RefCounted


static func validate(
	supply: Dictionary,
	economy: Dictionary,
	engineering: Dictionary,
	_operations: Dictionary,
	slot: int
) -> String:
	var error = CampaignSupplyNetwork.validate(supply)
	if not error.is_empty():
		return error
	if (
		not CampaignEconomy.validate(economy).is_empty()
		or not CampaignEngineering.validate(engineering).is_empty()
	):
		return "Supply authority has invalid dependencies."
	for order in supply.orders.values():
		if not economy.commitments.has(order.commitment_id):
			return "Supplier order has no matching cash commitment."
		var c: Dictionary = economy.commitments[order.commitment_id]
		if (
			c.source_id != order.id
			or c.category != "supplier"
			or int(c.amount_minor) != -int(order.amount_minor)
			or int(c.due_slot) != int(order.due_slot)
		):
			return "Supplier order disagrees with its cash commitment."
		if order.status == "ordered" and c.status == "cancelled":
			return "Open supplier order lost its binding cash commitment."
		if order.status == "received" and c.status != "settled":
			return "Received supplier order is not financially settled."
	for id in supply.project_evidence:
		if not engineering.projects.has(id):
			return "Engineering uncertainty references an unknown project."
	for id in supply.part_service:
		if not engineering.parts.has(id):
			return "Part service references an unknown physical part."
		if int(supply.part_service[id].condition) != int(engineering.parts[id].condition):
			return "Part service condition disagrees with the physical engineering part."
	for row in supply.history:
		if int(row.slot) > slot:
			return "Supply history is dated after authoritative campaign time."
	return ""
