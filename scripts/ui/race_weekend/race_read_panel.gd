class_name RaceReadPanel
extends PanelContainer
## Calm observational spotlight, with a stable, non-targeted reading action.
signal reading_requested
signal radio_requested
var headline: Label
var detail: Label
var read_button: Button
var radio_button: Button
var stamp: Array = []
var update_count = 0

func _ready() -> void:
	add_theme_stylebox_override("panel", UI.box(PitwallDesign.RACE_CREAM, UI.LINE, 5, 8))
	var body = UI.vbox(self)
	body.add_child(UI.label("READ THE RACE", 11, UI.ACCENT))
	headline = UI.label("Let the weekend unfold", 13)
	headline.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; body.add_child(headline)
	detail = UI.paragraph(""); detail.max_lines_visible = 3; detail.custom_minimum_size.y = 48; body.add_child(detail)
	var row = UI.hbox(body)
	read_button = UI.button("Read both drivers", func(): reading_requested.emit()); row.add_child(read_button)
	radio_button = UI.button("Race radio", func(): radio_requested.emit()); row.add_child(radio_button)
	read_button.tooltip_text = "Open a fixed reading snapshot: stakes, trade-offs and recent observed evidence for both named drivers. No orders or time changes."
	radio_button.tooltip_text = "Open the existing full race radio and retained history."

func present(snapshot: Dictionary) -> void:
	var focus: Dictionary = snapshot.focus
	var next = [focus.short, focus.title, focus.evidence, focus.choice, focus.next]
	if stamp == next: return
	stamp = next; update_count += 1
	headline.text = "%s · %s" % [focus.short, focus.title]
	detail.text = focus.choice
	detail.tooltip_text = focus.evidence + "\n" + focus.choice + "\n" + focus.next
	headline.tooltip_text = focus.name + " · " + focus.title
