class_name ContextGuide
extends Control
## Resumable, non-modal walkthrough. Steps navigate UI only; never issue simulation commands.
var flow = ""
var steps: Array = []
var step_index = 0
var card: PanelContainer
var title_label: Label
var body_label: Label
var body_scroll: ScrollContainer
# Optional host-owned observation area. Other product guides retain their placement.
var placement_region: Callable
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
	title_label = UI.paragraph("", UI.INK); title_label.add_theme_font_size_override("font_size",20); box.add_child(title_label)
	body_scroll = ScrollContainer.new(); body_scroll.custom_minimum_size.y = 130
	body_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; box.add_child(body_scroll)
	body_label = UI.paragraph(""); body_label.size_flags_horizontal = Control.SIZE_EXPAND_FILL; body_scroll.add_child(body_label)
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
	body_scroll.scroll_vertical = 0
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
	if placement_region.is_valid():
		var area: Rect2 = placement_region.call()
		area.position -= global_position
		var scale_factor = get_theme_font_size("font_size") / 13.0
		var width = minf(370 * scale_factor, maxf(315, area.size.x - 16))
		card.custom_minimum_size.x = width
		card.size.x = width
		# Long explanatory copy may scroll; Dismiss/Back/Next may not.
		var chrome = card.get_combined_minimum_size().y - body_scroll.custom_minimum_size.y
		body_scroll.custom_minimum_size.y = clampf(area.size.y - chrome - 16, 64, 145 * scale_factor)
		card.reset_size()
		card.position = Vector2(clampf(area.position.x + 8, 8, size.x - card.size.x - 8), maxf(8,area.position.y + 8))
	else:
		card.position = Vector2(10, maxf(8, size.y - card.size.y - 12))
	queue_redraw()

func _draw() -> void:
	if not visible or not is_instance_valid(target) or not target.is_visible_in_tree(): return
	var rect = Rect2(target.global_position - global_position, target.size).grow(3)
	rect = rect.intersection(Rect2(Vector2.ZERO, size))
	if rect.has_area(): draw_rect(rect, UI.ACCENT, false, 2.0)
