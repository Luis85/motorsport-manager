class_name PitwallNavigator
extends ConfirmationDialog
## A read-only destination picker: never offers executable race commands.
signal destination_requested(topic: int, subtopic: int)
var search: LineEdit
var results: ItemList
var result_count: Label
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
	[5, 0, "Conditions / Surface lab", "water grip rubber debris advanced"],
	[1, 0, "Review / Telemetry", "lap speed timing sectors"],
	[2, 0, "Review / Radio", "events messages flags"],
	[7, 0, "Review / Debrief", "results decisions evidence export outcomes"]
]

func configure(has_weather: bool, scale_factor: float) -> void:
	title = "Find a view"; ok_button_text = "Open view"; cancel_button_text = "Close"
	min_size = Vector2i(520, 400); size = Vector2i(570, 450)
	var body = UI.vbox(self); body.custom_minimum_size = Vector2(530, 350)
	body.add_child(UI.label("FIND A VIEW", 14, UI.ACCENT))
	body.add_child(UI.label("Browse or search. Opening a view never issues a race order."))
	search = LineEdit.new(); search.placeholder_text = "Search views — e.g. fuel, wheels, pit box"; body.add_child(search)
	search.tooltip_text = "Filter destinations, use Up/Down to select, then Enter to open. Escape closes."
	result_count = UI.label("", 12, PitwallDesign.MUTED); body.add_child(result_count)
	results = ItemList.new(); results.size_flags_vertical = Control.SIZE_EXPAND_FILL; results.custom_minimum_size.y = 210
	results.auto_height = false
	results.add_theme_constant_override("v_separation", 10); body.add_child(results)
	for entry in DESTINATIONS:
		if entry[0] != 9 or has_weather: catalog.append(entry)
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
	size = Vector2i(620, 470)
	popup_centered(); PitwallDesign.focus_later(search)

func filter_views(query: String) -> void:
	matches.clear(); results.clear()
	var words = query.strip_edges().to_lower().split(" ", false)
	for entry in catalog:
		var haystack = (entry[2] + " " + entry[3]).to_lower()
		var accepts = true
		for word in words:
			if not haystack.contains(word): accepts = false; break
		if accepts: matches.append(entry); results.add_item(entry[2])
	result_count.text = "%d views · Enter opens · Escape closes" % matches.size() if not matches.is_empty() else "No matching views. Try a shorter term or clear the search."
	get_ok_button().disabled = matches.is_empty()
	if not matches.is_empty(): results.select(0)

func search_key(event: InputEvent) -> void:
	if not event is InputEventKey or not event.pressed: return
	if event.keycode not in [KEY_DOWN, KEY_UP] or matches.is_empty(): return
	var selected = results.get_selected_items()
	var index = int(selected[0]) if not selected.is_empty() else 0
	index = clampi(index + (1 if event.keycode == KEY_DOWN else -1), 0, matches.size() - 1)
	results.select(index); results.ensure_current_is_visible(); search.accept_event()

func open_selected() -> void:
	var selected = results.get_selected_items()
	if selected.is_empty() or selected[0] >= matches.size(): return
	var entry = matches[selected[0]]; hide()
	destination_requested.emit(entry[0], entry[1])

func close_picker() -> void:
	hide()
	if is_instance_valid(return_focus) and return_focus.is_visible_in_tree(): PitwallDesign.focus_later(return_focus)
