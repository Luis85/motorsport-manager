extends RefCounted
## RW-18: pure, bounded preferences over the existing forecast's legal candidates.
## Diagnostic scores are private. Public presentation receives profiles and actual stops only.
const VERSION = 1
const HISTORY_LIMIT = 48
const KEYS = ["position", "undercut", "conserve", "adaptive"]
const WEIGHTS = ["pit_cost", "offset", "traffic", "extend", "cover", "uncertainty"]
const PROFILES = {
	"position":
	{
		"label": "Track-position protector",
		"summary":
		"Usually keeps a place rather than paying for a marginal tyre offset; may cover a threatening observed stop.",
		"weights": [2.4, 0.4, 0.3, -0.2, 2.2, 1.5]
	},
	"undercut":
	{
		"label": "Opportunistic undercutter",
		"summary":
		"Looks for a feasible early stop when traffic and its own tyre offset make clear air worthwhile.",
		"weights": [0.1, 2.0, 1.7, 0.8, 1.3, 0.5]
	},
	"conserve":
	{
		"label": "Long-stint conservator",
		"summary":
		"Usually extends usable tyres and avoids an expensive rejoin; emergencies still take priority.",
		"weights": [2.0, 0.4, -0.5, -2.5, 0.5, 1.5]
	},
	"adaptive":
	{
		"label": "Adaptive risk-taker",
		"summary":
		"Accepts a bounded, uncertain opportunity even without traffic ahead; still rejects unsafe or unaffordable options.",
		"weights": [0.2, 1.2, 0.7, -0.3, 1.0, 0.0]
	}
}
## Frozen contextual-rival state validation.
## Saved contextual-rival review evidence validation.


static func _valid_style_history_item(item: Dictionary, cars: Array) -> bool:
	if (
		item.get("choice") not in ["current", "box", "extend"]
		or not RaceCheckpoint.number(item.get("gate"), 0, 100000000)
	):
		return false
	if not RaceCheckpoint.number(item.get("hold_gate"), -1, 100000000):
		return false
	if item.choice == "extend" and item.hold_gate < item.gate:
		return false
	if item.choice != "extend" and item.hold_gate != -1:
		return false
	if (
		not item.get("set_id") is String
		or not item.get("reason") is String
		or item.reason.length() > 300
	):
		return false
	if item.choice == "box":
		if TyreInventory.find(cars[int(item.driver_id)], item.set_id).is_empty():
			return false
	elif not item.set_id.is_empty():
		return false
	if (
		not item.get("context") is Dictionary
		or not item.get("candidates") is Array
		or item.candidates.is_empty()
		or item.candidates.size() > 3
	):
		return false
	if not _valid_style_context_candidates(item):
		return false
	return true


static func _valid_style_context_candidates(item: Dictionary) -> bool:
	var c = item.context
	for key in ["traffic_ahead", "threat_behind"]:
		if not c.get(key) is bool:
			return false
	for key in ["fresh_lap_gain", "traffic_cost", "position_loss", "cover", "remaining", "life"]:
		if not RaceCheckpoint.number(c.get(key), 0, 10000000):
			return false
	if not c.get("public_event") is String or c.public_event.length() > 40:
		return false
	var ids: Array = []
	for candidate in item.candidates:
		if (
			not candidate is Dictionary
			or candidate.get("id") not in ["current", "box", "extend"]
			or candidate.id in ids
		):
			return false
		ids.append(candidate.id)
		if candidate.get("risk") not in ["lower", "moderate"]:
			return false
		if (
			not RaceCheckpoint.number(candidate.get("seconds"), 0, 10000000)
			or not RaceCheckpoint.number(candidate.get("preference"), -4, 4)
			or not RaceCheckpoint.number(candidate.get("score"), -4, 8)
		):
			return false
	if item.choice not in ids:
		return false
	return true
