class_name TeamOrdersPanel
extends VBoxContainer
## Stable native controls: changing a selection is a draft, never a team instruction.
signal command_requested(action: String, payload: Dictionary)
signal watch_requested(driver_id: int)
var sim: StrategyRaceSim
var topics: OptionButton
var topic_bar: HBoxContainer
var commit_bar: VBoxContainer
var commit_pages: Array[Control] = []
var topic_buttons: Array[Button] = []
var pages: Array[Control] = []
var actor: OptionButton
var kind: OptionButton
var duration: SpinBox
var apply_button: Button
var validation: Label
var track_status: Label
var priority_status: Label
var preview_text: Label
var cancel_buttons: Dictionary = {}
var priority_buttons: Dictionary = {}
var battle_labels: Dictionary = {}
var watch_buttons: Dictionary = {}
var public_stops: Label
var revision = 0
var rendered_orders: Dictionary = {}
var driver_summaries: Dictionary = {}

func configure(value: StrategyRaceSim) -> void:
	sim = value

func text(value: String, color: Color = UI.MUTED) -> Label:
	var label = UI.paragraph(value, color); label.add_theme_font_size_override("font_size", 12)
	return label

func _ready() -> void:
	add_theme_constant_override("separation", 7)
	topics = UI.option(["Cooperate", "Battles", "Shared pit box"], show_topic)
	add_child(topics); topics.visible = false
	topic_bar = UI.hbox(self)
	for i in range(3):
		var button = UI.button(["Cooperate", "Battles", "Pit box"][i], func(): show_topic(i)); button.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		topic_bar.add_child(button); topic_buttons.append(button); StrategyDesk.compact_button(button)
	StrategyDesk.compact_button(topics); topics.add_theme_font_size_override("font_size", 12)
	for i in range(3):
		var page = UI.vbox(self); page.add_theme_constant_override("separation", 7); pages.append(page)
	commit_bar = UI.vbox(self)
	for i in range(3): commit_pages.append(UI.vbox(commit_bar))
	var people=UI.hbox(self);move_child(people,0)
	for id in [3,6]:
		var panel=PitwallDesign.race_panel(false,8);panel.size_flags_horizontal=Control.SIZE_EXPAND_FILL;people.add_child(panel)
		var body=UI.vbox(panel)
		body.add_child(UI.label(sim.cars[id].short+" / "+sim.cars[id].name.get_slice(" ",1),14,UI.INK))
		var value=UI.paragraph("");body.add_child(value);driver_summaries[id]=value
	var page = pages[0]
	actor = UI.option(["MER ahead · MOR following", "MOR ahead · MER following"], func(_index): refresh()); page.add_child(actor); StrategyDesk.compact_button(actor); actor.add_theme_font_size_override("font_size", 12)
	kind = UI.option(["Hold relative team position", "Allow the teammate through"], func(_index): refresh()); page.add_child(kind); StrategyDesk.compact_button(kind); kind.add_theme_font_size_override("font_size", 12)
	duration = UI.spin(1, 1, 5, 1, func(_value): refresh()); duration.custom_minimum_size = Vector2(72, 30)
	duration.get_line_edit().add_theme_font_size_override("font_size", 12)
	duration.get_line_edit().add_theme_stylebox_override("normal", UI.box(UI.CARD, UI.LINE, 4, 6))
	UI.field(page, "Expiry (actor's laps)", duration)
	apply_button = UI.button("Apply team instruction", func(): command_requested.emit("team_order", draft()))
	commit_pages[0].add_child(apply_button); StrategyDesk.compact_button(apply_button)
	validation = text(""); page.add_child(validation)
	track_status = text("", UI.INK); page.add_child(track_status)
	cancel_buttons.track_order = UI.button("Cancel cooperation", func(): cancel("track_order")); commit_pages[0].add_child(cancel_buttons.track_order); StrategyDesk.compact_button(cancel_buttons.track_order)
	
	page = pages[1]
	var watch_row = UI.hbox(commit_pages[1])
	for id in [3, 6]:
		page.add_child(UI.label(sim.cars[id].short + " / CURRENT CONTEST", 11, UI.ACCENT))
		battle_labels[id] = text("", UI.INK); page.add_child(battle_labels[id])
		var button = UI.button("Watch " + sim.cars[id].short, func(): watch_requested.emit(id))
		watch_row.add_child(button); StrategyDesk.compact_button(button); watch_buttons[id] = button
	
	public_stops = text(""); page.add_child(public_stops)
	page = pages[2]
	page.add_child(text("Two-lap priority · accepted stops are never reordered."))
	var priorities = UI.hbox(commit_pages[2])
	for id in [3, 6]:
		var button = UI.button(sim.cars[id].short + " first", func():
			command_requested.emit("team_order", {"id": id, "teammate_id": 6 if id == 3 else 3, "kind": "pit_priority", "laps": 2, "revision": revision}))
		priorities.add_child(button); button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; StrategyDesk.compact_button(button); priority_buttons[id] = button
	preview_text = text("", UI.INK); page.add_child(preview_text)
	priority_status = text(""); page.add_child(priority_status)
	cancel_buttons.pit_priority = UI.button("Cancel pit priority", func(): cancel("pit_priority")); commit_pages[2].add_child(cancel_buttons.pit_priority); StrategyDesk.compact_button(cancel_buttons.pit_priority)
	
	show_topic(0); refresh()

