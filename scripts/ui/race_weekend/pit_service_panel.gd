class_name RacePitServicePanel
extends VBoxContainer
## Read-only presentation of accepted orders and recorded physical pit visits.
## No queue forecast, progress tween, wheel timer, or command executor lives here.
var model: StrategyRaceSim
var cards: Dictionary = {}
var record_index = 0
var last_record_id = ""
var entries: Dictionary = {}
var visits: Dictionary = {}
var commands: Dictionary = {}

func configure(value: StrategyRaceSim) -> void:
	model = value
	record_index = 0; last_record_id = ""
	entries.clear(); visits.clear(); commands.clear()

func _ready() -> void:
	add_theme_constant_override("separation", 8)
	for id in [3,6]:
		var surface = PitwallDesign.race_panel(false, 8); add_child(surface)
		var body = UI.vbox(surface)
		var heading = UI.hbox(body)
		var name_label = UI.label(model.cars[id].name, 14, UI.INK)
		name_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL; heading.add_child(name_label)
		var state = RaceStatusBadge.new(); heading.add_child(state)
		var route = UI.label("", 11, UI.MUTED); route.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; body.add_child(route)
		var steps=HFlowContainer.new();body.add_child(steps)
		var phases: Dictionary={}
		for phase in ["Approach","Entry","Queue","Service","Exit"]:
			var chip=RaceStatusBadge.new();steps.add_child(chip);chip.present(phase);phases[phase.to_upper()]=chip
		var progress=ProgressBar.new();progress.step=0.0;progress.custom_minimum_size.y=7;progress.show_percentage=false;progress.mouse_filter=Control.MOUSE_FILTER_IGNORE
		progress.add_theme_stylebox_override("background",UI.box(UI.CARD,UI.LINE,2,0));progress.add_theme_stylebox_override("fill",UI.box(UI.GOOD,UI.GOOD,2,0));body.add_child(progress)
		var detail = UI.paragraph(""); body.add_child(detail)
		cards[id] = {"state":state,"route":route,"detail":detail,"phases":phases,"progress":progress}
	var note = UI.paragraph("Service is recorded for the whole car. Individual wheel-service progress is not measured. A forecast is not a timer.")
	note.add_theme_font_size_override("font_size", 11); add_child(note)
	present()

func update_records() -> void:
	var records = model.strategy_state.records
	if record_index > records.size() or (record_index > 0 and str(records[record_index - 1].id) != last_record_id):
		record_index = 0; entries.clear(); visits.clear(); commands.clear()
	for index in range(record_index, records.size()):
		var event = records[index]; var id = int(event.driver_id)
		if id not in [3,6]: continue
		if event.kind == "pit_entry": entries[id] = event.duplicate(true)
		elif event.kind == "pit_exit":
			var entry = entries.get(id, {})
			# A prior pit count or unrelated exit never completes the current order.
			if not entry.is_empty() and event.related_id == entry.id:
				visits[id] = {"entry":entry, "exit":event.duplicate(true)}
		elif event.kind == "command" and event.evidence.get("action") in ["pit","schedule_pit","cancel_pit","cancel_schedule"]:
			commands[id] = event.duplicate(true)
	record_index = records.size()
	last_record_id = "" if records.is_empty() else str(records.back().id)

