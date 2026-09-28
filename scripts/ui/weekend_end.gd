class_name WeekendEndView
extends VBoxContainer
## Final values only. Navigation cannot award resources or start another event implicitly.
signal menu_requested
signal new_weekend_requested
signal track_requested
var data: Dictionary = {}
var scale_factor: float = 1.0
var classification: Tree
var new_button: Button
var menu_button: Button
var track_button: Button

func configure(summary: Dictionary, scale: float = 1.0) -> void:
	data = summary.duplicate(true)
	scale_factor = scale

func _ready() -> void:
	theme = MinimalRaceStyle.theme(scale_factor)
	set_meta("pitwall_text_scale", scale_factor)
	size_flags_vertical = Control.SIZE_EXPAND_FILL; size_flags_horizontal = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", 12)
	var header = PanelContainer.new(); add_child(header)
	var intro = VBoxContainer.new(); header.add_child(intro)
	intro.add_child(MinimalRaceStyle.label("WEEKEND COMPLETE", 12, scale_factor, true))
	var title = MinimalRaceStyle.label(data.name + " / Final classification", 25, scale_factor)
	title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	intro.add_child(title)
	var subtitle = MinimalRaceStyle.label("%d race laps · Your calls and both drivers' results are saved with this weekend." % data.laps, 13, scale_factor, true)
	subtitle.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	intro.add_child(subtitle)
	var drivers = HBoxContainer.new(); add_child(drivers)
	for driver in data.managed:
		var panel = PanelContainer.new(); panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL; drivers.add_child(panel)
		var body = VBoxContainer.new(); panel.add_child(body)
		body.add_child(MinimalRaceStyle.label("P%d  %s" % [driver.position, driver.name], 21, scale_factor))
		var detail = MinimalRaceStyle.label("%s · %d completed laps · %d pit stops · Best %s" % [driver.status, driver.laps, driver.stops, driver.best], 13, scale_factor, true)
		detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; detail.custom_minimum_size.x = 260; body.add_child(detail)
		if not driver.reason.is_empty():
			var reason = MinimalRaceStyle.label(driver.reason, 12, scale_factor, true); reason.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; body.add_child(reason)
	classification = Tree.new(); classification.add_theme_stylebox_override("panel", MinimalRaceStyle.surface()); classification.columns = 5; classification.hide_root = true
	classification.column_titles_visible = true; classification.size_flags_vertical = Control.SIZE_EXPAND_FILL; add_child(classification)
	for index in range(5): classification.set_column_title(index, ["Pos", "Driver", "Status", "Laps", "Best lap"][index])
	classification.set_column_expand(0, false); classification.set_column_custom_minimum_width(0, 60)
	classification.set_column_expand(3, false); classification.set_column_custom_minimum_width(3, 70)
	var root = classification.create_item()
	for row in data.rows:
		var item = classification.create_item(root)
		for index in range(5):
			item.set_text(index, [str(row.position), row.name, row.status, str(row.laps), row.best][index])
			if row.player: item.set_custom_color(index, MinimalRaceStyle.ACCENT)
	var footer = HBoxContainer.new(); add_child(footer)
	menu_button = MinimalRaceStyle.button("Main menu", func(): menu_requested.emit(), scale_factor); footer.add_child(menu_button)
	track_button = MinimalRaceStyle.button("Review final track", func(): track_requested.emit(), scale_factor); footer.add_child(track_button)
	var spacer = Control.new(); spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL; footer.add_child(spacer)
	new_button = MinimalRaceStyle.button("New weekend", func(): new_weekend_requested.emit(), scale_factor)
	MinimalRaceStyle.primary(new_button, scale_factor); footer.add_child(new_button); menu_button.call_deferred("grab_focus")

func _draw() -> void:
	draw_rect(Rect2(Vector2.ZERO, size), MinimalRaceStyle.BG)
