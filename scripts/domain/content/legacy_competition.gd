class_name LegacyCompetition
extends RefCounted
## Immutable pre-extraction values for old saves and direct compatibility APIs only.
const VALUES = {
	"model": "race-competition-v1",
	"policy":
	{
		"conserve_tread": 30.0,
		"fuel_reserve_factor": 1.03,
		"stop_remaining_laps": 0.8,
		"stop_start_laps": 0.25,
		"stop_tread": 25.0,
		"repair_damage": 24.0,
		"pace_temperature_c": 120.0,
		"attack_tread": 35.0,
		"attack_damage": 12.0,
		"review_seconds": 12.0,
		"review_stagger_seconds": 1.0,
		"healthy_tread": 80.0,
		"urgent_tread": 18.0,
		"minimum_gain_seconds": 3.0,
		"pit_loss_gain_factor": 0.12,
		"traffic_queue_seconds": 1.0
	},
	"rivals":
	{
		"nearby_gap_seconds": 2.5,
		"traffic_seconds_per_car": 0.8,
		"observation_age_seconds": 40.0,
		"behind_gap_seconds": 4.0,
		"cover_gap_seconds": 8.0,
		"offset_laps": 2.0,
		"cover_scale_seconds": 2.0,
		"cover_margin_seconds": 0.3,
		"cover_minimum_gain": -1.0,
		"extend_remaining_laps": 3.0,
		"extend_tread": 35.0,
		"extend_traffic_seconds": 1.5,
		"extend_fresh_gain_seconds": 1.5,
		"shortlist_seconds": 4.0,
		"position_scale": 3.0,
		"offset_scale_seconds": 2.0,
		"uncertainty_weight": 2.0,
		"extend_credit_seconds": 1.5,
		"extend_traffic_factor": 0.25,
		"threat_position_factor": 0.25,
		"duel_queue_seconds": 1.0,
		"duel_cover_score": 2.0
	},
	"battle":
	{
		"resolved_cooldown_seconds": 2.0,
		"recovery_cooldown_seconds": 3.0,
		"acquire_distance_m": 120.0,
		"release_distance_m": 180.0,
		"prepare_distance_m": 75.0,
		"minimum_road_width_m": 7.5,
		"maximum_curvature_per_m": 0.035,
		"minimum_grip": 0.45,
		"patient_preparation_seconds": 1.5,
		"balanced_preparation_seconds": 0.8,
		"assertive_preparation_seconds": 0.4,
		"probe_seconds": 0.25,
		"overlap_timeout_seconds": 15.0,
		"patient_speed_advantage_mps": 2.0,
		"balanced_speed_advantage_mps": 0.4,
		"assertive_speed_advantage_mps": 0.1,
		"patient_maximum_water": 0.5
	},
	"movement":
	{
		"wet_skill_reference": 85.0,
		"wet_skill_factor": 0.004,
		"straight_curvature_per_m": 0.005,
		"damaged_tyre_speed_mps": 27.0,
		"run_transit_factor": 0.76,
		"run_transit_speed_mps": 48.0,
		"formation_speed_factor": 0.65,
		"formation_speed_mps": 30.0,
		"formation_release_seconds": 0.22,
		"start_reaction_seconds": 0.15,
		"start_skill_seconds": 0.008,
		"yield_speed_mps": 43.0,
		"wake_distance_m": 75.0,
		"slipstream_curvature_per_m": 0.004,
		"slipstream_factor": 1.022,
		"dirty_air_factor": 0.991,
		"following_headway_seconds": 0.8,
		"following_response_per_second": 0.7,
		"lateral_speed_mps": 1.8
	},
	"team":
	{
		"yield_maximum_gap_m": 120.0,
		"yield_execution_gap_m": 65.0,
		"yield_width_m": 8.0,
		"yield_curvature_per_m": 0.015,
		"yield_grip": 0.6,
		"yield_speed_factor": 0.88,
		"yield_speed_delta_mps": 2.0,
		"priority_wear_factor": 1.5,
		"priority_tread": 18.0,
		"priority_queue_margin_seconds": 2.0
	},
	"profiles":
	[
		{
			"id": "position",
			"label": "Track-position protector",
			"summary":
			(
				"Usually keeps a place rather than paying for a marginal tyre offset; "
				+ "may cover a threatening observed stop."
			),
			"weights": [2.4, 0.4, 0.3, -0.2, 2.2, 1.5]
		},
		{
			"id": "undercut",
			"label": "Opportunistic undercutter",
			"summary":
			"Looks for a feasible early stop when traffic and its own tyre offset make clear air worthwhile.",
			"weights": [0.1, 2.0, 1.7, 0.8, 1.3, 0.5]
		},
		{
			"id": "conserve",
			"label": "Long-stint conservator",
			"summary":
			"Usually extends usable tyres and avoids an expensive rejoin; emergencies still take priority.",
			"weights": [2.0, 0.4, -0.5, -2.5, 0.5, 1.5]
		},
		{
			"id": "adaptive",
			"label": "Adaptive risk-taker",
			"summary":
			(
				"Accepts a bounded, uncertain opportunity even without traffic ahead; "
				+ "still rejects unsafe or unaffordable options."
			),
			"weights": [0.2, 1.2, 0.7, -0.3, 1.0, 0.0]
		}
	]
}
