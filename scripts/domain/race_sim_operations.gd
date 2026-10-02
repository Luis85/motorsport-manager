class_name RaceSimOperations
extends RaceSimCore
## Pit service, reliability, persistence projection and recovery-oriented base rules.
func _base_wear_car(c: RaceCar, distance: float, cell: int, effects: Dictionary = {}, local: Dictionary = {}) -> void:
	RaceVehicleCondition.wear_car(self, c, distance, cell, effects, local)

func _base_qualifying_crossings(c: RaceCar, before: float, after: float) -> void:
	RaceTiming.qualifying_crossings(self, c, before, after)

func _base_is_run_session() -> bool:
	return phase == "qualifying"

func _base_leave_garage(c: RaceCar) -> void:
	RacePitService.leave_garage(self, c)

func _base_update_pit(c: RaceCar, old: Array = []) -> void:
	RacePitService.update_pit(self, c, old)

func _base_pit_exit_message(c: RaceCar) -> String:
	return c.short + " rejoins on cold tyres."

func _base_service_random_value() -> float:
	return random_value()

func _base_begin_service(c: RaceCar) -> void:
	RacePitService.begin_service(self, c)

func _base_complete_service(c: RaceCar) -> void:
	RacePitService.complete_service(self, c)

func _base_plan_pit_gate(c: RaceCar) -> void:
	RacePitService.plan_pit_gate(self, c)

func _base_incident(c: RaceCar) -> void:
	RaceSurface.contaminate(surface, c.distance / track.length, c.lane, tuning.environment.surface.incident.debris, c.health < tuning.environment.surface.incident.oil_health_threshold, tuning.environment.surface.incident)
	stats.incidents += 1
	var outcome = random_value()
	if outcome < tuning.operations.incidents.barrier_probability:
		retire(c, "Barrier impact"); flag = "SAFETY CAR"; flag_until = clock + tuning.operations.control.retired_car_seconds; post("flag", "Safety car deployed for a stranded car.")
	elif outcome < tuning.operations.incidents.legacy_retirement_threshold and c.health < tuning.operations.incidents.legacy_mechanical_health:
		retire(c, "Mechanical failure"); flag = "YELLOW"; yellow_sector = track.sector_at(c.distance); flag_until = clock + tuning.operations.control.legacy_mechanical_seconds
	else:
		c.loss = tuning.operations.incidents.lost_seconds_base + random_value() * tuning.operations.incidents.lost_seconds_span
		c.damage = minf(1000, c.damage + tuning.operations.incidents.damage_base + random_value() * tuning.operations.incidents.damage_span)
		var fitted = TyreInventory.find(c, c.set_id)
		for wheel in WheelTyres.KEYS: fitted.wheels[wheel].life = maxf(0, fitted.wheels[wheel].life - tuning.operations.incidents.tread_loss)
		WheelTyres.publish(fitted); c.tyre = fitted.life; c.temperature = fitted.temperature
		flag = "YELLOW"; yellow_sector = track.sector_at(c.distance); flag_until = clock + tuning.operations.control.local_incident_seconds
		TyreInventory.sync(c)
		post("incident", c.short + " spins. Local yellow; car recovering.")

func _base_retire(c: RaceCar, reason: String) -> void:
	c.dnf = true; c.speed = 0.0; c.retire_reason = reason; c.completed = int(maxf(0, floor(c.distance / track.length)))
	if pit_boxes.get(c.team_identity(), -1) == c.id: pit_boxes.erase(c.team_identity())
	post("retirement", "%s retires: %s." % [c.short, reason])