func show_topic(index: int) -> void:
	for i in range(pages.size()):
		pages[i].visible = i == index; commit_pages[i].visible = i == index
		UI.set_active(topic_buttons[i], i == index)
	if topics: topics.select(index)
	refresh()

func draft() -> Dictionary:
	var id = 3 if actor.selected == 0 else 6
	return {"id": id, "teammate_id": 6 if id == 3 else 3, "kind": "hold" if kind.selected == 0 else "yield", "laps": int(duration.value), "revision": revision}

func cancel(key: String) -> void:
	var record = rendered_orders.get(key, {})
	if record.is_empty(): return
	command_requested.emit("cancel_team_order", {"id": record.actor_id, "slot": key, "intent_id": record.intent_id, "revision": revision})

func status_text(record: Dictionary, empty: String) -> String:
	if record.is_empty(): return empty
	var result = "%s / %s → %s\n%s" % [str(record.status).capitalize(), sim.cars[int(record.actor_id)].short, sim.cars[int(record.teammate_id)].short, record.reason]
	if TeamOrders.active(record): result += "\nExpires in ~%.1f laps of %s." % [maxf(0, record.until_distance - sim.cars[int(record.actor_id)].distance) / sim.track.length, sim.cars[int(record.actor_id)].short]
	return result

func refresh() -> void:
	if not is_node_ready() or sim == null or apply_button == null: return
	for id in driver_summaries:
		var c=sim.cars[id];var policy=sim.policy(id)
		driver_summaries[id].text="%s\nPit owner: %s\n%s" % [c.intent,policy.owners.pit,"In pit lane" if c.route=="pit" else "Pit order accepted" if c.pit_order else "No pit order"]
	revision = int(sim.team_state.revision)
	rendered_orders = {"track_order": sim.team_state.track_order.duplicate(true), "pit_priority": sim.team_state.pit_priority.duplicate(true)}
	var proposed = draft(); var error = TeamOrders.validate(sim, proposed)
	apply_button.text = ("Hold %s ahead of %s" if proposed.kind == "hold" else "Let %s yield to %s") % [sim.cars[proposed.id].short, sim.cars[proposed.teammate_id].short]
	apply_button.disabled = not error.is_empty(); apply_button.tooltip_text = error
	validation.text = error if not error.is_empty() else ("Only the following teammate holds back; rivals remain free to race." if proposed.kind == "hold" else "Waits for clear, wide road. Moving aside and slowing have a real cost; a swap is not guaranteed.")
	track_status.text = status_text(sim.team_state.track_order, "No cooperation instruction. Both drivers follow their normal racecraft policies.")
	priority_status.text = status_text(sim.team_state.pit_priority, "No priority. Physical arrival decides the shared box.")
	for key in cancel_buttons:
		cancel_buttons[key].disabled = not TeamOrders.active(sim.team_state[key])
		cancel_buttons[key].visible = not sim.team_state[key].is_empty()
		cancel_buttons[key].tooltip_text = "Cancel only an active instruction. Completed or canceled outcomes remain in the debrief."
	for id in [3, 6]:
		battle_labels[id].text = RacecraftController.describe(sim.battle_state, id, sim.cars)
		watch_buttons[id].disabled = sim.cars[id].dnf or sim.cars[id].finished or sim.battle_state.drivers[id].target_id < 0
		var priority = {"id": id, "teammate_id": 6 if id == 3 else 3, "kind": "pit_priority", "laps": 2, "revision": revision}
		var reason = TeamOrders.validate(sim, priority)
		priority_buttons[id].disabled = not reason.is_empty(); priority_buttons[id].tooltip_text = reason
	var preview = TeamOrders.preview(sim)
	preview_text.text = "SHARED BOX / ESTIMATE\n%s: ~%.1fs to box · %s\n%s: ~%.1fs to box · %s\nPossible queue for %s: ~%.1fs\n%s" % [preview.first.short, preview.first.arrival, preview.first.origin, preview.second.short, preview.second.arrival, preview.second.origin, preview.second.short, preview.queue, preview.note]
	var lines: Array[String] = ["OBSERVED STOPS / PUBLIC"]
	for event in sim.rival_state.stops.slice(maxi(0, sim.rival_state.stops.size() - 3)):
		lines.append("%.1fs · %s entered the pits" % [event.time, event.short])
	if lines.size() == 1: lines.append("No pit entries observed yet. Rival future plans remain unknown.")
	public_stops.text = "\n".join(lines)
