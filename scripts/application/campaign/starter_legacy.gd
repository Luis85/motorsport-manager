class_name CampaignStarterLegacy
extends RefCounted
## Read-only compatibility for campaign checkpoints created before authored
## campaign profiles existed. New careers must never source tuning from here.
const DEFAULTS = {
	"vehicle": "Formula",
	"race_options":
	{
		"laps": 6,
		"qual_duration": 240,
		"scenario": "dry",
		"intensity": "calm",
		"seed": 7314,
		"tactical_duels": true
	},
	"departure_cost_minor": 8000,
	"driver_role_id": "race_driver",
	"operations_role_id": "operations_lead",
	"participation_minor": 5000,
	"position_bonus_minor": [10000, 7000, 5000, 3000, 2000, 1000, 500, 250]
}


static func race_options() -> Dictionary:
	return DEFAULTS.race_options.duplicate(true)


static func position_bonuses(count: int) -> Array:
	var result: Array = []
	for index in range(count):
		result.append(
			(
				int(DEFAULTS.position_bonus_minor[index])
				if index < DEFAULTS.position_bonus_minor.size()
				else 0
			)
		)
	return result
