class_name RacePitService
extends RefCounted
## Physical pit entry, shared service, fitting and exit. Keeps finite stock and physical queues authoritative.
## Invoke cross-system work through the aggregate so inherited rule-set hooks remain active.

static func leave_garage(sim: RaceSim, car: Dictionary) -> void:
	sim.depart_on_planned_set(car)

static func update_pit(sim: RaceSim, car: Dictionary, old: Array = []) -> void:
	var before = car.distance
	var previous_pit_d = car.pit_d
	car.intent = ("Crew fitting tyres and repairing damage" if car.service_repair else "Crew fitting tyres") if car.pit_stage == "service" else "Pit lane · speed limiter active"
	if car.pit_stage == "entry" and car.pit_d >= car.box_d:
		car.pit_d = car.box_d
		car.speed = 0.0
		if sim.is_run_session():
			car.route = "garage"
			car.qual_state = "garage"
			car.next_qual = sim.clock + 18
			car.pit_stage = ""
			sim.post(sim.phase, car.short + " back in the garage.")
			return
		if not sim.pit_boxes.has(car.team):
			sim.pit_boxes[car.team] = car.id
			car.pit_stage = "service"
			sim.begin_service(car)
		else:
			car.intent = "Waiting for teammate's pit box"
			return
	if car.pit_stage == "service":
		car.speed = 0.0
		car.pit_timer -= RaceSim.STEP
		if car.pit_timer <= 0:
			sim.complete_service(car)
			car.pit_stops += 1
			sim.stats.pits += 1
			car.pit_stage = "exit"
			sim.pit_boxes.erase(car.team)
			sim.post("pit", "%s serviced · %s tyres." % [car.short, car.compound])
		return
	var target = sim.track.pit_limit
	if car.pit_stage == "entry":
		target = minf(target, sqrt(2 * 8 * maxf(0, car.box_d - car.pit_d)))
	car.speed = move_toward(car.speed, target, RaceSim.STEP * (5 if target > car.speed else 8))
	var next = minf(sim.track.pit_length, car.pit_d + car.speed * RaceSim.STEP)
	if car.pit_stage == "entry":
		next = minf(next, car.box_d)
	# Use the same pre-tick snapshot as on-track movement. Do not step through a queue.
	for other in sim.cars:
		if other.id == car.id or other.dnf:
			continue
		var state: Dictionary = old[other.id] if old.size() == sim.cars.size() else other
		if state.route != "pit" or state.pit_stage == "service":
			continue
		var gap: float = state.pit_d - previous_pit_d
		if gap > 0.001 and gap < 30:
			var limit: float = state.pit_d - 6.5
			if next > limit:
				next = maxf(previous_pit_d, limit)
				car.speed = maxf(0, (next - previous_pit_d) / RaceSim.STEP)
				car.intent = "Pit lane · queue ahead"
	if next >= sim.track.pit_length:
		var safe = true
		for other in sim.cars:
			if other.id != car.id and other.route == "track" and not other.dnf and not other.finished:
				var behind = fposmod(sim.track.pit_exit - other.distance, sim.track.length)
				if behind < maxf(15, other.speed * 1.2) or sim.track.length - behind < 8:
					safe = false
		if not safe:
			car.speed = 0.0
			car.intent = "Pit exit · waiting for safe gap"
			return
	car.pit_d = next
	sim.wear_car(car, maxf(0, next - previous_pit_d), int(fposmod(car.distance / sim.track.length, 1) * 96))
	car.distance = car.pit_cycle * sim.track.length + sim.track.pit_entry + (sim.track.pit_exit - sim.track.pit_entry) * car.pit_d / sim.track.pit_length
	if sim.phase == "race":
		sim.race_crossings(car, before, car.distance)
	if next >= sim.track.pit_length:
		car.route = "track"
		car.pit_stage = ""
		car.pit_order = false
		car.pit_gate = -1.0
		car.pit_deferred = false
		car.lane = sim.track.sample(car.distance).line
		sim.post("pit", sim.pit_exit_message(car))

static func begin_service(sim: RaceSim, car: Dictionary) -> void:
	var item = TyreInventory.planned(car, true)
	car.service_set_id = item.get("id", "")
	car.service_compound = car.next_compound
	car.service_repair = car.repair
	car.pit_timer = 3.0 + sim.service_random_value() * 1.5 + (car.damage * 0.14 if car.service_repair else 0.0)

static func complete_service(sim: RaceSim, car: Dictionary) -> void:
	if not car.service_set_id.is_empty():
		TyreInventory.mount(car, car.service_set_id)
	else:
		sim.post("pit", car.short + ": no replacement available; retaining the current tyres.")
	sim.record_stint(car)
	car.next_set_id = ""
	car.scheduled_lap = -1
	if car.service_repair:
		car.damage = 0.0

static func queue_pit(sim: RaceSim, car: Dictionary) -> void:
	car.pit_order = true
	sim.plan_pit_gate(car)

static func plan_pit_gate(sim: RaceSim, car: Dictionary) -> void:
	car.pit_deferred = false
	car.pit_gate = (floor((car.distance - sim.track.pit_entry) / sim.track.length) + 1) * sim.track.length + sim.track.pit_entry
	var stopping = maxf(0, car.speed ** 2 - sim.track.pit_limit ** 2) / (2 * TrackGeometry.PRESETS[sim.track.preset].brake * 0.5) + 8
	if car.pit_gate - car.distance < stopping:
		car.pit_gate += sim.track.length
		car.pit_deferred = true
		sim.post("pit", car.short + ": too late to brake safely; pit entry deferred one lap.")

static func record_stint(sim: RaceSim, car: Dictionary) -> void:
	var lap = maxf(0, car.distance / sim.track.length)
	if not car.stints.is_empty():
		car.stints.back().to = lap
	if car.stints.size() < 110:
		car.stints.append({"set_id": car.set_id, "from": lap, "to": -1.0})

static func pit_status(sim: RaceSim, car: Dictionary) -> String:
	if car.route == "pit":
		if car.pit_stage == "service":
			return "Fitting %s · %.1f s remaining\n%s" % [car.service_compound, maxf(0, car.pit_timer), "Repairs included" if car.service_repair else "Tyres only"]
		return car.intent
	if not car.pit_order:
		return "No pit stop ordered"
	return "%s · entry in %.2f lap" % [("Scheduled lap %d" % car.scheduled_lap) if car.scheduled_lap > 0 else "Deferred to next entry" if car.pit_deferred else "Pit crew ready", maxf(0, car.pit_gate - car.distance) / sim.track.length]
