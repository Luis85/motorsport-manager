class_name CarSetup
extends RefCounted
## Five prototype controls. These bounded effects are game models, not vehicle homologation.
const DEFAULTS = LegacySetupContent.DEFAULTS
const SPECS = LegacySetupContent.SPECS

static func initialize_record(car: Dictionary, definition: SetupDefinition = null) -> void:
	if definition == null: definition = SetupDefinition.legacy()
	car.car_setup = definition.defaults().duplicate()
	if not definition.authored(): car.car_setup.wing = int(car.get("setup", 5))
	car.setup = int(car.car_setup.wing)
	car.battle_mode = "balanced"; car.engine_temperature = float(definition.initial_temperatures().engine_c); car.brake_temperature = float(definition.initial_temperatures().brake_c)
	car.tyre_event_clock = 0.0

static func valid(car: Dictionary, definition: SetupDefinition = null) -> bool:
	if definition == null: definition = SetupDefinition.legacy()
	if not definition.valid_values(car.get("car_setup")): return false
	if car.get("battle_mode") not in ["patient", "balanced", "assertive"]: return false
	if not TrackDocument.valid_number(car.get("engine_temperature"), 0, 200) or not TrackDocument.valid_number(car.get("brake_temperature"), 0, 1500): return false
	return TrackDocument.valid_number(car.get("tyre_event_clock"), 0, 100000000) and car.car_setup.wing == car.setup

static func effects(car: RaceCar, wetness: float = 0.0) -> Dictionary:
	var s = car.car_setup
	var e = car.setup_definition.effects()
	var item = TyreInventory.find(car, car.set_id)
	var front = (WheelTyres.grip_wheel(item.wheels.FL, car.compound, car.tyre_rules.spec(car.compound)) + WheelTyres.grip_wheel(item.wheels.FR, car.compound, car.tyre_rules.spec(car.compound))) * 0.5
	var rear = (WheelTyres.grip_wheel(item.wheels.RL, car.compound, car.tyre_rules.spec(car.compound)) + WheelTyres.grip_wheel(item.wheels.RR, car.compound, car.tyre_rules.spec(car.compound))) * 0.5
	var balance = -s.balance * e.balance_gain + (rear - front) * e.wheel_balance_gain + (s.bias - e.bias_centre) * e.braking_balance_gain * car.braking
	return {"corner": clampf(1 + (s.wing - e.wing_centre) * e.wing_corner_gain + (s.suspension - e.suspension_centre) * e.suspension_corner_gain * (1 - wetness * e.wet_suspension_factor) - absf(balance) * e.corner_balance_loss, e.corner_min, e.corner_max),
		"straight": 1 - (s.wing - e.wing_centre) * e.wing_drag_loss - (s.cooling - e.cooling_centre) * e.cooling_drag_loss,
		"brake": clampf(1 - absf(s.bias - (e.bias_centre + clampf((rear - front) * e.wheel_bias_gain, -e.wheel_bias_limit, e.wheel_bias_limit))) * e.bias_brake_loss, e.brake_min, 1),
		"traction": clampf(1 + minf(0, s.suspension - e.suspension_centre) * e.suspension_traction_gain - maxf(0, -balance) * e.balance_traction_loss, e.traction_min, e.traction_max),
		"balance": balance, "front": front, "rear": rear}
