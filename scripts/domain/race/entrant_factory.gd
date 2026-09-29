class_name RaceEntrantFactory
extends RefCounted
## Builds one independent entrant record from the immutable roster and event setup.
## Serialized field names and defaults deliberately match pre-refactor checkpoints.

static func create(r: Array, i: int, track: TrackGeometry, laps: int, scenario: String, entry: EntrantDefinition = null) -> RaceCar:
	var record = initial_record(r, i, track, laps, scenario, entry)
	record.merge(RaceSim.CAR_V2.duplicate(true))
	TyreInventory.initialize_record(record)
	CarSetup.initialize_record(record)
	var car = RaceCar.from_record(record)
	return car

static func initial_record(r: Array, i: int, track: TrackGeometry, laps: int, scenario: String, entry: EntrantDefinition = null) -> Dictionary:
	return {
		"id": i,
		"short": r[0],
		"name": r[1],
		"team": entry.team_id if entry != null else r[2],
		"color": r[3],
		"skill": r[4],
		"consistency": r[5],
		"wet_skill": r[6],
		"reliability": r[7],
		"number": r[8],
		"player": entry.player if entry != null else i in LegacyRoster.PLAYER_IDS,
		"grid": i + 1,
		"distance": -i * track.grid_spacing,
		"previous_distance": -i * track.grid_spacing,
		"speed": 0.0,
		"lane": (-1 if i % 2 == 0 else 1) * 2.0,
		"route": "track",
		"pace": 1,
		"engine": 1,
		"auto": true,
		"compound": "I" if scenario == "wet" else "M",
		"tyre": 100.0,
		"temperature": 65.0,
		"fuel": float(laps) * 1.13 + 1.5,
		"health": 100.0,
		"damage": 0.0,
		"qual_state": "garage",
		"qual_runs": 0,
		"next_qual": 2.0 + i * 3.8,
		"qual_best": 0.0,
		"qual_laps": 0,
		"hot_start": 0.0,
		"hot_valid": true,
		"lap_start": 0.0,
		"last_lap": 0.0,
		"best_lap": 0.0,
		"completed": 0,
		"sectors": [0.0, 0.0, 0.0],
		"sector_start": 0.0,
		"pit_order": false,
		"next_compound": "M",
		"repair": true,
		"pit_d": 0.0,
		"pit_cycle": 0,
		"pit_stage": "",
		"pit_timer": 0.0,
		"pit_stops": 0,
		"box_d": track.pit_length * (entry.pit_fraction if entry != null else (0.30 + LegacyRoster.PIT_INDICES[i] * 0.055)),
		"loss": 0.0,
		"dnf": false,
		"retire_reason": "",
		"finished": false,
		"finish_position": 0,
		"finish_time": 0.0,
		"formation_done": false,
		"blue": false,
		"ai_clock": 0.0,
		"intent": "Ready for the weekend",
		"history": [],
		"setup": 5,
		"telemetry": [],
		"last_trace": 0.0,
		"pit_gate": -1.0,
		"crossed_at": -1.0,
		"previous_pit_d": 0.0,
		"previous_lane": 0.0,
		"previous_route": "track",
	}
