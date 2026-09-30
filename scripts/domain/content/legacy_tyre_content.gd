class_name LegacyTyreContent
extends RefCounted
## Compatibility data. New sessions resolve the JSON pack instead.
const PERFORMANCE = {
	"S": {
		"grip": 1.035,
		"wear": 5.5
	},
	"M": {
		"grip": 1.0,
		"wear": 3.6
	},
	"H": {
		"grip": 0.98,
		"wear": 2.4
	},
	"I": {
		"grip": 0.95,
		"wear": 4.0
	},
	"W": {
		"grip": 0.91,
		"wear": 4.5
	}
}
const OPTIMUM = {"S": 84.0, "M": 89.0, "H": 94.0, "I": 73.0, "W": 65.0}
const ALLOCATION = {"S": 3, "M": 3, "H": 2, "I": 2, "W": 2}
const PROFILES = {
	"S": {
		"grip": 1.035,
		"wear": 5.5,
		"id": "S",
		"short": "S",
		"name": "Soft",
		"color": "db786b",
		"optimum": 84.0,
		"family": "slick",
		"response": {
			"dry_floor": 0.4,
			"dry_onset": 0.07,
			"dry_loss": 0.85,
			"inter_base": 0.88,
			"inter_gain": 0.2,
			"inter_peak": 0.72,
			"inter_loss": 0.7,
			"wet_base": 0.77,
			"wet_gain": 0.33
		}
	},
	"M": {
		"grip": 1.0,
		"wear": 3.6,
		"id": "M",
		"short": "M",
		"name": "Medium",
		"color": "dfc777",
		"optimum": 89.0,
		"family": "slick",
		"response": {
			"dry_floor": 0.4,
			"dry_onset": 0.07,
			"dry_loss": 0.85,
			"inter_base": 0.88,
			"inter_gain": 0.2,
			"inter_peak": 0.72,
			"inter_loss": 0.7,
			"wet_base": 0.77,
			"wet_gain": 0.33
		}
	},
	"H": {
		"grip": 0.98,
		"wear": 2.4,
		"id": "H",
		"short": "H",
		"name": "Hard",
		"color": "d5d6c8",
		"optimum": 94.0,
		"family": "slick",
		"response": {
			"dry_floor": 0.4,
			"dry_onset": 0.07,
			"dry_loss": 0.85,
			"inter_base": 0.88,
			"inter_gain": 0.2,
			"inter_peak": 0.72,
			"inter_loss": 0.7,
			"wet_base": 0.77,
			"wet_gain": 0.33
		}
	},
	"I": {
		"grip": 0.95,
		"wear": 4.0,
		"id": "I",
		"short": "I",
		"name": "Intermediate",
		"color": "89bfa1",
		"optimum": 73.0,
		"family": "intermediate",
		"response": {
			"dry_floor": 0.4,
			"dry_onset": 0.07,
			"dry_loss": 0.85,
			"inter_base": 0.88,
			"inter_gain": 0.2,
			"inter_peak": 0.72,
			"inter_loss": 0.7,
			"wet_base": 0.77,
			"wet_gain": 0.33
		}
	},
	"W": {
		"grip": 0.91,
		"wear": 4.5,
		"id": "W",
		"short": "W",
		"name": "Wet",
		"color": "84b7d2",
		"optimum": 65.0,
		"family": "wet",
		"response": {
			"dry_floor": 0.4,
			"dry_onset": 0.07,
			"dry_loss": 0.85,
			"inter_base": 0.88,
			"inter_gain": 0.2,
			"inter_peak": 0.72,
			"inter_loss": 0.7,
			"wet_base": 0.77,
			"wet_gain": 0.33
		}
	}
}
const SELECTION = {"dry": "M", "intermediate": "I", "wet": "W", "initial_dry": "M", "initial_wet": "I", "qualifying_dry": "S", "qualifying_wet": "I", "template_balanced": "H", "template_extended": "M",
	"intermediate_threshold": 0.24, "wet_threshold": 0.68, "qualifying_threshold": 0.25,
	"qualifying": ["S", "M", "H"], "practice": ["M", "H", "S"], "race": ["M", "H", "S"], "long_race": ["H", "M", "S"], "long_stint_laps": 15.0}
