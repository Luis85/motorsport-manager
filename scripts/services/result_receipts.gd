class_name ResultReceipts
extends RefCounted
## Durable standalone acceptance boundary. A campaign consumer must perform its own
## entry validation and atomic settlement; this ledger never grants points/money/XP.
const KIND = "motorsport-manager-result-receipts"
const MAX_RESULTS = 256

static func accept(record: RaceRecord, path: String = "user://weekend-results.json") -> Dictionary:
	if record == null or record.origin == "sandbox": return {"ok": false, "message": "Sandbox results cannot be accepted as an original weekend."}
	var result = WeekendResult.build(record)
	if result.is_empty(): return {"ok": false, "message": "Complete the original weekend before accepting its result."}
	var ledger = {"kind": KIND, "version": 1, "results": {}}
	if FileAccess.file_exists(path):
		var read = Storage.read_json(path)
		if not read.ok: return {"ok": false, "message": read.error}
		if not valid(read.data): return {"ok": false, "message": "The result ledger is invalid. It was not replaced."}
		ledger = read.data
	if ledger.results.has(result.event_id):
		var old = ledger.results[result.event_id]
		if old.digest == result.digest: return {"ok": true, "already_accepted": true, "message": "Already accepted. No duplicate result or consequence was created.", "result": old.duplicate(true)}
		return {"ok": false, "message": "This event already has a different accepted result. Keep the original; correction/settlement is not supported here."}
	if ledger.results.size() >= MAX_RESULTS: return {"ok": false, "message": "The 256-result archive is full. No existing receipt was removed."}
	ledger.results[result.event_id] = result.duplicate(true)
	var error = Storage.write_json(path, ledger)
	if not error.is_empty(): return {"ok": false, "message": error}
	return {"ok": true, "already_accepted": false, "message": "Original result accepted on this device. No campaign points, money or XP were awarded.", "result": result.duplicate(true)}

static func valid(data: Variant) -> bool:
	if not data is Dictionary or data.get("kind") != KIND or data.get("version") != 1 or not data.get("results") is Dictionary or data.results.size() > MAX_RESULTS: return false
	for id in data.results:
		var result = data.results[id]
		if not RaceRecord.valid_id(id) or not result is Dictionary or result.get("event_id") != id or result.get("kind") != "motorsport-manager-weekend-result" or result.get("version") != 1 or result.get("origin") not in ["standalone", "legacy"] or result.get("final") != true: return false
		var content = result.duplicate(true); content.erase("digest")
		if result.get("digest") != RaceRecord.fingerprint(content): return false
	return true
