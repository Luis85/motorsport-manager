class_name WeekendSummary
extends RefCounted
## Detached factual result. No prize, causal attribution or live race mutation.
static func capture(simulation: RaceSim) -> Dictionary:
	if simulation == null or simulation.phase != "results":
		return {}
	var rows: Array = []
	var managed: Array = []
	for row in simulation.standings():
		var result = {"id": row.id, "name": row.name, "short": row.short,
			"position": rows.size() + 1, "player": row.player,
			"status": "Retired" if row.dnf else ("Finished" if row.finished else "Not classified"),
			"laps": int(row.completed), "best": MinimalRaceTiming.format_time(row.best_lap),
			"stops": int(row.pit_stops), "reason": str(row.retire_reason) if row.dnf else ""}
		rows.append(result)
		if row.player: managed.append(result.duplicate(true))
	return {"name": simulation.track.document.name, "laps": simulation.laps,
		"rows": rows, "managed": managed, "seed": simulation.seed_value,
		"time": simulation.total_time}
