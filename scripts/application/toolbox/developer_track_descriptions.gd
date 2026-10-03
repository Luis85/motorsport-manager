class_name DeveloperTrackDescriptions
extends RefCounted
## Editor operations advertise observed revision requirements and pure edit schemas.


static func configuration() -> Dictionary:
	return DeveloperFacetValues.object(
		{"circuit_id": ContentSchema.identity(), "document": DeveloperFacetValues.document()}
	)


static func describe() -> Array:
	var result: Array = []
	result.append(
		DeveloperFacetValues.descriptor(
			"track.create",
			"create",
			"Open an authored circuit, supplied safe draft, or new blank circuit.",
			DeveloperFacetValues.object({"configuration": configuration()})
		)
	)
	for method in ["read", "snapshot", "undo", "redo", "cancel", "close"]:
		result.append(
			DeveloperFacetValues.descriptor(
				"track." + method,
				method,
				{
					"read": "Read detached document, revision and history depths.",
					"snapshot":
					"Export the current document and revision; history remains session-local.",
					"undo": "Undo one committed edit; invalidate older observed revisions.",
					"redo": "Redo one undone edit; invalidate older observed revisions.",
					"cancel": "Cancel a gesture without deleting redo history.",
					"close": "Close this editor handle permanently."
				}[method],
				DeveloperFacetValues.object()
			)
		)
	result.append(
		DeveloperFacetValues.descriptor(
			"track.validate",
			"validate",
			"Check draft safety or stronger publication constraints.",
			DeveloperFacetValues.object({"publication": {"type": "boolean"}})
		)
	)
	result.append(
		DeveloperFacetValues.descriptor(
			"track.commit",
			"commit",
			"Commit a detached draft using its observed revision.",
			DeveloperFacetValues.object(
				{
					"document": DeveloperFacetValues.document(),
					"expected_revision": ContentSchema.integer(0, 9007199254740991)
				},
				["document", "expected_revision"]
			)
		)
	)
	var edit = DeveloperFacetValues.descriptor(
		"track.edit",
		"edit",
		"Transform a detached draft, then commit with the observed revision.",
		DeveloperFacetValues.object(
			{
				"action": {"enum": DeveloperTrackEdits.ACTIONS},
				"parameters": DeveloperFacetValues.document(),
				"expected_revision": ContentSchema.integer(0, 9007199254740991)
			},
			["action", "expected_revision"]
		)
	)
	edit.actions = DeveloperTrackEdits.describe()
	result.append(edit)
	result.append(
		DeveloperFacetValues.descriptor(
			"track.compile",
			"compile",
			"Compile independent runtime geometry and authoring diagnostics.",
			DeveloperFacetValues.object(
				{"vehicle": ContentSchema.text(96), "fast": {"type": "boolean"}}
			)
		)
	)
	return result


static func find(operation: String) -> Dictionary:
	for descriptor in describe():
		if descriptor.operation == operation:
			return descriptor
	return {}
