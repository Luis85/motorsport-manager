class_name DeveloperCampaignSnapshots
extends RefCounted
## Complete active continuation includes the original production recording identity.
## Restored native candidates are never returned to the JSON/native public facade.


static func prepare(value: Dictionary) -> Dictionary:
	if not RaceStateValue.serializable(value):
		return DeveloperToolResult.failure("INVALID_ARGUMENT", "Use a bounded JSON snapshot.")
	var canonical: Dictionary = DeveloperToolResult.success(value).result
	var checkpoint: Variant = canonical.get("checkpoint", canonical)
	if not checkpoint is Dictionary:
		return DeveloperToolResult.failure(
			"INVALID_ARGUMENT", "Supply a complete campaign checkpoint."
		)
	var candidate = CampaignCheckpoint.upgrade(checkpoint)
	var restored = CampaignCheckpoint.restore(candidate)
	if not restored.ok:
		return DeveloperToolResult.failure("DOMAIN_REJECTED", restored.error)
	var weekend = _prepare_weekend(restored.active_manifest, canonical.get("active_weekend", {}))
	if not weekend.ok:
		return weekend
	return {"ok": true, "checkpoint": candidate, "weekend": weekend.get("weekend", {})}


static func capture(
	checkpoint: Dictionary, linked_session: String, weekends: DeveloperWeekends
) -> Dictionary:
	var manifest: Dictionary = checkpoint.get("active_manifest", {})
	var active_weekend = {}
	if not manifest.is_empty():
		var record = weekends.owned_record(linked_session) if weekends != null else null
		if record == null or not matches(manifest, record):
			return DeveloperToolResult.failure(
				"INCOMPLETE_SNAPSHOT",
				"The active campaign's original weekend recording is unavailable."
			)
		var recording = record.seal()
		var error = RaceRecord.validate(recording)
		if not error.is_empty():
			return DeveloperToolResult.failure("DOMAIN_REJECTED", error)
		active_weekend = {
			"session": linked_session,
			"recording":
			{"kind": RecordedWeekendContinuation.SESSION_KIND, "version": 1, "record": recording}
		}
	return DeveloperToolResult.success({"checkpoint": checkpoint, "active_weekend": active_weekend})


static func matches(manifest: Dictionary, record: RaceRecord) -> bool:
	if record == null or record.origin != "standalone":
		return false
	var rebuilt = CampaignWeekendManifest.build(manifest, record, manifest.mappings)
	return not rebuilt.is_empty() and rebuilt.digest == manifest.digest


static func _prepare_weekend(manifest: Dictionary, link: Variant) -> Dictionary:
	if manifest.is_empty():
		if not link is Dictionary or not link.is_empty():
			return DeveloperToolResult.failure(
				"INVALID_ARGUMENT", "Inactive campaigns have no active weekend."
			)
		return {"ok": true}
	if not link is Dictionary or not DeveloperToolResult.identifier(link.get("session")):
		return DeveloperToolResult.failure(
			"INCOMPLETE_SNAPSHOT",
			"An active campaign requires its linked original session recording."
		)
	var error = DeveloperFacetValues.argument_error(
		link,
		DeveloperFacetValues.object(
			{"session": ContentSchema.text(64), "recording": DeveloperFacetValues.document()},
			["session", "recording"]
		)
	)
	if not error.is_empty():
		return error
	var restored = RecordedWeekendContinuation.restore_session(link.recording)
	if not restored.ok:
		return DeveloperToolResult.failure("DOMAIN_REJECTED", restored.error)
	return _verified_weekend(manifest, link.session, restored)


static func _verified_weekend(
	manifest: Dictionary, session: String, restored: Dictionary
) -> Dictionary:
	var record: RaceRecord = restored.get("record")
	var simulation: RaceSim = restored.get("sim")
	if simulation == null or record == null or not matches(manifest, record):
		if record != null:
			record.detach()
		return DeveloperToolResult.failure(
			"DOMAIN_REJECTED",
			"The recording does not match the campaign's immutable departed entry."
		)
	return {"ok": true, "weekend": {"session": session, "simulation": simulation, "record": record}}
