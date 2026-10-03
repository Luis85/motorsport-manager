extends SceneTree
## Commands, persistence, information fairness and actual physical execution.
var checks = 0
var failures: Array[String] = []
var base: Dictionary


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)


func fresh() -> PracticeRaceSim:
	return PracticeRaceSim.restore_practice(base)


func json_copy(value):
	return JSON.parse_string(JSON.stringify(value, "", false, true))


func draft(sim, kind: String = "undercut") -> Dictionary:
	var p = TacticalForecast.draft(sim, 3, kind)
	p.authority = "execute"
	p.avoid_traffic = false
	p.tyre_floor = 5.0
	p.fuel_reserve = 0.0
	p.target_id = 0
	return p


func approval(sim, plan: Dictionary, id: int = 3) -> Dictionary:
	var f = TacticalForecast.preview(sim, id, plan)
	return {
		"id": id,
		"plan": plan,
		"revision": sim.duel_state.drivers[id].revision,
		"policy_revision": sim.policy(id).revision,
		"key": f.key,
		"time": f.time
	}


func advance(sim, phase: String, limit: int) -> bool:
	for i in range(limit):
		if sim.phase == phase:
			return true
		sim.step()
	return sim.phase == phase
