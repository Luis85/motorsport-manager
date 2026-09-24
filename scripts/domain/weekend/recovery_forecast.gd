class_name RecoveryForecast
extends RefCounted
## Observation-only recovery comparison. Never receives reliability RNG or failure thresholds.
const VERSION = 1

static func evaluate(source: Dictionary, observed: Dictionary) -> Dictionary:
	var s = source.duplicate(true)
	var item = RaceForecaster.set_by_id(s, s.own.starting_set)
	var current_lap = RaceForecaster.lap_time(s, item, item.life)
	var protect = s.duplicate(true); protect.own.engine = 0
	var protected_lap = RaceForecaster.lap_time(protect, item, item.life)
	var repaired = s.duplicate(true); repaired.own.damage = 0.0
	var repaired_lap = RaceForecaster.lap_time(repaired, item, item.life)
	var pit_source = s.duplicate(true); pit_source.own.repair = true
	pit_source.model_context.repair_only = true
	var pit = RaceForecaster.pit_prediction(pit_source)
	var remaining = maxf(0, s.laps - maxf(0, s.own.distance / s.length))
	var gain_per_lap = maxf(0, current_lap - repaired_lap)
	var usable = WheelTyres.usable(item) and RaceForecaster.limiting_life(item, item.life) >= 10
	var available = s.phase == "race" and s.own.route == "track" and not s.own.pit_order and s.gate.distance < s.laps * s.length and s.own.damage > 0 and usable and not s.own.get("dnf", false) and not s.own.get("finished", false)
	var reason = "A repair-only stop keeps the fitted set. It cannot fix a puncture or exhausted wheel."
	if s.own.get("dnf", false) or s.own.get("finished", false): reason = "This car is no longer racing; no recovery order can be issued."
	elif s.own.pit_order: reason = "An accepted stop already exists. Cancel it before choosing a different transaction."
	elif s.gate.distance >= s.laps * s.length: reason = "No safe pit entry remains before the finish."
	elif s.own.damage <= 0: reason = "No repairable scalar damage is present; health loss is not repaired in the pit lane."
	elif s.phase != "race" or s.own.route != "track": reason = "Recovery pit calls require a car racing on track."
	var payback = pit.loss / gain_per_lap if gain_per_lap > 0.01 else -1.0
	return {"version": VERSION, "driver_id": int(s.own.id), "time": s.time, "key": s.key, "observed": observed.duplicate(true),
		"gate": s.gate, "pit": pit, "repair_available": available, "unavailable_reason": "" if available else reason,
		"remaining_laps": remaining, "current_lap": current_lap, "protected_lap": protected_lap, "repaired_lap": repaired_lap,
		"repair_seconds": s.own.damage * RaceReliability.REPAIR_SECONDS_PER_DAMAGE,
		"gain_per_lap": gain_per_lap, "payback_laps": payback, "resource_risk": "high" if not usable or s.fuel_margin < 0 else "not currently critical",
		"limitations": "Lap comparisons hold current tyres, heat, health, traffic assumptions and flag constant; later stops and future faults are not predicted. Payback is a break-even estimate, not a winning strategy. Engine saving reduces future exposure gradually. Repair removes scalar damage only, takes manual pit ownership and does not replenish health or tyre life. Re-approve any remaining windows afterward."}
