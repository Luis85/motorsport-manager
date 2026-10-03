class_name DeveloperWeekendDescriptors
extends RefCounted
## JSON discovery describes real operations; runtime owners remain authoritative.
const ARGUMENTS = {
	"weekend.create":
	{
		"configuration":
		{
			"type": "object",
			"oneOf":
			[
				{
					"type": "object",
					"properties": {"scenario_id": {"type": "string"}},
					"required": ["scenario_id"],
					"additionalProperties": false
				},
				{
					"type": "object",
					"properties":
					{
						"circuit_id": {"type": "string"},
						"weekend_id": {"type": "string"},
						"overrides": {"type": "object"}
					},
					"required": ["circuit_id", "weekend_id"],
					"additionalProperties": false
				}
			]
		}
	},
	"weekend.restore": {"snapshot": {"type": "object"}},
	"weekend.command": {"action": {"type": "string"}, "payload": {"type": "object", "default": {}}},
	"weekend.query":
	{
		"view": {"type": "string", "enum": DeveloperWeekendQueries.VIEWS, "default": "state"},
		"parameters": {"type": "object", "default": {}}
	},
	"weekend.step_ticks": {"count": {"type": "integer", "minimum": 1, "maximum": 20000}},
	"weekend.advance_elapsed": {"seconds": {"type": "number", "minimum": 0, "maximum": 0.25}},
	"weekend.snapshot": {},
	"weekend.recording": {},
	"weekend.events": {},
	"weekend.close": {}
}
const REQUIRED = {
	"weekend.create": ["configuration"],
	"weekend.restore": ["snapshot"],
	"weekend.command": ["action"],
	"weekend.step_ticks": ["count"],
	"weekend.advance_elapsed": ["seconds"]
}


static func describe() -> Array:
	return [
		_entry(
			"create",
			"Construct an authored weekend at briefing without approval or persistence.",
			"none",
			{
				"configuration":
				{"circuit_id": "core.circuit.hillside", "weekend_id": "core.weekend.quick"}
			}
		),
		_entry(
			"restore",
			"Atomically restore a production checkpoint; no historical event replay.",
			"none",
			{}
		),
		_entry(
			"command",
			"Apply one revalidated production command and record accepted input.",
			"none",
			{"action": "practice_start"}
		),
		_entry(
			"query",
			"Read detached state, evidence, planning drafts or current approval previews.",
			"none",
			{"view": "state"}
		),
		_entry(
			"step_ticks",
			"Run exact fixed ticks, stopping at pause or approval boundaries.",
			"fixed ticks",
			{"count": 20}
		),
		_entry(
			"advance_elapsed",
			"Advance caller elapsed seconds with production speed and residual policy.",
			"elapsed",
			{"seconds": 0.1}
		),
		_entry("snapshot", "Export a detached production checkpoint and fingerprint.", "none", {}),
		_entry(
			"recording",
			"Export the owned production recording and accepted-input trace.",
			"none",
			{}
		),
		_entry(
			"events",
			"Drain up to 1024 observer events without erasing sporting history.",
			"none",
			{}
		),
		_entry(
			"close",
			"Close the session permanently; repeated close has no side effects.",
			"none",
			{}
		)
	]


static func schema(operation: String) -> Dictionary:
	return {
		"type": "object",
		"properties": ARGUMENTS.get(operation, {}).duplicate(true),
		"required": REQUIRED.get(operation, []).duplicate(),
		"additionalProperties": false
	}


static func _entry(
	method: String, description: String, clock: String, example: Dictionary
) -> Dictionary:
	var operation = "weekend." + method
	var result = {
		"operation": operation,
		"method": method,
		"description": description,
		"arguments": schema(operation),
		"clock": clock,
		"persistence": "memory",
		"examples":
		(
			[]
			if method == "restore"
			else [{"operation": operation, "session": "weekend-a", "arguments": example}]
		)
	}
	if method == "query":
		result.views = DeveloperWeekendQueries.describe()
	return result
