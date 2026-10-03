class_name DeveloperCampaignDescriptions
extends RefCounted
## Discoverable protocol surface, with the exact planning/query parameter contracts.


static func describe() -> Array:
	var result: Array = []
	result.append(
		DeveloperFacetValues.descriptor(
			"campaign.create",
			"create",
			"Create a complete career from frozen authored content.",
			DeveloperFacetValues.object({"campaign_id": ContentSchema.identity()}, ["campaign_id"])
		)
	)
	(
		result
		. append(
			(
				DeveloperFacetValues
				. descriptor(
					"campaign.restore",
					"restore",
					"Restore an inactive checkpoint or complete active snapshot with its original recording.",
					DeveloperFacetValues.object(
						{"snapshot": DeveloperFacetValues.document()}, ["snapshot"]
					)
				)
			)
		)
	)
	var query = DeveloperFacetValues.descriptor(
		"campaign.query",
		"query",
		"Read a detached campaign projection without advancing time.",
		DeveloperFacetValues.object(
			{
				"view": {"enum": DeveloperCampaignQueries.VIEWS},
				"parameters": DeveloperFacetValues.document()
			}
		)
	)
	query.views = DeveloperCampaignQueries.describe()
	result.append(query)
	var command = DeveloperFacetValues.descriptor(
		"campaign.command",
		"command",
		"Apply an existing atomic planning transaction.",
		DeveloperFacetValues.object(
			{
				"action": {"enum": DeveloperCampaignPlanning.specifications().keys()},
				"payload": DeveloperFacetValues.document()
			},
			["action"]
		)
	)
	command.actions = DeveloperCampaignPlanning.describe()
	result.append(command)
	for method in ["snapshot", "advance", "close"]:
		(
			result
			. append(
				(
					DeveloperFacetValues
					. descriptor(
						"campaign." + method,
						method,
						{
							"snapshot":
							"Export the complete checkpoint and linked original recording for active continuation.",
							"advance":
							"Advance to the next registered departure; settle due obligations atomically.",
							"close": "Close this campaign handle permanently."
						}[method],
						DeveloperFacetValues.object(),
						"campaign slots" if method == "advance" else "none"
					)
				)
			)
		)
	for method in ["depart", "settle"]:
		result.append(
			DeveloperFacetValues.descriptor(
				"campaign." + method,
				method,
				(
					"Depart into an actual owned weekend."
					if method == "depart"
					else "Settle the supplied owned weekend's factual finished recording."
				),
				DeveloperFacetValues.object(
					{"weekend_session": ContentSchema.text(64)}, ["weekend_session"]
				),
				"none" if method == "depart" else "campaign slots"
			)
		)
	return result


static func find(operation: String) -> Dictionary:
	for descriptor in describe():
		if descriptor.operation == operation:
			return descriptor
	return {}
