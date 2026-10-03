class_name StrategyWeekendControls
extends WeekendView
## A playable strategy surface around the existing native pit wall, not another simulation.
var strategy_model: RaceViewQuery
var strategy_desk: StrategyDesk
var rejoin_overlay: RejoinOverlay
var forecast_cache: Dictionary = {}
var decision_controls: Dictionary = {}
var decision_bar: HBoxContainer
var debrief_text: Label
var debrief_sequence = -1
var team_panel: TeamOrdersPanel
var battle_overlay: BattleOverlay
var team_summary_label: Label


func update_more_actions(id: int) -> void:
	if not decision_controls.has(id):
		return
	var c = sim.car(id)
	var live = sim.phase == "race" and not c.dnf and not c.finished
	var popup = decision_controls[id].more.get_popup()
	popup.set_item_disabled(popup.get_item_index(0), not live)
	popup.set_item_disabled(
		popup.get_item_index(1), not live or not c.pit_order or c.route != "track"
	)


func open_strategy(id: int) -> void:
	select_driver(id)
	open_topic(6)
	strategy_desk.select_driver(id)
	strategy_desk.show_topic(0)


func targeted_command(action: String, payload: Dictionary) -> void:
	if not commands.execute(action, payload):
		feedback(strategy_model.last_error)
	else:
		var id = int(payload.get("id", sim.player_ids()[0]))
		feedback(
			(
				"%s · %s accepted%s"
				% [
					sim.car(id).short,
					action.replace("_", " "),
					(
						" · deferred to the next safe entry"
						if action == "pit" and sim.car(id).pit_deferred
						else ""
					)
				]
			)
		)
	forecast_cache.clear()
	refresh()


func box_from_card(id: int) -> void:
	if not forecast_cache.has(id):
		return
	var f = forecast_cache[id]
	targeted_command(
		"pit",
		{
			"id": id,
			"forecast_key": f.key,
			"forecast_time": f.time,
			"expected_gate": f.gate.distance,
			"set_id": f.replacement_id
		}
	)


func keep_plan(id: int) -> void:
	var card = decision_controls[id].card
	if card.is_empty():
		return
	targeted_command("hold_decision", {"id": id, "issue": card.issue, "key": card.key})


func select_driver(id: int) -> void:
	super.select_driver(id)
	if strategy_desk and id in sim.player_ids():
		strategy_desk.select_driver(id)


func export_evidence() -> void:
	UI.file_dialog(
		self,
		true,
		PackedStringArray(["*.json ; Race decision evidence"]),
		func(path):
			var error = presentation_services.export_value(
				path,
				{
					"kind": "motorsport-manager-decision-evidence",
					"version": 1,
					"track": sim.track.document.name,
					"seed": sim.seed_value,
					"phase": sim.phase,
					"journal": strategy_model.strategy_state.duplicate(true)
				}
			)
			feedback("Decision evidence exported." if error.is_empty() else error),
	)


func setup_guide() -> void:
	guide = ContextGuide.new()
	guide.presentation_services = presentation_services
	guide.configure(
		"pit wall",
		[
			{
				"title": "Your objective and your two cars",
				"body":
				(
					"Bring both of your entered cars home. Your drivers have separate plans and "
					+ "control owners. Both cards stay visible when you inspect a rival. This guide "
					+ "does not pause the race; use Space for reading time."
				),
				"target": func(): return teammate_buttons[0].get_parent(),
				"reveal": func(): open_strategy(sim.player_ids()[0])
			},
			{
				"title": "Read a decision before reacting",
				"body":
				(
					"A card connects a current issue to evidence, a trade-off and a deadline. "
					+ "Compare opens details. Keep plan acknowledges the issue without changing an "
					+ "order. No alert changes your speed or pauses automatically."
				),
				"target": func(): return decision_bar
			},
			{
				"title": "Compare, then commit",
				"body":
				(
					"Pit loss, warm-up and possible rejoin traffic are estimates, not promises. A "
					+ "forecast Box call names the driver, set and safe gate. It is rejected if the "
					+ "displayed assumptions become stale."
				),
				"target": func(): return tabs,
				"reveal": func(): open_strategy(sim.player_ids()[0])
			},
			{
				"title": "Approve a plan, not a teleport",
				"body":
				(
					"In Plan, choose a starting set and up to three windows. Draft edits do nothing "
					+ "until Approve. Approval delegates pit timing inside those windows; physical "
					+ "entry, inventory and the shared box still govern execution."
				),
				"target": func(): return tabs,
				"reveal": _reveal_plan_guide
			},
			{
				"title": "Delegate the work, retain intent",
				"body":
				(
					"Control separates pace, engine, pit strategy, racecraft and qualifying. A "
					+ "two-lap push returns to the prior owner automatically. It does not disable fuel "
					+ "protection or replace a pit plan."
				),
				"target": func(): return tabs,
				"reveal": _reveal_guide_0
			},
			{
				"title": "Two drivers, one team",
				"body":
				(
					"Team & battles provides bounded hold, allow-through and pit-priority "
					+ "instructions. Both drivers are named. Safe road geometry, flags and physical "
					+ "pit commitments take precedence. Battles retain a target and phases; Watch "
					+ "follows the selected contest until you pan or zoom."
				),
				"target": func(): return tabs,
				"reveal": func(): open_topic(8)
			},
			{
				"title": "Learn from measured consequences",
				"body":
				(
					"The debrief records accepted calls and measured pit visits. It compares actual "
					+ "duration with the estimate recorded at the call. No hypothetical finishing "
					+ "position is claimed as fact. Export keeps the full evidence."
				),
				"target": func(): return tabs,
				"reveal": func(): open_topic(7)
			}
		]
	)
	add_child(guide)


func _unhandled_key_input(event: InputEvent) -> void:
	if event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_B:
		var focus = get_viewport().gui_get_focus_owner()
		if focus is LineEdit or focus is TextEdit:
			return
		if (
			sim.selected_id in decision_controls
			and not decision_controls[sim.selected_id].box.disabled
		):
			box_from_card(sim.selected_id)
			get_viewport().set_input_as_handled()
		return
	super._unhandled_key_input(event)


func _reveal_guide_0() -> void:
	open_strategy(sim.player_ids()[0])
	strategy_desk.show_topic(2)


func _reveal_plan_guide() -> void:
	open_strategy(sim.player_ids()[0])
	strategy_desk.show_topic(1)
