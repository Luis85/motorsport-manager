class_name RaceUISnapshot
extends RefCounted
## Presentation-only snapshot used to keep high-frequency race UI refreshes cheap.
var phase := ""
var lap := 0
var total_laps := 0
var clock := 0.0
var race_time := 0.0
var flag := ""
var paused := false
var speed := 1
var weather := ""
var water := 0
var rubber := 0
var selected_id := -1
var classification_signature := ""
var driver_signatures: Dictionary = {}
var decision_signatures: Dictionary = {}

static func capture(sim: RaceSim) -> RaceUISnapshot:
	var shot = RaceUISnapshot.new()
	shot.phase = sim.phase; shot.total_laps = sim.laps; shot.clock = sim.clock; shot.race_time = sim.race_time
	shot.flag = sim.flag; shot.paused = sim.paused; shot.speed = sim.speed; shot.weather = sim.weather_name
	shot.water = roundi(sim.average(sim.water) * 100); shot.rubber = roundi(sim.average(sim.rubber) * 100)
	shot.selected_id = sim.selected_id
	var order = sim.standings(sim.phase in ["practice", "practice_results", "qualifying", "qualifying_results"])
	if not order.is_empty():
		shot.lap = clampi(int(floor(maxf(0, order[0].distance) / sim.track.length)) + 1, 1, sim.laps)
		shot.classification_signature = "|".join(order.map(func(c): return "%s:%d:%d:%s:%s" % [c.id, c.completed, int(c.distance), c.compound, c.route]))
	for c in sim.cars:
		shot.driver_signatures[c.id] = "%d:%d:%d:%d:%s:%s:%d:%d" % [c.id, int(c.tyre), int(c.fuel * 10), int(c.health), c.compound, c.route, c.scheduled_lap, int(c.pit_order)]
	return shot

func classification_changed(previous: RaceUISnapshot) -> bool:
	return previous == null or classification_signature != previous.classification_signature

func driver_changed(previous: RaceUISnapshot, id: int) -> bool:
	return previous == null or driver_signatures.get(id, "") != previous.driver_signatures.get(id, "")

func conditions_changed(previous: RaceUISnapshot) -> bool:
	return previous == null or weather != previous.weather or water != previous.water or rubber != previous.rubber or flag != previous.flag or paused != previous.paused
