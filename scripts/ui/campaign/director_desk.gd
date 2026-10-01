class_name CampaignDirectorDesk
extends VBoxContainer
## TM-11 native management surface. Receives one detached Director Desk projection
## and emits explicit navigation/time/departure intents; it owns no campaign state.
signal menu_requested
signal advance_requested
signal start_event_requested
signal guide_visibility_requested(hidden: bool)

var data: Dictionary = {}
var text_scale: float = 1.0
var guide_hidden: bool = false
var primary_action: Button
var menu_button: Button

func configure(value: Dictionary, scale: float = 1.0, hidden_guide: bool = false) -> void:
	data = value.duplicate(true)
	text_scale = scale
	guide_hidden = hidden_guide

func _ready() -> void:
	theme = MinimalRaceStyle.theme(text_scale)
	set_meta("pitwall_text_scale", text_scale)
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", roundi(12 * text_scale))
	_build_header()
	_build_status()
	# Keep the next consequential decision above optional onboarding detail so
	# compact/high-text layouts never hide the departure action below the fold.
	_build_priorities()
	_build_guide()
	_build_columns()
	_build_footer()
	PitwallDesign.focus_later(primary_action if primary_action != null else menu_button)

func _build_header() -> void:
	var panel = PanelContainer.new(); add_child(panel)
	var body = VBoxContainer.new(); panel.add_child(body)
	var top = HBoxContainer.new(); body.add_child(top)
	var titles = VBoxContainer.new(); titles.size_flags_horizontal = Control.SIZE_EXPAND_FILL; top.add_child(titles)
	titles.add_child(MinimalRaceStyle.label("TEAM PRINCIPAL / CAMPAIGN", 11, text_scale, true))
	titles.add_child(MinimalRaceStyle.label("Director's Desk", 28, text_scale))
	top.add_child(MinimalRaceStyle.label(data.get("date", ""), 12, text_scale, true))
	var season = data.get("season", {})
	var copy = "Four-event management slice"
	if not season.is_empty():
		copy = "%s · %d/%d events completed" % [str(season.status).replace("_", " ").capitalize(),
			int(season.completed_events), int(season.total_events)]
	var subtitle = MinimalRaceStyle.label(copy, 13, text_scale, true)
	subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; body.add_child(subtitle)

func _build_status() -> void:
	var row = GridContainer.new()
	row.columns = 2 if get_viewport_rect().size.x < 1250 or text_scale >= 1.25 else 4
	row.add_theme_constant_override("h_separation", roundi(8 * text_scale))
	row.add_theme_constant_override("v_separation", roundi(8 * text_scale)); add_child(row)
	var season = data.get("season", {})
	var next_event = data.get("next_event", {})
	var standing = "—" if int(season.get("position", 0)) <= 0 else "P%d · %d pts" % [int(season.position), int(season.points)]
	var event_text = "Season complete" if next_event.is_empty() else "Round %d · slot %d" % [int(next_event.round), int(next_event.departure_slot)]
	for item in [
		["CASH", "%d cr" % int(data.get("cash_minor", 0))],
		["NEXT EVENT", event_text],
		["PRINCIPAL ENERGY", "%d/%d" % [int(data.energy.available), int(data.energy.capacity)]],
		["TEAM STANDING", standing]
	]:
		var panel = PanelContainer.new(); panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL; row.add_child(panel)
		var stack = VBoxContainer.new(); panel.add_child(stack)
		stack.add_child(MinimalRaceStyle.label(item[0], 10, text_scale, true))
		var value = MinimalRaceStyle.label(item[1], 18, text_scale); value.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; stack.add_child(value)

func _build_guide() -> void:
	var panel = PanelContainer.new(); add_child(panel)
	var body = VBoxContainer.new(); panel.add_child(body)
	var head = HBoxContainer.new(); body.add_child(head)
	var label = MinimalRaceStyle.label("FIRST CAMPAIGN LOOP", 11, text_scale, true)
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL; head.add_child(label)
	var toggle = MinimalRaceStyle.button("Show guide" if guide_hidden else "Hide guide",
		func(): guide_visibility_requested.emit(not guide_hidden), text_scale)
	head.add_child(toggle)
	if guide_hidden:
		body.add_child(MinimalRaceStyle.label("Guide hidden. Resume it any time from this desk.", 12, text_scale, true))
		return
	for step in data.get("onboarding", {}).get("steps", []):
		var line = HBoxContainer.new(); body.add_child(line)
		line.add_child(MinimalRaceStyle.label("✓" if step.done else "○", 15, text_scale, step.done))
		var copy = MinimalRaceStyle.label(step.title, 12, text_scale, step.done)
		copy.size_flags_horizontal = Control.SIZE_EXPAND_FILL; line.add_child(copy)

