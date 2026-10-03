class_name RaceHookContract
extends RefCounted
## Validate extension signatures during construction, before any state is installed.
## Reflection is deliberately outside the fixed-step path. Providers remain trusted code.

# Keep this list aligned with the aggregate dispatch entry points. The architecture
# fitness test checks both directions; a helper method is not a dispatchable hook.
const HOOKS: Array[String] = [
	"policy",
	"active_plan",
	"forecast",
	"sync_ownership",
	"command",
	"policy_command",
	"manage_resources",
	"engineer",
	"contextual_rival",
	"review_rival_style",
	"order_stop",
	"block_plan",
	"leave_garage",
	"record_stint",
	"step",
	"snapshot",
	"traffic_instruction",
	"record_track_pass",
	"move_car",
	"observe_warnings",
	"weather_observation",
	"weather_outlook",
	"weather_advice",
	"weather_stale",
	"update_surface",
	"weather_issue",
	"weather_debrief",
	"enhanced",
	"reliability",
	"recovery_advice",
	"recovery_stale",
	"forecast_parameters",
	"log_recovery_command",
	"issue_repair",
	"wear_car",
	"observe_reliability",
	"service_random_value",
	"begin_service",
	"complete_service",
	"update_pit",
	"pit_exit_message",
	"pit_status",
	"update_flags",
	"neutral",
	"neutral_speed_limit",
	"constrain_progress",
	"update_yield",
	"incident",
	"retire",
	"recovery_debrief",
	"is_run_session",
	"practice_driver",
	"run_preview",
	"_practice_command",
	"record_practice",
	"launch_run",
	"close_practice",
	"reset_run_counters",
	"qualifying_crossings",
	"_practice_step",
	"car_advisories",
	"plan_pit_gate",
]


static func methods(value: Object) -> Dictionary:
	var result: Dictionary = {}
	for method in value.get_method_list():
		result[str(method.name)] = method
	return result


static func validate(owner: RaceSim, provider: RaceMechanic, hooks: Array) -> String:
	var exposed = methods(owner)
	var implemented = methods(provider)
	for hook in hooks:
		if hook not in HOOKS:
			return "Hook '%s' is not an explicit aggregate dispatch entry point." % hook
		if not exposed.has(hook) or not implemented.has(hook):
			return "Hook '%s' must exist on both the race aggregate and its provider." % hook
		var target: Dictionary = exposed[hook]
		var method: Dictionary = implemented[hook]
		if method.args.size() != target.args.size() + 1:
			return (
				"Hook '%s' requires the simulation followed by %d arguments; found %d."
				% [hook, target.args.size(), method.args.size()]
			)
		var first: Dictionary = method.args[0]
		if (
			int(first.type) != TYPE_NIL
			and (
				int(first.type) != TYPE_OBJECT
				or str(first.class_name) not in ["", "RaceSim", "RefCounted", "Object"]
			)
		):
			return "Hook '%s' must accept RaceSim as its first argument." % hook
		for index in range(target.args.size()):
			if not accepts(method.args[index + 1], target.args[index]):
				return (
					"Hook '%s' argument %d disagrees with the aggregate contract."
					% [hook, index + 1]
				)
		if not accepts(target["return"], method["return"]):
			return "Hook '%s' return type disagrees with the aggregate contract." % hook
	return ""


static func accepts(receiver: Dictionary, supplied: Dictionary) -> bool:
	# Variant intentionally permits a dynamic value. Typed built-ins and typed
	# collections must match; accepting a narrower array can otherwise fail at callv.
	if int(receiver.type) == TYPE_NIL or int(supplied.type) == TYPE_NIL:
		# Object metadata uses NIL for both Variant and void. Only Variant is a
		# wildcard; a void provider cannot satisfy a value-returning contract.
		var receiver_variant = int(receiver.get("usage", 0)) & PROPERTY_USAGE_NIL_IS_VARIANT
		var supplied_variant = int(supplied.get("usage", 0)) & PROPERTY_USAGE_NIL_IS_VARIANT
		if receiver_variant or supplied_variant:
			return true
		return int(receiver.type) == int(supplied.type)
	if int(receiver.type) != int(supplied.type):
		return false
	if int(receiver.type) in [TYPE_ARRAY, TYPE_DICTIONARY]:
		var hint = str(receiver.get("hint_string", ""))
		return hint.is_empty() or hint == str(supplied.get("hint_string", ""))
	if int(receiver.type) == TYPE_OBJECT:
		var name = str(receiver.get("class_name", ""))
		return name in ["", "Object", "RefCounted"] or name == str(supplied.get("class_name", ""))
	return true
