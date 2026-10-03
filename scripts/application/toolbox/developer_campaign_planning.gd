class_name DeveloperCampaignPlanning
extends RefCounted
## Parameter contracts for explicit existing complete-checkpoint transactions.


static func specifications() -> Dictionary:
	var result = DeveloperCampaignOrganizationActions.SPECS.duplicate(true)
	result.merge(DeveloperCampaignManagementActions.SPECS)
	result.merge(DeveloperCampaignSeasonActions.SPECS)
	return result


static func schema(action: String) -> Dictionary:
	var specification = specifications().get(action, [])
	if specification.is_empty():
		return {}
	var properties = {}
	for key in specification[0]:
		match specification[0][key]:
			"Dictionary":
				properties[key] = DeveloperFacetValues.document()
			"Array":
				properties[key] = {"type": "array", "maxItems": 256}
			"String":
				properties[key] = ContentSchema.text(4096, 0)
			"bool":
				properties[key] = {"type": "boolean"}
			"int":
				properties[key] = ContentSchema.integer(-9007199254740991, 9007199254740991)
	return DeveloperFacetValues.object(properties, specification[1])


static func describe() -> Array:
	var result: Array = []
	for action in specifications():
		result.append({"action": action, "payload": schema(action)})
	return result


static func apply(checkpoint: Dictionary, action: String, payload: Dictionary) -> Dictionary:
	if DeveloperCampaignOrganizationActions.SPECS.has(action):
		return DeveloperCampaignOrganizationActions.apply(checkpoint, action, payload)
	if DeveloperCampaignManagementActions.SPECS.has(action):
		return DeveloperCampaignManagementActions.apply(checkpoint, action, payload)
	return DeveloperCampaignSeasonActions.apply(checkpoint, action, payload)
