extends VBoxContainer
## On-demand read-only rendering of one detached RaceForecaster result.
signal refresh_requested
signal close_requested
var text_scale = 1.0
var latest: Dictionary = {}
var title_label: Label
var status_label: Label
var options_grid: GridContainer
var option_rows: Array = []
var pit_label: Label
var snapshot_label: Label
var assumptions_label: Label
var refresh_button: Button
var close_button: Button

func text(value: String, points: int, muted: bool = false) -> Label:
	return MinimalRaceStyle.label(value, points, text_scale, muted)

func configure(scale: float) -> void:
	text_scale = scale
	add_theme_constant_override("separation", roundi(9 * scale))
	var heading = HBoxContainer.new(); add_child(heading)
	var titles = VBoxContainer.new(); titles.size_flags_horizontal = Control.SIZE_EXPAND_FILL; heading.add_child(titles)
	title_label = text("Strategy comparison", 19); titles.add_child(title_label)
	status_label = text("Read-only estimate", 11, true); titles.add_child(status_label)
	close_button = MinimalRaceStyle.button("Close", func(): close_requested.emit(), scale); heading.add_child(close_button)
	options_grid = GridContainer.new(); options_grid.columns = 3; options_grid.size_flags_vertical = Control.SIZE_EXPAND_FILL
	options_grid.add_theme_constant_override("h_separation", roundi(8 * scale)); add_child(options_grid)
	for _i in range(3): option_rows.append(build_option())
	pit_label = text("", 12); pit_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; add_child(pit_label)
	snapshot_label = text("", 11, true); add_child(snapshot_label)
	assumptions_label = text("", 11, true); assumptions_label.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	assumptions_label.max_lines_visible = 3; add_child(assumptions_label)
	var footer = HBoxContainer.new(); add_child(footer)
	var spacer = Control.new(); spacer.size_flags_horizontal = Control.SIZE_EXPAND_FILL; footer.add_child(spacer)
	refresh_button = MinimalRaceStyle.button("Refresh estimate", func(): refresh_requested.emit(), scale); footer.add_child(refresh_button)
	accessibility_name = "Read-only strategy comparison"

func build_option() -> Dictionary:
	var panel = PanelContainer.new(); panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	panel.add_theme_stylebox_override("panel", MinimalRaceStyle.surface(Color("1e2e35"), MinimalRaceStyle.LINE, roundi(9 * text_scale))); options_grid.add_child(panel)
	var stack = VBoxContainer.new(); stack.add_theme_constant_override("separation", roundi(5 * text_scale)); panel.add_child(stack)
	var title = text("", 13); title.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; stack.add_child(title)
	var estimate = text("", 18); stack.add_child(estimate)
	var delta = text("", 11, true); stack.add_child(delta)
	var detail = text("", 11, true); detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; stack.add_child(detail)
	return {"panel": panel, "title": title, "estimate": estimate, "delta": delta, "detail": detail}

func present(forecast: Dictionary, driver_name: String) -> void:
	latest = forecast.duplicate(true)
	title_label.text = "Strategy comparison · " + driver_name
	status_label.text = "Read-only snapshot · no order issued · playback unchanged"
	for row in option_rows: row.panel.visible = false
	if forecast.is_empty():
		status_label.text = "Comparison unavailable for this driver in the current phase."
		pit_label.visible = false; snapshot_label.visible = false
		assumptions_label.text = "Start a live race with a running managed car, then refresh."
		assumptions_label.tooltip_text = assumptions_label.text
		return
	for index in range(mini(option_rows.size(), forecast.options.size())):
		present_option(option_rows[index], forecast.options[index], index)
	var pit = forecast.pit
	var first = mini(int(pit.position_low), int(pit.position_high)); var last = maxi(int(pit.position_low), int(pit.position_high))
	pit_label.text = "Safe entry lap %d · ~%.1f–%.1f s net pit loss · rejoin ~P%d–P%d" % [int(forecast.gate.lap), float(pit.loss_low), float(pit.loss_high), first, last]
	pit_label.visible = true
	snapshot_label.text = "Snapshot at race %.1fs · model v%d · current observed conditions only" % [float(forecast.time), int(forecast.model_version)]
	snapshot_label.visible = true
	var assumptions = ""
	for item in forecast.assumptions: assumptions += ("\n" if not assumptions.is_empty() else "") + str(item)
	assumptions_label.text = str(forecast.assumptions[0])
	assumptions_label.tooltip_text = assumptions

func present_option(row: Dictionary, option: Dictionary, index: int) -> void:
	row.panel.visible = true; row.title.text = option.title
	if not option.available:
		row.estimate.text = "Unavailable"; row.delta.text = "No comparison"
		row.detail.text = option.reason; row.detail.tooltip_text = option.reason
		return
	row.estimate.text = "~%.0f–%.0f s" % [float(option.low), float(option.high)]
	var gain = float(option.get("gain", 0))
	row.delta.text = "Current plan baseline" if index == 0 else ("~%.1f s faster vs current" % gain if gain > 0.05 else ("~%.1f s slower vs current" % absf(gain) if gain < -0.05 else "Similar to current plan"))
	row.detail.text = "%s risk · min tread ~%d%% · fuel margin ~%.1f laps" % [str(option.risk).capitalize(), roundi(float(option.minimum_life)), float(option.fuel_margin)]
	row.detail.tooltip_text = "Estimated remaining time and risk under the displayed current-condition assumptions."
