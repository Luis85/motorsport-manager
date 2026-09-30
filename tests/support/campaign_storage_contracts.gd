class_name CampaignStorageContracts
extends RefCounted

class MemoryFiles:
	extends Storage.FileOperations
	var entries: Dictionary = {}
	var faults: Dictionary = {}
	func read_text(path: String, maximum_bytes: int) -> Dictionary:
		var absolute = ProjectSettings.globalize_path(path)
		if not entries.has(absolute): return {"ok": false, "error": "Injected missing campaign checkpoint"}
		var text: String = entries[absolute]
		if text.to_utf8_buffer().size() > maximum_bytes:	return {"ok": false, "error": "File exceeds 16 MB."}
		return {"ok": true, "text": text}
	func write_text(path: String, text: String) -> String:
		if faults.has("write"): return "Injected campaign write failure"
		entries[path] = text
		return ""
	func make_directory(_path: String) -> Error: return OK
	func exists(path: String) -> bool: return entries.has(path)
	func remove(path: String) -> Error:
		if faults.has("remove:" + path): return faults["remove:" + path]
		entries.erase(path)
		return OK
	func rename(source: String, destination: String) -> Error:
		if faults.has("rename:" + source): return faults["rename:" + source]
		if not entries.has(source): return ERR_FILE_NOT_FOUND
		entries[destination] = entries[source]
		entries.erase(source)
		return OK

static func run(check: Callable) -> void:
	var campaign = CampaignCommandContracts.state()
	campaign.command("intervention", {"id": "intervention.storage", "energy": 1, "duration_slots": 2})
	campaign.command("advance_slots", {"slots": 2})
	var checkpoint = CampaignCheckpoint.build(campaign)
	check.call(not checkpoint.is_empty() and CampaignCheckpoint.validate(checkpoint).is_empty(), "Campaign state and settlement ledger form one versioned checkpoint envelope")
	var restored = CampaignCheckpoint.restore(checkpoint)
	check.call(restored.ok and restored.state.snapshot() == campaign.snapshot(), "Campaign checkpoint restores a detached authoritative aggregate")
	var edited = checkpoint.duplicate(true); edited.state.energy_available = 0
	check.call(campaign.energy_available == 5, "Editing a checkpoint value cannot mutate the live campaign")
	var invalid_active = checkpoint.duplicate(true)
	invalid_active.active_manifest = {"invalid": true}
	invalid_active.erase("digest"); invalid_active["digest"] = RaceStateValue.fingerprint(invalid_active)
	check.call(not CampaignCheckpoint.validate(invalid_active).is_empty(), "Malformed active weekend references fail closed")
	var files = MemoryFiles.new()
	var path = "user://campaign-state-contract.json"
	var storage = CampaignStorage.new(path, files)
	check.call(storage.save(campaign).is_empty(), "Campaign storage publishes the first checkpoint through the atomic policy")
	var loaded = storage.load()
	check.call(loaded.ok and loaded.state.snapshot() == campaign.snapshot(), "Campaign checkpoint survives precise JSON save and restore")
	check.call(typeof(loaded.state.revision) == TYPE_INT and typeof(loaded.state.clock.elapsed_slots) == TYPE_INT, "Campaign restore retains integral command and clock values")
	var previous = campaign.snapshot()
	campaign.command("advance_slots", {"slots": 1})
	var absolute = ProjectSettings.globalize_path(path)
	files.faults["rename:" + absolute + ".tmp"] = ERR_FILE_CANT_WRITE
	var failure = storage.save(campaign)
	check.call(failure.contains("Atomic replacement failed"), "Campaign storage exposes an interrupted replacement")
	loaded = storage.load()
	check.call(loaded.ok and loaded.state.snapshot() == previous, "Interrupted campaign publication keeps the previous checkpoint authoritative")
	files.faults.clear()
	check.call(storage.save(campaign).is_empty(), "Campaign checkpoint can be retried after storage recovery")
	loaded = storage.load()
	check.call(loaded.ok and loaded.state.snapshot() == campaign.snapshot(), "Successful retry publishes the new campaign revision exactly once")
