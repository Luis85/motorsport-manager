class_name PitwallWorkspaceState
extends RecoveryWeekendView
## Task-oriented native shell over the existing controls and command boundary.
# The optional recovery/results/practice pages have per-instance indices.
var groups = {
	"Strategy": [6], "Car": [0, 3, 4], "Team": [8], "Conditions": [9, 5], "Review": [1, 2, 7]
}
var group_buttons: Dictionary = {}
var group_memory: Dictionary = {}
var context_navigation: HBoxContainer
var find_button: Button
var messages_button: Button
var navigator: PitwallNavigator
var car_cards: Dictionary = {}
var comparison: PitwallComparison
var messages: Array[String] = []
var text_scale = 1.0
var workspace_ready = false
var exit_dialog: ConfirmationDialog
var last_invoker: Control

var weekend_menu: MenuButton
var phase_actions: VBoxContainer
var header_context: VBoxContainer
var utility_commands: Array[Button] = []
var results_panel: SessionResultsPanel
var results_page_index = -1
var driver_rail: VBoxContainer
var race_read_panel: RaceReadPanel
var race_read_button: Button
var layout_changes = 0
var adapting = false
var decision_queue: RaceDecisionQueue
var decision_drawer: RaceDecisionDrawer
var decision_page_index = -1
var full_workspace: Control
var results_workspace: RaceResultsWorkspace
var results_home: Node
var session_workspace_button: Button
var gamepad_navigation: RaceGamepadNavigation
var analysis_workspace: RaceAnalysisWorkspace
var inspector_home: Node
var focus_button: Button
var full_invoker: Control


func build_navigation() -> void:
	PitwallWorkspaceBuilder.build_navigation(self)


func build_header() -> void:
	PitwallWorkspaceBuilder.build_header(self)


func compact_inspector() -> void:
	PitwallWorkspaceBuilder.compact_inspector(self)


func build_driver_rail() -> void:
	PitwallWorkspaceBuilder.build_driver_rail(self)


func adapt_layout() -> void:
	PitwallWorkspaceLayout.adapt_layout(self)


func show_reading(title: String, text: String, invoker: Control) -> void:
	PitwallWorkspaceLayout.show_reading(self, title, text, invoker)


func confirm_leave(proceed: Callable) -> void:
	PitwallWorkspaceLayout.confirm_leave(self, proceed)


func open_results_workspace() -> void:
	PitwallWorkspaceLayout.open_results_workspace(self)


func close_session_workspace() -> void:
	PitwallWorkspaceLayout.close_session_workspace(self)


func open_analysis_workspace() -> void:
	PitwallWorkspaceLayout.open_analysis_workspace(self)


func show_driver_details(id: int) -> void:
	call("open_decision", id)


func open_session_workspace() -> void:
	open_results_workspace()


func open_journal_workspace() -> void:
	open_results_workspace()
	results_workspace.show_page(3)


func unapplied_draft_kinds() -> Array[String]:
	var kinds: Array[String] = []
	if strategy_desk.has_user_edits():
		kinds.append("strategy")
	if racecraft.has_user_edits():
		kinds.append("setup")
	return kinds