func _base_snapshot() -> Dictionary:
	var saved_cars = RaceCar.records(cars)
	for car in saved_cars: TyreInventory.sync_record(car)
	var result = {"kind": "motorsport-manager-weekend", "version": 4, "track": track.document.duplicate(true), "vehicle": track.preset, "cars": saved_cars, "phase": phase, "clock": clock, "total_time": total_time, "race_time": race_time, "accumulator": accumulator, "speed": speed, "paused": paused, "laps": laps, "qual_duration": qual_duration, "qual_closed": qual_closed, "scenario": scenario, "intensity": intensity, "rng_state": rng_state, "seed_value": seed_value, "flag": flag, "flag_until": flag_until, "yellow_sector": yellow_sector, "rain": rain, "surface": surface.duplicate(true), "surface_accumulator": surface_accumulator, "water": water.duplicate(), "rubber": rubber.duplicate(), "weather_name": weather_name, "events": events.duplicate(true), "commands": commands.duplicate(true), "pit_boxes": pit_boxes.duplicate(), "chequered": chequered, "finish_count": finish_count, "fastest": fastest, "selected_id": selected_id, "stats": stats.duplicate()}
	if not track.authored_vehicle().is_empty():
		result.vehicle_definition = track.authored_vehicle()
	if roster_definition != null:
		result.roster_definition = roster_definition.to_snapshot()
	if tyre_rules.authored(): result.tyre_definition = tyre_rules.to_snapshot()
	if setup_definition.authored(): result.setup_definition = setup_definition.to_record()
	if tuning.authored(): result.tuning_definition = tuning.to_record()
	if weekend_definition != null: result.weekend_definition = weekend_definition.to_record()
	if mechanic_definition != null: result.mechanic_definition = mechanic_definition.to_record()
	if not performance_profiles.is_empty(): result.performance_profiles = performance_profiles.duplicate(true)
	return result

func _base_update_yield(c: RaceCar, old: Array) -> float:
	# Hysteresis keeps a courtesy manoeuvre stable until the priority car has cleared.
	if neutral(c) or c.route != "track": c.yield_to = -1
	if c.yield_to >= 0:
		var other = cars[c.yield_to]
		var signed_gap = fposmod(old[other.id].distance - old[c.id].distance + track.length * 0.5, track.length) - track.length * 0.5
		if other.dnf or other.finished or old[other.id].route != "track" or signed_gap > 18 or signed_gap < -220 or total_time - c.yield_clock > 20 or is_run_session() and old[other.id].qual_state != "hotlap":
			c.yield_to = -1
	if c.yield_to < 0 and not neutral(c):
		var closest = 150.0
		for other in cars:
			if other.id == c.id or other.dnf or other.finished or old[other.id].route != "track": continue
			var gap = fposmod(old[c.id].distance - old[other.id].distance, track.length)
			var courtesy = is_run_session() and c.qual_state in ["outlap", "inlap"] and old[other.id].qual_state == "hotlap"
			var lapped = phase == "race" and old[other.id].distance - old[c.id].distance > track.length * 0.65
			var closing: float = old[other.id].speed - old[c.id].speed
			if gap > 0.01 and gap < closest and (courtesy or lapped) and closing > -0.5 and (gap < 45 or gap / maxf(0.1, closing) < 7):
				closest = gap; c.yield_to = other.id; c.yield_clock = total_time
				c.yield_side = -1.0 if old[other.id].lane >= 0 else 1.0
	var s = track.sample(c.distance)
	return c.yield_side * maxf(0, s.w * 0.5 - 1.5) if c.yield_to >= 0 else s.line

func _base_pit_status(c: RaceCar) -> String:
	return RacePitService.pit_status(self, c)

func _base_record_stint(c: RaceCar) -> void:
	RacePitService.record_stint(self, c)

func _base_car_advisories(c: RaceCar) -> Array[String]:
	var messages: Array[String] = []
	var item = TyreInventory.find(c, c.set_id)
	for key in WheelTyres.KEYS:
		var wheel = item.wheels[key]
		if wheel.punctured: messages.append("%s PUNCTURE · plan a replacement and box" % key)
		elif wheel.life < 15: messages.append("%s tread low · %.0f%% remaining" % [key, wheel.life])
		elif wheel.core > tyre_rules.spec(c.compound).optimum + 20: messages.append("%s core hot · conserve pace" % key)
	if c.engine_temperature > tuning.condition.heat_reference_c: messages.append("Engine hot · reduce engine mode")
	if c.fuel < maxf(0, laps - c.distance / track.length): messages.append("Fuel projection short · consider economy mode")
	return messages

## Stable aggregate entry points; providers are resolved once at construction.

