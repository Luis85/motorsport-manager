class_name PitwallNavigator
extends ConfirmationDialog
## A read-only destination picker: never offers executable race commands.
signal destination_requested(topic: int, subtopic: int)
var search: LineEdit
var results: ItemList
var result_count: Label
var destination_preview: Label
var clear_button: Button
var catalog: Array = []
var matches: Array = []
var return_focus: Control
const DESTINATIONS = [
	[6, 0, "Strategy / Compare", "pit rejoin undercut forecast alternatives"],
	[6, 1, "Strategy / Plan", "draft approve starting set stop window"],
	[6, 2, "Strategy / Control", "delegate ownership pace engine fuel push save"],
	[0, 0, "Car / Driving", "pace fuel engine racecraft bias"],
	[0, 1, "Car / Pit service", "compound repair planned set"],
	[3, 0, "Car / Tyre allocation", "stock inventory fresh used set"],
	[3, 1, "Car / Wheels", "pressure temperature tread puncture damage"],
	[3, 2, "Car / Stop plan", "schedule stint history"],
	[4, 0, "Car / Setup", "wing cooling balance suspension apply garage"],
	[8, 0, "Team / Cooperate", "hold positions allow through swap"],
	[8, 1, "Team / Battles", "overtake attack defend watch"],
	[8, 2, "Team / Shared pit box", "queue double stack priority"],
	[9, 0, "Conditions / Weather", "rain crossover intermediate wet forecast"],
	[10, 0, "Conditions / Recovery", "reliability repair damage health protect retire virtual neutralization flags"],
	[5, 0, "Conditions / Surface lab", "water grip rubber debris advanced"],
	[1, 0, "Review / Telemetry", "lap speed timing sectors"],
	[2, 0, "Review / Radio", "events messages flags"],
	[7, 0, "Review / Debrief", "results decisions evidence export outcomes"]
]

func configure(has_weather: bool, scale_factor: float, has_recovery: bool = false) -> void:
	title = "Find a view"; ok_button_text = "Open view"; cancel_button_text = "Close"
	min_size = Vector2i(520, 400); size = Vector2i(570, 450)
	var body = UI.vbox(self); body.custom_minimum_size = Vector2(530, 410)
	body.add_child(UI.label("FIND A VIEW", 14, UI.ACCENT))
	body.add_child(UI.label("Browse or search. Opening a view never issues a race order."))
	var search_row = UI.hbox(body)
	search = LineEdit.new(); search.placeholder_text = "Search views — fuel, wheels, pit box"; search.size_flags_horizontal = Control.SIZE_EXPAND_FILL; search_row.add_child(search)
	search.accessibility_name = "Search race-weekend views"
	clear_button = UI.button("Clear", clear_search); search_row.add_child(clear_button)
	clear_button.tooltip_text = "Clear this search and show all available views. No race command."
	search.tooltip_text = "Filter destinations, use Up/Down to select, then Enter to open. Escape closes."
	result_count = UI.label("", 12, PitwallDesign.MUTED); body.add_child(result_count)
	results = ItemList.new(); results.size_flags_vertical = Control.SIZE_EXPAND_FILL; results.custom_minimum_size.y = 210
	results.auto_height = false
	results.add_theme_constant_override("v_separation", 10); body.add_child(results)
	destination_preview = UI.paragraph(""); destination_preview.custom_minimum_size.y = 58; body.add_child(destination_preview)
	# Hidden containers have not laid out their children before the first popup.
	# Give wrapped text a real width so its one-pixel minimum cannot inflate the window.
	destination_preview.size.x = body.custom_minimum_size.x
	results.item_selected.connect(func(_index): describe_selection())
	for entry in DESTINATIONS:
		if entry[0] == 9 and not has_weather: continue
		if entry[0] == 10 and not has_recovery: continue
		catalog.append(entry)
	search.text_changed.connect(filter_views)
	search.text_submitted.connect(func(_text): open_selected())
	search.gui_input.connect(search_key)
	results.item_activated.connect(func(_i): open_selected())
	confirmed.connect(open_selected)
	canceled.connect(close_picker)
	PitwallDesign.scale_controls(self, scale_factor)
	filter_views("")

func show_picker(focus: Control) -> void:
	return_focus = focus; search.text = ""; filter_views("")
	size = Vector2i(680, 530)
	popup_centered(); PitwallDesign.focus_later(search)

func _input(event: InputEvent) -> void:
	# LineEdit can consume ui_cancel before the dialog's default close handling.
	# Handle Escape in the owning window, before any focused child can swallow it.
	if visible and event is InputEventKey and event.pressed and not event.echo and event.keycode == KEY_ESCAPE:
		set_input_as_handled(); close_picker()