func _build_priorities() -> void:
	var heading = HBoxContainer.new(); add_child(heading)
	var title = MinimalRaceStyle.label("DECISIONS THAT MATTER", 12, text_scale, true)
	title.size_flags_horizontal = Control.SIZE_EXPAND_FILL; heading.add_child(title)
	var next_event = data.get("next_event", {})
	if not next_event.is_empty() and not data.get("active_weekend", false):
		if int(next_event.departure_slot) <= int(data.get("slot", 0)):
			primary_action = MinimalRaceStyle.button("Start next event", func(): start_event_requested.emit(), text_scale)
		else:
			primary_action = MinimalRaceStyle.button("Advance to event", func(): advance_requested.emit(), text_scale)
		MinimalRaceStyle.primary(primary_action, text_scale); heading.add_child(primary_action)
	for priority in data.get("priorities", []):
		var panel = PanelContainer.new(); add_child(panel)
		var body = VBoxContainer.new(); panel.add_child(body)
		body.add_child(MinimalRaceStyle.label(priority.title, 17, text_scale))
		var detail = MinimalRaceStyle.label(priority.detail, 12, text_scale, true)
		detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; body.add_child(detail)

func _build_columns() -> void:
	var columns = GridContainer.new(); columns.size_flags_vertical = Control.SIZE_EXPAND_FILL
	columns.columns = 1 if get_viewport_rect().size.x < 1250 or text_scale >= 1.25 else 3
	columns.add_theme_constant_override("h_separation", roundi(10 * text_scale))
	columns.add_theme_constant_override("v_separation", roundi(10 * text_scale)); add_child(columns)
	_build_work(columns)
	_build_rivals(columns)
	_build_debrief(columns)

func _column(parent: Node, title: String) -> VBoxContainer:
	var panel = PanelContainer.new(); panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL; parent.add_child(panel)
	var body = VBoxContainer.new(); panel.add_child(body)
	body.add_child(MinimalRaceStyle.label(title, 12, text_scale, true))
	return body

func _build_work(parent: Node) -> void:
	var body = _column(parent, "ORGANIZATION AT WORK")
	var rows = data.get("work", [])
	if rows.is_empty():
		body.add_child(MinimalRaceStyle.label("No scheduled factory work. Capacity remains available.", 12, text_scale, true))
	for row in rows:
		body.add_child(MinimalRaceStyle.label(row.title, 14, text_scale))
		body.add_child(MinimalRaceStyle.label("%s · %s" % [str(row.state).replace("_", " "), row.detail], 11, text_scale, true))

func _build_rivals(parent: Node) -> void:
	var body = _column(parent, "RIVAL PADDOCK")
	var rows = data.get("rivals", [])
	if rows.is_empty():
		body.add_child(MinimalRaceStyle.label("No rival organization records yet.", 12, text_scale, true))
	for row in rows.slice(0, mini(5, rows.size())):
		body.add_child(MinimalRaceStyle.label(row.team_id, 13, text_scale))
		body.add_child(MinimalRaceStyle.label("%s · %s · %d cr committed" % [
			str(row.archetype).replace("_", " "), str(row.project).replace("_", " "),
			int(row.committed_minor)], 10, text_scale, true))

func _build_debrief(parent: Node) -> void:
	var body = _column(parent, "LATEST DEBRIEF")
	var debrief = data.get("debrief", {})
	if debrief.is_empty():
		body.add_child(MinimalRaceStyle.label("Complete the first weekend to create factual debrief evidence.", 12, text_scale, true))
		return
	body.add_child(MinimalRaceStyle.label("Round %d" % int(debrief.round), 16, text_scale))
	for fact in debrief.facts:
		var copy = MinimalRaceStyle.label("%s · %s" % [str(fact.level).to_upper(), fact.text], 11, text_scale, true)
		copy.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; body.add_child(copy)
	var note = MinimalRaceStyle.label(debrief.note, 10, text_scale, true)
	note.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; body.add_child(note)

func _build_footer() -> void:
	var row = HBoxContainer.new(); add_child(row)
	menu_button = MinimalRaceStyle.button("Main menu", func(): menu_requested.emit(), text_scale); row.add_child(menu_button)
	var spacer = Control.new(); spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL; row.add_child(spacer)
	var forecast = data.get("forecast", {})
	if not forecast.is_empty():
		var committed = forecast.scenarios.committed
		row.add_child(MinimalRaceStyle.label("Committed minimum cash: %d cr%s" % [
			int(committed.minimum_cash_minor), " · reserve pressure" if committed.breaches_reserve else ""],
			11, text_scale, true))

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), MinimalRaceStyle.BG)
