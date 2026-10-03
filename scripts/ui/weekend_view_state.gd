class_name WeekendViewState
extends VBoxContainer
## Shared Advanced weekend state and interaction/navigation behavior. The concrete
## WeekendView owns composition and live refresh; this base never advances the race.
signal new_weekend_requested
signal menu_requested
var sim: RaceViewQuery
var commands: RaceCommands
var view_session: RaceViewHandle
var presentation_services: RacePresentationServices = RacePresentationServices.new()
var session_status: RaceSessionStatus
var canvas: TrackCanvas
var tower: Tree
var rows: Dictionary = {}
var rank_rows: Array[TreeItem] = []
var rendered_rows: Dictionary = {}
var title_label: Label
var session_label: Label
var flag_label: Label
var weather_label: Label
var clock_label: Label
var primary_button: Button
var pause_button: Button
var driver_label: Label
var telemetry_label: Label
var intent_label: Label
var radio_label: Label
var pace: OptionButton
var engine: OptionButton
var compound: OptionButton
var compound_ids: Array = []
var automate: CheckButton
var repair: CheckButton
var box_button: Button
var cancel_box: Button
var send_button: Button
var recall_button: Button
var setup: SpinBox
var log_label: RichTextLabel
var history_label: RichTextLabel
var trace: RaceMetricChart
var speed_control: OptionButton
var follow_control: CheckButton
var surface_control: CheckButton
var timing_panel: PanelContainer
var right_panel: PanelContainer
var resource_row: HBoxContainer
var compact_resources: Label
var expand_button: Button
var detail_expanded = false
var steps: Array[Label] = []
var teammate_buttons: Array[Button] = []
var resource_labels: Array[Label] = []
var resource_bars: Array[ProgressBar] = []
var pit_note: Label
var command_note: Label
var tabs: TabContainer
var tyre_pages: Array[Control] = []
var tyre_nav: Array[Button] = []
var tyre_topic = 0
var surface_lab: SurfaceLab
var guide: ContextGuide
var detail_picker: OptionButton
var setup_commit: VBoxContainer
var racecraft: RacecraftPanel
var wheel_dashboard: RacecraftPanel.WheelDashboard
var battle_picker: OptionButton
var advisory_button: Button
var radio_filter = "all"
var follow = false
var refresh_time = 0.0
var last_phase = ""
var last_event_count = -1
var last_event_signature = ""
var feedback_until = 0.0
var hint: Label
var tyre_buttons: Array[Button] = []
var tyre_summary: Label
var schedule_lap: SpinBox
var schedule_button: Button
var unschedule_button: Button
var schedule_label: Label
var stint_plot: StintPlot
var navigation: HBoxContainer
var topic_buttons: Dictionary = {}
var watch_button: Button
var detail_caption: Label
var detail_nav_host: VBoxContainer
var pinned_navigation: Dictionary = {}
var detail_actions: VBoxContainer
var map_controls: HBoxContainer
var layers_menu: MenuButton
var layer_controls: Array[CheckButton] = []
var drive_pages: Array[Control] = []
var drive_buttons: Array[Button] = []
var drive_topic = 0
var help_target: Control
var ui_refresh_count = 0
var detail_refresh_count = 0
var decision_strip: PanelContainer
var decision_text: Label
var decision_review: Button
var decision_hold: Button
var session_header: RaceSessionHeader
var timing_view: RaceTimingTower
var race_workspace: RaceObservationWorkspace
var qualifying_workspace: RaceQualifyingWorkspace
var tyre_readout: RaceTyreReadout
var session_strip: PanelContainer
var decision_badge: Label
var decision_signature = ""
var decision_snoozed_signature = ""
var driver_status_card: PanelContainer
var driver_position_label: Label
var driver_rival_label: Label
var driver_plan_label: Label
var telemetry_inspector: RaceTelemetryInspector
var radio_inspector: RaceRadioInspector
var telemetry_chart: RaceMetricChart
var telemetry_sectors: RaceSectorTable
var top_secondary_actions: MenuButton
var race_context_label: Label


class StintPlot:
	extends Control
	var source: RaceChartQuery

	func _ready():
		custom_minimum_size = Vector2(240, 94)

	func _draw():
		draw_style_box(UI.box(UI.CARD), Rect2(Vector2.ZERO, size))
		draw_string(
			ThemeDB.fallback_font,
			Vector2(10, 20),
			"RACE STINTS · fitted sets",
			HORIZONTAL_ALIGNMENT_LEFT,
			-1,
			11,
			UI.MUTED
		)
		if source == null:
			return
		var car = source.selected_stints()
		if car.is_empty():
			return
		var width = size.x - 20
		for stint in car.stints:
			var finish = stint.to if stint.to >= 0 else maxf(stint.from, car.distance / car.length)
			var left = clampf(stint.from / car.laps, 0, 1) * width + 10
			var right = clampf(finish / car.laps, 0, 1) * width + 10
			var item = stint
			var color = Color(item.get("color", "9cae94"))
			draw_rect(Rect2(left, 33, maxf(2, right - left - 1), 20), color)
			if right - left > 24:
				draw_string(
					ThemeDB.fallback_font,
					Vector2(left + 3, 48),
					item.get("label", ""),
					HORIZONTAL_ALIGNMENT_LEFT,
					-1,
					10,
					GameTheme.ink_on(color)
				)
		if car.scheduled_lap > 0:
			var x = 10 + clampf(car.pit_gate / car.length / car.laps, 0, 1) * width
			draw_line(Vector2(x, 28), Vector2(x, 59), UI.ACCENT, 2, true)
		draw_string(
			ThemeDB.fallback_font,
			Vector2(10, 77),
			"START                         LAP %d" % car.laps,
			HORIZONTAL_ALIGNMENT_LEFT,
			-1,
			10,
			UI.MUTED
		)


func configure(value: RaceViewHandle) -> void:
	view_session = value
	session_status = value.status
	commands = value.commands
	sim = value.query


func setup_guide() -> void:
	WeekendNavigation.setup_guide(self)


func register_topic(title: String, index: int, position: int = -1) -> void:
	WeekendNavigation.register_topic(self, title, index, position)


func pin_navigation(index: int, control: Control) -> void:
	WeekendNavigation.pin_navigation(self, index, control)


func refresh_navigation() -> void:
	WeekendNavigation.refresh_navigation(self)


func open_topic(index: int) -> void:
	WeekendNavigation.open_topic(self, index)


func open_detail() -> void:
	WeekendNavigation.open_detail(self)


func close_detail() -> void:
	WeekendNavigation.close_detail(self)


func wire_control_help(node: Node) -> void:
	WeekendNavigation.wire_control_help(self, node)


func show_drive(index: int) -> void:
	WeekendNavigation.show_drive(self, index)


func current_decision(c: Dictionary) -> Dictionary:
	return WeekendDriverSupport.current_decision(self, c)


func refresh_tyres(c: Dictionary, controllable: bool) -> void:
	WeekendDriverSupport.refresh_tyres(self, c, controllable)


func tab_page(title: String) -> VBoxContainer:
	var scroll = RaceInspectorPage.new()
	scroll.name = title
	tabs.add_child(scroll)
	return scroll.body


func fit_canvas() -> void:
	canvas.fit()


func set_follow(value: bool) -> void:
	follow = value
	if value and canvas:
		canvas.fit_view_enabled = false
	if follow_control:
		follow_control.set_pressed_no_signal(value)