func filter_views(query: String) -> void:
	matches.clear(); results.clear()
	var normalized = query.strip_edges().to_lower()
	var words = normalized.split(" ", false)
	# An exact destination name takes precedence over incidental keyword matches.
	# For example, Practice opens the programme view, not Session Results.
	var exact = catalog.filter(func(entry): return not normalized.is_empty() and (str(entry[2]).to_lower() == normalized or str(entry[2]).get_slice("/", 1).strip_edges().to_lower() == normalized))
	for entry in (exact if not exact.is_empty() else catalog):
		var haystack = (entry[2] + " " + entry[3]).to_lower()
		var accepts = true
		for word in words:
			if not haystack.contains(word): accepts = false; break
		if accepts: matches.append(entry); results.add_item(entry[2])
	result_count.text = ("1 view · Enter opens · Escape closes" if matches.size() == 1 else "%d views · Enter opens · Escape closes" % matches.size()) if not matches.is_empty() else "No matching views. Try a shorter term or clear the search."
	get_ok_button().disabled = matches.is_empty()
	if not matches.is_empty(): results.select(0)
	describe_selection()

func search_key(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed: return
	if event.keycode not in [KEY_DOWN, KEY_UP] or matches.is_empty(): return
	var selected = results.get_selected_items()
	var index = int(selected[0]) if not selected.is_empty() else 0
	index = clampi(index + (1 if event.keycode == KEY_DOWN else -1), 0, matches.size() - 1)
	results.select(index); results.ensure_current_is_visible(); describe_selection(); search.accept_event()

func open_selected() -> void:
	var selected = results.get_selected_items()
	if selected.is_empty() or selected[0] >= matches.size(): return
	var entry = matches[selected[0]]; hide()
	destination_requested.emit(entry[0], entry[1])

func close_picker() -> void:
	hide()
	if is_instance_valid(return_focus) and return_focus.is_visible_in_tree(): PitwallDesign.focus_later(return_focus)

func clear_search() -> void:
	search.text = ""; filter_views(""); search.grab_focus()

func describe_selection() -> void:
	var selected = results.get_selected_items()
	if selected.is_empty():
		destination_preview.text = "No view selected. Clear the search to browse all views, or try a task such as tyres, pit service or tactics."
		return
	var entry = matches[selected[0]]
	var descriptions = {
		"Strategy / Compare": "Compare stop timing, rejoin estimates and alternatives before issuing an order.",
		"Strategy / Plan": "Edit a driver's stint and stop windows. Changes remain a draft until approved.",
		"Strategy / Control": "Review who controls pace, engine and pit decisions before changing authority.",
		"Strategy / Tactics": "Plan an undercut or extension against a named rival. Compare first; approval is separate.",
		"Strategy / Practice": "Choose an optional learning run and inspect measured setup or tyre evidence.",
		"Strategy / Decision review": "Read one driver's issue, consequences and deadline before confirming a response.",
		"Car / Driving": "Inspect pace, engine and racecraft controls for the selected driver.",
		"Car / Pit service": "Inspect the selected driver's replacement set and repair choices.",
		"Car / Tyre allocation": "See fresh and used sets belonging to the selected driver.",
		"Car / Wheels": "Inspect individual wheel temperatures, tread, pressure and damage.",
		"Car / Stop plan": "Inspect planned stops, fitted stints and stop history.",
		"Car / Setup": "Edit the setup draft; applying it requires the appropriate garage state.",
		"Team / Cooperate": "Review team orders and their target before asking the drivers to cooperate.",
		"Team / Battles": "Inspect the current attack and defence situations.",
		"Team / Shared pit box": "Compare both cars' pit-box exposure and queue risk.",
		"Team / Pit service": "Follow accepted stops through entry, queue, service and exit.",
		"Team / Accepted plans": "Inspect approved plans and temporary control overrides for both drivers.",
		"Team / Rival field": "Read observed rival tendencies, not hidden future intentions.",
		"Conditions / Weather": "Compare observed rain, surface water and uncertain tyre crossover cases.",
		"Conditions / Recovery": "Review damage and reliability responses before confirming repairs or retirement.",
		"Conditions / Surface lab": "Inspect advanced water, grip, rubber and debris information.",
		"Review / Telemetry": "Inspect measured lap, speed and sector evidence.",
		"Review / Radio": "Read race events, flags and team messages.",
		"Review / Read the race": "Read a captured explanation of both drivers' situations and next decisions.",
		"Review / Debrief": "Review decisions and race outcomes. Result acceptance remains explicit.",
		"Review / Results": "Open measured classifications and session results, not predicted finishes.",
		"Review / Tactical evidence": "Open the tactical evidence reading: intentions, physical stops and observed outcomes.",
		"Review / Replay and sandbox": "Inspect a replay or try a separate experiment; it cannot settle the original result.",
		"Review / Circuit notebook": "Open retained circuit observations and personal notes."
	}
	destination_preview.text = entry[2] + "\n" + descriptions.get(entry[2], "Inspect this view. Navigation does not apply edits or issue race orders.")
