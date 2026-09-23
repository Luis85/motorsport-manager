class_name CarSetup
extends RefCounted
## Five prototype controls. These bounded effects are game models, not vehicle homologation.
const DEFAULTS = {"wing": 5, "balance": 0, "suspension": 5, "cooling": 5, "bias": 56}
const SPECS = {
	"wing": [1, 9, "Wing level", "More cornering support; less straight-line speed."],
	"balance": [-3, 3, "Aero balance", "Forward balance helps turn-in; rearward balance supports traction."],
	"suspension": [1, 9, "Suspension", "Firm supports dry corners; soft tolerates wet and uneven loading."],
	"cooling": [1, 9, "Cooling aperture", "More airflow reduces engine heat at a drag cost."],
	"bias": [52, 62, "Front brake bias %", "Moves braking load between axles. Adjustable during the race."]}

static func initialize(car: Dictionary) -> void:
	car.car_setup = DEFAULTS.duplicate(); car.car_setup.wing = int(car.get("setup", 5))
	car.battle_mode = "balanced"; car.engine_temperature = 85.0; car.brake_temperature = 140.0
	car.tyre_event_clock = 0.0

static func valid(car: Dictionary) -> bool:
	if not car.get("car_setup") is Dictionary or car.car_setup.size() != 5: return false
	for key in SPECS:
		if not RaceCheckpoint.integral(car.car_setup.get(key), SPECS[key][0], SPECS[key][1]): return false
	if car.get("battle_mode") not in ["patient", "balanced", "assertive"]: return false
	if not TrackDocument.valid_number(car.get("engine_temperature"), 0, 200) or not TrackDocument.valid_number(car.get("brake_temperature"), 0, 1500): return false
	return TrackDocument.valid_number(car.get("tyre_event_clock"), 0, 100000000) and car.car_setup.wing == car.setup

static func effects(car: Dictionary, wetness: float = 0.0) -> Dictionary:
	var s = car.car_setup
	var item = TyreInventory.find(car, car.set_id)
	var front = (WheelTyres.grip_wheel(item.wheels.FL, car.compound) + WheelTyres.grip_wheel(item.wheels.FR, car.compound)) * 0.5
	var rear = (WheelTyres.grip_wheel(item.wheels.RL, car.compound) + WheelTyres.grip_wheel(item.wheels.RR, car.compound)) * 0.5
	var balance = -s.balance * 0.016 + (rear - front) * 0.34 + (s.bias - 56) * 0.004 * car.braking
	return {"corner": clampf(1 + (s.wing - 5) * 0.012 + (s.suspension - 5) * 0.003 * (1 - wetness * 2) - absf(balance) * 0.12, 0.88, 1.12),
		"straight": 1 - (s.wing - 5) * 0.007 - (s.cooling - 5) * 0.002,
		"brake": clampf(1 - absf(s.bias - (56 + clampf((rear - front) * 12, -2, 2))) * 0.010, 0.9, 1),
		"traction": clampf(1 + minf(0, s.suspension - 5) * 0.008 - maxf(0, -balance) * 0.25, 0.91, 1.02),
		"balance": balance, "front": front, "rear": rear}
