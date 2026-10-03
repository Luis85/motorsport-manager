class_name CompetitionTuningSchema
extends RefCounted
## Supported decision-model tuning; command authority, collision rules and RNG remain code.
const LIMITS = {
	"policy":
	{
		"conserve_tread":
		[0, 100, "tread percent: Classic engineer begins conserving below this value."],
		"fuel_reserve_factor":
		[0.5, 2, "multiplier: Classic engineer fuel target relative to remaining laps."],
		"stop_remaining_laps":
		[0, 10, "laps: Minimum remaining distance for a discretionary stop."],
		"stop_start_laps":
		[0, 10, "laps: Minimum completed distance for a classic discretionary stop."],
		"stop_tread": [0, 100, "tread percent: Classic routine tyre-stop threshold."],
		"repair_damage": [0, 1000, "damage units: Delegated recovery threshold."],
		"pace_temperature_c": [0, 200, "Celsius: Delegated pace protection threshold."],
		"attack_tread":
		[0, 100, "tread percent: Minimum usable life for delegated assertive mode."],
		"attack_damage": [0, 1000, "damage units: Maximum damage for delegated assertive mode."],
		"review_seconds": [0.05, 120, "seconds: Interval between discretionary strategy reviews."],
		"review_stagger_seconds": [0, 10, "seconds: Per-driver modulo-three review staggering."],
		"healthy_tread":
		[
			0,
			100,
			"tread percent: Classic strategy can skip a discretionary review above this value."
		],
		"urgent_tread": [0, 100, "tread percent: Urgent resource recovery threshold."],
		"minimum_gain_seconds":
		[0, 30, "seconds: Minimum estimated gain for an ordinary delegated stop."],
		"pit_loss_gain_factor": [0, 1, "multiplier: Required gain relative to estimated pit loss."],
		"traffic_queue_seconds":
		[0, 30, "seconds: Queue at which an approved avoid-traffic branch may wait."]
	},
	"rivals":
	{
		"nearby_gap_seconds":
		[0.01, 10, "seconds: Observed gap qualifying as nearby race-position traffic."],
		"traffic_seconds_per_car": [0, 10, "seconds/car: Coarse cost of predicted rejoin traffic."],
		"observation_age_seconds":
		[0.05, 120, "seconds: Maximum age of a public stop used in a response."],
		"behind_gap_seconds":
		[0, 20, "seconds: How far behind an observed stop the classic response considers."],
		"cover_gap_seconds":
		[0, 30, "seconds: Maximum estimated ahead gap considered for covering."],
		"offset_laps": [0, 10, "laps: Hypothetical early-stop tyre advantage horizon."],
		"cover_scale_seconds":
		[0.01, 30, "seconds: Cover utility normalization; not a probability."],
		"cover_margin_seconds": [0, 10, "seconds: Classic response minimum cover margin."],
		"cover_minimum_gain":
		[-30, 30, "seconds: Lowest ordinary-stop gain accepted for a classic cover."],
		"extend_remaining_laps":
		[1, 20, "laps: Required remaining distance for discretionary extension."],
		"extend_tread": [0, 100, "tread percent: Required life for discretionary extension."],
		"extend_traffic_seconds": [0, 30, "seconds: Classic extension traffic-cost threshold."],
		"extend_fresh_gain_seconds":
		[0, 30, "seconds/lap: Classic extension threshold for fresh-tyre advantage."],
		"shortlist_seconds":
		[
			0,
			4,
			"seconds: Maximum regret allowed in the near-best shortlist; hard diagnostic ceiling remains four."
		],
		"position_scale": [0.01, 24, "places: Position-loss utility normalization."],
		"offset_scale_seconds": [0.01, 30, "seconds/lap: Fresh-tyre utility normalization."],
		"uncertainty_weight": [0, 4, "multiplier: Moderate-risk preference penalty."],
		"extend_credit_seconds":
		[0, 4, "seconds: Maximum extension preference credit for avoiding traffic."],
		"extend_traffic_factor": [0, 2, "multiplier: Extension credit relative to traffic cost."],
		"threat_position_factor":
		[0, 2, "multiplier: Track-position preference when a car is close behind."],
		"duel_queue_seconds":
		[0, 30, "seconds: Maximum predicted queue before tactical cover is declined."],
		"duel_cover_score":
		[-4, 8, "score units: Highest shortlisted cover score acceptable to the tactical policy."]
	},
	"battle":
	{
		"resolved_cooldown_seconds": [0.05, 60, "seconds: Cooldown after a completed pass."],
		"recovery_cooldown_seconds": [0.05, 60, "seconds: Cooldown after an aborted contest."],
		"acquire_distance_m":
		[10, 500, "metres: Maximum absolute distance to acquire a battle target."],
		"release_distance_m":
		[10, 1000, "metres: Maximum distance before a battle target is released."],
		"prepare_distance_m":
		[5, 500, "metres: Start preparing once the target closes to this gap."],
		"minimum_road_width_m":
		[7.5, 30, "metres: Required road width, never less than the corridor safety floor."],
		"maximum_curvature_per_m":
		[0.001, 0.05, "inverse metres: Maximum curvature supporting an attempt."],
		"minimum_grip": [0.3, 1.1, "multiplier: Minimum modeled local grip for a passing attempt."],
		"patient_preparation_seconds":
		[0.05, 30, "seconds: Preparation delay under patient racecraft."],
		"balanced_preparation_seconds":
		[0.05, 30, "seconds: Preparation delay under balanced racecraft."],
		"assertive_preparation_seconds":
		[0.05, 30, "seconds: Preparation delay under assertive racecraft."],
		"probe_seconds": [0.05, 10, "seconds: Minimum probe duration before committing."],
		"overlap_timeout_seconds":
		[0.05, 60, "seconds: Abandon an attempt that fails to make timely overlap."],
		"patient_speed_advantage_mps":
		[0, 10, "metres/second: Required closing speed in patient mode."],
		"balanced_speed_advantage_mps":
		[0, 10, "metres/second: Required closing speed in balanced mode."],
		"assertive_speed_advantage_mps":
		[0, 10, "metres/second: Required closing speed in assertive mode."],
		"patient_maximum_water":
		[
			0,
			1,
			"fraction: Patient drivers decline a discretionary pass above this local water level."
		]
	},
	"movement":
	{
		"wet_skill_reference": [0, 100, "skill points: Reference wet-driving rating."],
		"wet_skill_factor": [0, 0.009, "multiplier/skill point: Wet-skill handling contribution."],
		"straight_curvature_per_m":
		[0.0001, 0.02, "inverse metres: Threshold for applying setup straight-line effects."],
		"damaged_tyre_speed_mps":
		[1, 60, "metres/second: Target speed cap on an unusable fitted set."],
		"run_transit_factor": [0.1, 1, "multiplier: Speed envelope on non-flying session laps."],
		"run_transit_speed_mps": [5, 100, "metres/second: Non-flying lap target speed cap."],
		"formation_speed_factor": [0.1, 1, "multiplier: Formation speed envelope."],
		"formation_speed_mps": [5, 60, "metres/second: Formation target speed cap."],
		"formation_release_seconds": [0, 2, "seconds/grid place: Formation release spacing."],
		"start_reaction_seconds": [0, 2, "seconds: Base standing-start response delay."],
		"start_skill_seconds":
		[0, 0.1, "seconds/skill deficit: Standing-start response increment."],
		"yield_speed_mps": [5, 80, "metres/second: Courtesy speed cap after lateral clearance."],
		"wake_distance_m":
		[10, 200, "metres: Following range used by the existing slipstream/dirty-air model."],
		"slipstream_curvature_per_m":
		[0.0001, 0.02, "inverse metres: Straight-line threshold for the slipstream effect."],
		"slipstream_factor": [1, 1.1, "multiplier: Speed-envelope slipstream factor."],
		"dirty_air_factor": [0.8, 1, "multiplier: Speed-envelope dirty-air factor."],
		"following_headway_seconds":
		[0.1, 3, "seconds: Desired following headway before longitudinal constraints."],
		"following_response_per_second":
		[0.1, 3, "per second: Response to distance from the safe following reference."],
		"lateral_speed_mps":
		[
			0.1,
			4,
			"metres/second: Maximum requested lane-change rate; occupied-lane checks remain authoritative."
		]
	},
	"team":
	{
		"yield_maximum_gap_m":
		[10, 500, "metres: Maximum gap at which a team yield may be requested."],
		"yield_execution_gap_m": [5, 500, "metres: Maximum gap for executing a safe team yield."],
		"yield_width_m":
		[8, 30, "metres: Required width for yielding; no lower than the safety floor."],
		"yield_curvature_per_m":
		[0.001, 0.03, "inverse metres: Maximum curvature for executing a team yield."],
		"yield_grip": [0.45, 1.1, "multiplier: Minimum grip for team cooperation."],
		"yield_speed_factor":
		[0.5, 1, "multiplier: Bounded team-yield speed reduction after physical clearance."],
		"yield_speed_delta_mps":
		[0, 10, "metres/second: Requested speed difference to the passing teammate."],
		"priority_wear_factor":
		[1, 5, "multiplier: One-entry tyre-wear reserve for deferring the second car."],
		"priority_tread":
		[0, 100, "tread percent: Minimum projected remaining life when deferring a priority stop."],
		"priority_queue_margin_seconds":
		[0, 30, "seconds: Additional shared-service overlap margin."]
	}
}


