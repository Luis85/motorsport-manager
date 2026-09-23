class_name ContextGuide
extends Control
## Resumable, non-modal walkthrough. Steps navigate UI only; never issue simulation commands.
var flow = ""
var steps: Array = []
var step_index = 0
var card: PanelContainer
var title_label: Label
var body_label: Label
var counter: Label
var back_button: Button
var next_button: Button
var target: Control
var done = false

func configure(key: String, value: Array) -> void:
	flow = key; steps = value

func _ready() -> void:
	top_level = true
	position = get_parent().global_position; size = get_parent().size
	mouse_filter = Control.MOUSE_FILTER_IGNORE
	z_index = 30
	card = UI.panel(); card.custom_minimum_size = Vector2(345, 0); add_child(card)
	var box = UI.vbox(card)
	var head = UI.hbox(box)
	counter = UI.label("", 11, UI.ACCENT); counter.size_flags_horizontal = Control.SIZE_EXPAND_FILL; head.add_child(counter)
	head.add_child(UI.button("Dismiss", dismiss))
	title_label = UI.label("", 20); box.add_child(title_label)
	body_label = UI.paragraph(""); body_label.custom_minimum_size.x = 315; box.add_child(body_label)
	var actions = UI.hbox(box)
	back_button = UI.button("Back", func(): show_step(step_index - 1)); actions.add_child(back_button)
	actions.add_child(UI.button("Restart", func(): done = false; show_step(0)))
	next_button = UI.button("Next", next_step, true); next_button.size_flags_horizontal = Control.SIZE_EXPAND_FILL; actions.add_child(next_button)
	visible = false

func open_guide() -> void:
	done = false
	var saved = App.settings.get("guides", {}).get(flow, 0)
	step_index = clampi(int(saved), 0, maxi(0, steps.size() - 1))
	visible = true; show_step(step_index)

func show_step(index: int) -> void:
	if steps.is_empty(): return
	step_index = clampi(index, 0, steps.size() - 1)
	var step = steps[step_index]
	if step.has("reveal"): step.reveal.call()
	target = step.target.call() if step.has("target") else null
	counter.text = "%s · %d / %d" % [flow.to_upper(), step_index + 1, steps.size()]
	title_label.text = step.title; body_label.text = step.body
	back_button.disabled = step_index == 0
	next_button.text = "Finish" if step_index == steps.size() - 1 else "Next"
	store_progress(); queue_redraw()

func next_step() -> void:
	if step_index == steps.size() - 1:
		done = true; dismiss()
	else: show_step(step_index + 1)

func store_progress() -> void:
	if not App.settings.has("guides"): App.settings.guides = {}
	App.settings.guides[flow] = 0 if done else step_index
	# No display setting changes and no race state changes while persisting help progress.
	var error = Storage.write_json("user://settings.json", App.settings)
	if not error.is_empty(): counter.text += " · progress not saved"

func dismiss() -> void:
	store_progress(); visible = false; target = null

func _process(_delta: float) -> void:
	if not visible: return
	position = get_parent().global_position; size = get_parent().size
	# The left of the workspace leaves the right-hand command/inspector surface exposed.
	card.position = Vector2(10, maxf(8, size.y - card.size.y - 12))
	queue_redraw()

func _draw() -> void:
	if not visible or not is_instance_valid(target) or not target.is_visible_in_tree(): return
	var rect = Rect2(target.global_position - global_position, target.size).grow(3)
	rect = rect.intersection(Rect2(Vector2.ZERO, size))
	if rect.has_area(): draw_rect(rect, UI.ACCENT, false, 2.0)
