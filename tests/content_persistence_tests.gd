extends SceneTree
## Preserve persisted numeric values, legacy fingerprints and replay tamper checks.
const PATH = "user://content-persistence-test.json"
var checks = 0
var failures: Array[String] = []


class Store:
	extends WeekendEntryStore

	func save_record(record: RaceRecord) -> String:
		return ReplayStorage.save_session(PATH, record)


func _initialize() -> void:
	call_deferred("run")


func check(condition: bool, label: String) -> void:
	checks += 1
	if not condition:
		failures.append(label)
		print("PERSISTENCE_FAILURE ", label)


func bits(value: float) -> String:
	var bytes = PackedByteArray()
	bytes.resize(8)
	bytes.encode_double(0, value)
	return bytes.hex_encode()


func numbers() -> void:
	var cases = Storage.read_json("res://tests/fixtures/json_number_cases.json").data
	for example in cases:
		var parsed = ContentJson.parse(example.decimal_literal, true)
		check(
			parsed.ok and bits(parsed.data) == example.bits,
			"Correct rounding: " + example.decimal_literal
		)
	for text in ["1e999", "NaN", "1e309", "1e-999", "01", "1e", "[1,]", '{"value":1,"value":2}']:
		check(not ContentJson.parse(text, true).ok, "Strict saved JSON rejects " + text)
	var tiny = JsonNumber.parse("1.0797002911567688e-09").value
	var values = {
		"kind": "motorsport-manager-weekend",
		"grain": tiny,
		"nested": [0, 1, 0.1, {"value": tiny}],
		"digest": RaceStateValue.fingerprint(tiny)
	}
	var before = RaceStateValue.fingerprint(values)
	for iteration in range(8):
		check(Storage.write_json(PATH, values).is_empty(), "Write exact numeric fixture")
		var loaded = Storage.read_json(PATH)
		check(loaded.ok, "Read exact numeric fixture")
		if not loaded.ok:
			return
		values = loaded.data
		check(bits(values.grain) == bits(tiny), "Repeated save/load preserves every grain bit")
		check(
			RaceStateValue.fingerprint(values) == before,
			"Legacy fingerprint remains identical after save/load"
		)
		check(
			values.digest == RaceStateValue.fingerprint(values.grain),
			"No integrity algorithm was relaxed"
		)

	for kind in [
		"motorsport-manager-scenario",
		"motorsport-manager-reproduction",
		"motorsport-manager-weekend-result",
		"motorsport-manager-circuit-notebook",
		"motorsport-manager-result-receipts"
	]:
		var wrapped = {"kind": kind, "record": values}
		check(Storage.write_json(PATH, wrapped).is_empty(), "Save nested envelope " + kind)
		var read = Storage.read_json(PATH)
		check(
			read.ok and bits(read.data.record.grain) == bits(tiny),
			"Nested envelopes preserve saved state: " + kind
		)


func run() -> void:
	numbers()
	var loaded = ContentPackLoader.new().load_packs(
		["res://config", "res://content/examples/club-racing"]
	)
	check(loaded.ok, "Production packs load")
	if loaded.ok:
		var track = Storage.read_json("res://config/circuits/hillside.json").data
		track.grid.count = 14
		var launch = WeekendLaunch.new(loaded.catalog)
		check(
			launch.stage_preset("local.club.weekend.sprint", track), "Stage file-authored weekend"
		)
		var committed = launch.commit(launch.capture().revision, Store.new())
		check(committed.ok, "Commit production entry")
		if committed.ok:
			var sim: RaceSim = committed.simulation
			if sim.paused:
				sim.command("pause")
			for index in range(1600):
				sim.step()
			var sealed = committed.record.seal()
			check(
				RaceRecord.validate(sealed).is_empty(),
				"Moving native record validates before writing"
			)
			check(
				ReplayStorage.save_session(PATH, committed.record).is_empty(),
				"Save moving native record"
			)
			var saved = Storage.read_json(PATH)
			check(saved.ok, "Read moving native record")
			if saved.ok:
				check(saved.data.record.digest == sealed.digest, "Persisted digest is unchanged")
				var error = RaceRecord.validate(saved.data.record)
				check(error.is_empty(), "Moving file-backed replay validates: " + error)
				var restored = ReplayStorage.restore_session(saved.data)
				check(restored.ok, "Restore through the production persistence boundary")
				if restored.ok:
					check(
						RaceRecord.equivalent(sim.snapshot(), restored.sim.snapshot()),
						"Restored race matches the saved source"
					)
					restored.record.detach()
				var modified = saved.data.record.duplicate(true)
				modified.endpoint.cars[0].fuel += 0.000001
				check(
					not RaceRecord.validate(modified).is_empty(),
					"A one-millionth-unit state edit still invalidates integrity"
				)
				modified = saved.data.record.duplicate(true)
				modified.endpoint.vehicle_definition.top_speed_mps += 1
				check(
					not RaceRecord.validate(modified).is_empty(),
					"Frozen content tampering still invalidates integrity"
				)
			committed.record.detach()
	var result = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/content-persistence-tests.json", result)
	print("CONTENT_PERSISTENCE_TESTS ", JSON.stringify(result))
	quit(0 if failures.is_empty() else 1)
