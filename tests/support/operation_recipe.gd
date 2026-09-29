extends RefCounted
## Test recipes, not another runtime journal. Generated choices use a private RNG.
const MAX_OPERATIONS = 160

static func race(seed_value: int, count: int = 72) -> Array:
	var choices = RandomNumberGenerator.new()
	choices.seed = seed_value
	var operations: Array = [
		{"op": "stage"}, {"op": "send", "id": 3},
		{"op": "advance", "delta": 0.05, "frames": 4},
		{"op": "pause"}, {"op": "speed", "value": 8}, {"op": "restore"},
		{"op": "play"}, {"op": "select", "id": 6}, {"op": "send", "id": 6}]
	for index in mini(count, MAX_OPERATIONS - operations.size() - 3):
		var driver = [3, 6, 0, -1][choices.randi_range(0, 3)]
		match index % 12:
			0: operations.append({"op": "select", "id": driver})
			1: operations.append({"op": "mode", "id": driver,
				"channel": ["pace", "engine"][choices.randi_range(0, 1)],
				"value": choices.randi_range(-1, 3)})
			2: operations.append({"op": "speed", "value": [1, 2, 4, 8, 16, 3][choices.randi_range(0, 5)]})
			3: operations.append({"op": "pause" if choices.randi_range(0, 1) else "play"})
			4: operations.append({"op": "advance", "delta": [0.016, 0.05, 0.3][choices.randi_range(0, 2)], "frames": choices.randi_range(1, 4)})
			5: operations.append({"op": "send", "id": driver})
			6: operations.append({"op": "observe", "count": choices.randi_range(1, 5)})
			7: operations.append({"op": "box", "id": driver})
			8: operations.append({"op": "raw", "action": "speed", "payload": {"value": 3}})
			9: operations.append({"op": "restore"})
			10: operations.append({"op": "stage"})
			11: operations.append({"op": "raw", "action": "pace", "payload": {"id": 0, "value": 2}})
	operations.append_array([{"op": "pause"}, {"op": "restore"}, {"op": "observe", "count": 8}])
	return operations

static func editor(seed_value: int, count: int = 72) -> Array:
	var choices = RandomNumberGenerator.new()
	choices.seed = seed_value
	var operations: Array = [
		{"op": "begin"}, {"op": "transform", "dx": 12, "dy": 0, "degrees": 0},
		{"op": "commit"}, {"op": "undo"}, {"op": "begin"},
		{"op": "transform", "dx": 3, "dy": 0, "degrees": 0},
		{"op": "cancel"}, {"op": "redo"}, {"op": "remember_draft"},
		{"op": "replace"}, {"op": "stale_commit"},
		{"op": "save_failure"}, {"op": "retry"}]
	var names = ["begin", "transform", "commit", "undo", "redo", "cancel", "observe",
		"remember_draft", "replace", "stale_commit", "save_failure", "retry", "preview"]
	for index in mini(count, MAX_OPERATIONS - operations.size()):
		var operation = {"op": names[index % names.size()]}
		if operation.op == "transform":
			operation.dx = choices.randi_range(-9, 9)
			operation.dy = choices.randi_range(-9, 9)
			operation.degrees = choices.randi_range(-2, 2) * 5
		operations.append(operation)
	return operations

static func valid(operations: Variant, domain: String = "") -> bool:
	if not operations is Array or operations.is_empty() or operations.size() > MAX_OPERATIONS:
		return false
	var race_names = ["select", "mode", "speed", "pause", "play", "stage", "send", "box", "raw", "observe", "advance", "restore"]
	var editor_names = ["begin", "transform", "commit", "undo", "redo", "cancel", "observe", "remember_draft", "replace", "stale_commit", "save_failure", "retry", "preview"]
	for entry in operations:
		if not entry is Dictionary or not entry.get("op") is String or not RaceStateValue.serializable(entry):
			return false
		if domain == "race" and entry.op not in race_names: return false
		if domain == "editor" and entry.op not in editor_names: return false
		if entry.op not in race_names and entry.op not in editor_names: return false
		if not RaceCheckpoint.integral(entry.get("frames", 1), 1, 16): return false
		if not RaceCheckpoint.integral(entry.get("count", 1), 1, 16): return false
		if not RaceCheckpoint.number(entry.get("delta", 0), 0, 1): return false
		if entry.op in ["select", "mode", "send", "box"] and not RaceCheckpoint.integral(entry.get("id"), -1000, 1000): return false
		if entry.op in ["mode", "speed"] and not RaceCheckpoint.integral(entry.get("value"), -1000, 1000): return false
		if entry.op == "mode" and (not entry.get("channel") is String or entry.channel.length() > 64): return false
		if entry.op == "raw" and (not entry.get("action") is String or entry.action.length() > 64 or not entry.get("payload") is Dictionary): return false
		if entry.op == "transform":
			for key in ["dx", "dy", "degrees"]:
				if not RaceCheckpoint.number(entry.get(key), -100000, 100000): return false
	return true