func describe(id: int) -> Dictionary:
	update_records()
	var c = model.cars[id]; var policy = model.policy(id)
	if model.phase not in ["race", "results"]:
		return {"stage":"NOT APPLICABLE", "text":"Race pit service is not active in this session. Garage fitting and qualifying/practice pit transit are not race pit visits.", "remaining":-1.0,"duration":0.0,"exit_id":"","visit_seconds":-1.0}
	var job: Dictionary = model.reliability(id).service if model is RecoveryRaceSim else {}
	var visit = visits.get(id, {})
	var recent_command = commands.get(id, {})
	var stage = "NO STOP"
	if c.route == "pit":
		stage = "ENTRY"
		if c.pit_stage == "service": stage = "SERVICE"
		elif c.pit_stage == "exit": stage = "EXIT"
		elif c.intent.contains("queue") or c.intent.contains("Waiting for teammate"): stage = "QUEUE"
	elif c.pit_order: stage = "APPROACH"
	elif not recent_command.is_empty() and recent_command.evidence.action in ["cancel_pit","cancel_schedule"] and (visit.is_empty() or recent_command.time >= visit.exit.time): stage = "CANCELED"
	elif not visit.is_empty(): stage = "COMPLETE"
	if (c.dnf or c.finished or model.phase != "race") and stage in ["APPROACH","ENTRY","QUEUE","SERVICE","EXIT"]: stage = "INTERRUPTED"
	var detail: Array[String] = []
	var planned = TyreInventory.planned(c, true)
	detail.append("Fitted %s · Pit owner %s" % [c.set_id, policy.owners.pit])
	if stage == "APPROACH":
		detail.append("Accepted for gate %.2f distance laps%s. Cancel is still available." % [c.pit_gate / model.track.length, " · deferred" if c.pit_deferred else ""])
		detail.append("Planned %s · %s" % [planned.get("id", "unavailable"), "repair requested" if c.repair else "no repair requested"])
	elif stage in ["ENTRY","QUEUE"]:
		detail.append(c.intent + ". Cancellation is closed after entry.")
		detail.append("Locked selection %s; service freezes on arrival at the box." % planned.get("id", "unavailable"))
		if stage == "QUEUE": detail.append("Waiting is observed now; separate queue duration is not recorded.")
	elif stage in ["SERVICE","EXIT"]:
		var repair_only = bool(job.get("repair_only", false))
		detail.append("Frozen service · %s · %s" % ["retain fitted " + str(job.get("set_before", c.set_id)) if repair_only else str(c.service_set_id), "scalar repair" if job.get("repair", c.service_repair) else "tyres only"])
		if stage == "SERVICE":
			detail.append("Remaining %.1fs · %s" % [maxf(0, c.pit_timer), "elapsed %.1fs of %.1fs service timer" % [maxf(0, float(job.duration) - maxf(0,c.pit_timer)), job.duration] if job.has("duration") else "elapsed duration unavailable"])
		else: detail.append(c.intent + ". Rejoin is still physical; service completion is not pit exit.")
	if not policy.visit.is_empty(): detail.append("Pit visit elapsed %.1fs since recorded entry" % maxf(0, model.total_time - float(policy.visit.entered_at)))
	if stage == "CANCELED": detail.append("Order canceled before entry. No service outcome is claimed.")
	if stage == "INTERRUPTED":
		detail.append(("Car retired" if c.dnf else "Race ended") + (" before pit entry; the order did not execute." if c.route != "pit" else " during the visit; no completed exit is recorded."))
	if not visit.is_empty():
		var measured = visit.exit.evidence
		detail.append("Last completed visit · %.2fs measured · %s" % [measured.visit_seconds, measured.fitted_set])
		if measured.has("predicted_low") and measured.has("predicted_high"):
			detail.append("Estimate at acceptance %.1f–%.1fs; not a new prediction." % [measured.predicted_low, measured.predicted_high])
	if stage == "NO STOP": detail.append("No accepted physical stop. Approved windows remain separate under Team / Plans.")
	return {"stage":stage,"text":"\n".join(detail),"remaining":maxf(0,c.pit_timer) if stage == "SERVICE" else -1.0,
		"duration":float(job.get("duration",0)),
		"exit_id":visit.exit.id if not visit.is_empty() else "", "visit_seconds":float(visit.exit.evidence.visit_seconds) if not visit.is_empty() else -1.0}

func present() -> void:
	if cards.is_empty(): return
	for id in cards:
		var state = describe(id)
		cards[id].state.present(state.stage, "warning" if state.stage in ["QUEUE","INTERRUPTED"] else "info")
		cards[id].route.text = "PHYSICAL VISIT · " + state.stage.to_lower()
		for phase in cards[id].phases:
			cards[id].phases[phase].present(("› " if state.stage==phase else "")+phase,"info" if state.stage==phase else "neutral")
		cards[id].progress.visible=state.stage=="SERVICE" and state.duration>0
		if cards[id].progress.visible:
			cards[id].progress.value=clampf(100.0*(1.0-state.remaining/state.duration),0,100)
			cards[id].progress.accessibility_name="Whole-car service timer · %.1fs remaining of %.1fs"%[state.remaining,state.duration]
		cards[id].detail.text = state.text
		cards[id].detail.accessibility_description = state.text
