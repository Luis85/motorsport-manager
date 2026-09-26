class_name DirectorCarCard
extends PanelContainer
signal call_requested(id: int)
signal plan_requested(id: int)
signal follow_requested(id: int)
var driver_id = 3
var heading: Label
var position_label: Label
var tyre: Label
var fuel: Label
var context: Label
var status: Label
var receipt: Label
var call_button: Button
var plan_button: Button
var follow_button: Button
var tread: ProgressBar

func _ready() -> void:
	add_theme_stylebox_override("panel", UI.box(DirectorStyle.SURFACE, DirectorStyle.LINE, 6, 10))
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	var body = UI.vbox(self)
	body.add_theme_constant_override("separation", 5)
	var top = UI.hbox(body)
	position_label = DirectorStyle.label("P–", 25, DirectorStyle.ACCENT); top.add_child(position_label)
	var identity = UI.vbox(top, true)
	heading = DirectorStyle.label("", 16); identity.add_child(heading)
	context = DirectorStyle.label("", 12, DirectorStyle.MUTED); identity.add_child(context)
	follow_button = DirectorStyle.button("Follow", func(): follow_requested.emit(driver_id)); top.add_child(follow_button)
	follow_button.tooltip_text = "Select this named driver and follow their car. No orders or time controls change."
	var metrics = UI.hbox(body)
	tyre = DirectorStyle.label("", 13); tyre.size_flags_horizontal = Control.SIZE_EXPAND_FILL; metrics.add_child(tyre)
	fuel = DirectorStyle.label("", 13); metrics.add_child(fuel)
	tread = ProgressBar.new(); tread.show_percentage = false; tread.custom_minimum_size.y = 4; body.add_child(tread)
	tread.add_theme_stylebox_override("background", UI.box(DirectorStyle.BACKGROUND, Color.TRANSPARENT, 2, 0))
	tread.add_theme_stylebox_override("fill", UI.box(DirectorStyle.ACCENT, Color.TRANSPARENT, 2, 0))
	status = DirectorStyle.label("", 13); status.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; body.add_child(status)
	receipt = DirectorStyle.label("", 12, DirectorStyle.MUTED); receipt.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS; body.add_child(receipt)
	var actions = UI.hbox(body)
	call_button = DirectorStyle.button("Pause & decide", func(): call_requested.emit(driver_id), true)
	call_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; actions.add_child(call_button)
	plan_button = DirectorStyle.button("Race plan", func(): plan_requested.emit(driver_id)); actions.add_child(plan_button)

func present(value: Dictionary, phase: String, paused: bool, followup: Dictionary) -> void:
	driver_id = int(value.id)
	heading.text = value.name
	position_label.text = "P%d" % value.position
	context.text = value.rival
	tyre.text = "%s · %.0f%% tread" % [value.set, value.tyre]
	tread.value = value.tyre
	fuel.text = "Finish fuel ~%+.1f laps" % value.fuel_margin
	fuel.tooltip_text = "Projected margin at the finish with current engine mode. This is not fuel currently in the tank."
	if phase in ["practice", "qualifying"]:
		fuel.text = "Fuel on board %.1f laps" % value.fuel
		fuel.tooltip_text = "Actual current fuel load in lap-equivalents; not a race-finish projection."
	status.text = value.status; status.tooltip_text = value.status
	receipt.text = value.plan if followup.is_empty() else followup.label + " · " + followup.detail
	receipt.tooltip_text = receipt.text
	call_button.text = "Decide" if paused else "Pause & decide"
	if phase in ["briefing", "race_preparation", "practice", "practice_results"]: call_button.text = "Prepare this car"
	if phase == "qualifying": call_button.text = "Review run" if paused else "Pause & review run"
	if phase in ["qualifying_results", "results"] or value.terminal: call_button.text = "View result"
	call_button.accessibility_name = call_button.text + " for " + value.name
	plan_button.accessibility_name = "Race plan for " + value.name
	follow_button.accessibility_name = "Follow " + value.name