static func definition() -> Dictionary:
	var properties: Dictionary = {"model": {"enum": ["race-competition-v1"]}}
	for group in LIMITS:
		var fields: Dictionary = {}
		for key in LIMITS[group]:
			var entry = LIMITS[group][key]
			fields[key] = ContentSchema.number(entry[0], entry[1])
			fields[key].description = entry[2]
		properties[group] = ContentSchema.object(fields)
	var identity = ContentSchema.text(96)
	identity.pattern = "^[a-z][a-z0-9_.-]*$"
	properties.profiles = ContentSchema.array(
		ContentSchema.object(
			{
				"id": identity,
				"label": ContentSchema.text(100),
				"summary": ContentSchema.text(500),
				"weights": ContentSchema.array(ContentSchema.number(-4, 4), 6, 6)
			}
		),
		16,
		1
	)
	return ContentSchema.object(properties)


static func semantic_errors(value: Dictionary) -> Array:
	var errors: Array = []
	var ids: Array = []
	for index in range(value.profiles.size()):
		var id: String = value.profiles[index].id
		if id == "legacy" or id in ids:
			errors.append(
				_error(
					"profiles/" + str(index) + "/id",
					"Choose a unique profile ID; legacy is reserved for compatibility."
				)
			)
		ids.append(id)
	for pair in [
		["prepare_distance_m", "acquire_distance_m"],
		["acquire_distance_m", "release_distance_m"],
		["assertive_preparation_seconds", "balanced_preparation_seconds"],
		["balanced_preparation_seconds", "patient_preparation_seconds"],
		["assertive_speed_advantage_mps", "balanced_speed_advantage_mps"],
		["balanced_speed_advantage_mps", "patient_speed_advantage_mps"]
	]:
		if value.battle[pair[0]] > value.battle[pair[1]]:
			errors.append(_error("battle/" + pair[1], "Must not be below " + pair[0] + "."))
	for pair in [["urgent_tread", "healthy_tread"], ["attack_damage", "repair_damage"]]:
		if value.policy[pair[0]] > value.policy[pair[1]]:
			errors.append(_error("policy/" + pair[1], "Must not be below " + pair[0] + "."))
	if value.team.yield_execution_gap_m > value.team.yield_maximum_gap_m:
		errors.append(
			_error(
				"team/yield_execution_gap_m",
				"Execution gap must not exceed the permitted request gap."
			)
		)
	return errors


static func _error(field: String, message: String) -> Dictionary:
	return ContentValidation.diagnostic("CONTENT_COMPETITION", "/competition/" + field, message)
