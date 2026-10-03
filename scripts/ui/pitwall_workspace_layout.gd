class_name PitwallWorkspaceLayout
extends RefCounted
# Preserve the same controls and explicit driver bindings across layouts.
# Wide observation uses the concept's right rail; analysis/compact modes keep
# both cars below the map, so the inspector never creates a four-column squeeze.
# Restore the invoker row before choosing a focus target; telemetry refresh may be paused.
## Read-only presentation and control composition for its owning view.


static func adapt_layout(view) -> void:
	if not view.workspace_ready or view.adapting:
		return
	view.adapting = true
	if is_instance_valid(view.full_workspace) and view.full_workspace.visible:
		view.race_workspace.hide()
		view.driver_rail.hide()
		view.decision_bar.hide()
		view.decision_queue.hide()
		view.team_summary_label.hide()
		if view.full_workspace == view.analysis_workspace:
			view.teammate_buttons[0].get_parent().hide()
		view.adapting = false
		return
	view.race_workspace.show()
	view.team_summary_label.show()
	# Reserve the second urgent-action row and the help footer at enlarged text.
	# The map keeps its normal minimum in taller windows and at ordinary text scale.
	view.canvas.custom_minimum_size.y = 130 if view.text_scale > 1.15 and view.size.y < 790 else 170
	if view.decision_queue:
		view.decision_queue.visible = view.decision_queue.pending_count > 0 or view.size.y >= 790
	var enlarged = view.text_scale > 1.0
	view.right_panel.custom_minimum_size.x = (
		(560 if view.detail_expanded else 490)
		if enlarged
		else (
			PitwallDesign.DRIVER_RAIL_EXPANDED
			if view.detail_expanded
			else PitwallDesign.DRIVER_RAIL_WIDTH
		)
	)
	view.timing_panel.visible = (
		not view.right_panel.visible
		or not (view.detail_expanded or enlarged and view.size.x < 1300)
	)
	var use_rail = (
		not view.right_panel.visible
		and view.size.x >= 1360
		and view.size.y >= 790
		and view.text_scale <= 1.15
		# Enlarged urgent cards need the paired row to preserve both command rows and the footer.
		and (view.text_scale <= 1.0 or view.decision_queue.pending_count == 0)
	)
	if view.driver_rail:
		view.driver_rail.custom_minimum_size.x = ceilf(340 * view.text_scale)
		var destination = view.driver_rail if use_rail else view.decision_bar
		for id in view.sim.player_ids():
			var panel = view.car_cards[id].panel
			view.car_cards[id].set_stacked(use_rail)
			view.car_cards[id].status.custom_minimum_size.x = 0
			view.car_cards[id].rival.visible = not (view.right_panel.visible and view.size.y <= 800)
			view.car_cards[id].issue.custom_minimum_size.y = ceilf(
				(0 if view.right_panel.visible and view.size.y <= 800 else 30) * view.text_scale
			)
			if panel.get_parent() != destination:
				var focus = view.get_viewport().gui_get_focus_owner()
				var restore = focus != null and panel.is_ancestor_of(focus)
				panel.reparent(destination)
				if use_rail:
					destination.move_child(panel, view.sim.player_ids().find(id))
				view.layout_changes += 1
				if restore:
					PitwallDesign.focus_later(focus)
		view.driver_rail.visible = use_rail
		view.decision_bar.visible = not use_rail
	view.adapting = false


static func show_reading(view, title: String, text: String, invoker: Control) -> void:
	var dialog = AcceptDialog.new()
	dialog.title = title
	dialog.size = Vector2i(620, 410)
	view.add_child(dialog)
	var content = RichTextLabel.new()
	content.text = text
	content.selection_enabled = true
	content.focus_mode = Control.FOCUS_ALL
	content.accessibility_name = title + " text"
	content.tooltip_text = (
		"Tab to this reading area; Page Up / Page Down scroll. Escape closes and "
		+ "restores focus."
	)
	content.custom_minimum_size = Vector2(540, 300)
	dialog.add_child(content)
	PitwallDesign.scale_controls(dialog, view.text_scale)
	var dismiss = func():
		dialog.queue_free()
		if is_instance_valid(invoker) and invoker.is_visible_in_tree():
			PitwallDesign.focus_later(invoker)
	dialog.confirmed.connect(dismiss)
	dialog.canceled.connect(dismiss)
	dialog.popup_centered()
	PitwallDesign.focus_later(dialog.get_ok_button())


static func confirm_leave(view, proceed: Callable) -> void:
	if is_instance_valid(view.exit_dialog):
		return
	var kinds = view.unapplied_draft_kinds()
	if kinds.is_empty():
		proceed.call()
		return
	view.exit_dialog = ConfirmationDialog.new()
	view.exit_dialog.title = "Leave unapplied edits?"
	view.exit_dialog.dialog_text = (
		(
			"Your active race is saved separately. Unapplied %s edits will be discarded when "
			+ "this view closes.\n\nStay to review or approve them, or leave without applying."
		)
		% ", ".join(kinds)
	)
	view.exit_dialog.ok_button_text = "Leave without applying"
	view.exit_dialog.cancel_button_text = "Stay and review"
	view.add_child(view.exit_dialog)
	PitwallDesign.scale_controls(view.exit_dialog, view.text_scale)
	view.exit_dialog.confirmed.connect(
		func():
			view.exit_dialog.queue_free()
			proceed.call(),
	)
	view.exit_dialog.canceled.connect(
		func():
			view.exit_dialog.queue_free()
			PitwallDesign.focus_later(view.find_button),
	)
	view.exit_dialog.popup_centered(Vector2i(600, 200))
	PitwallDesign.focus_later(view.exit_dialog.get_cancel_button())


static func open_results_workspace(view) -> void:
	if view.results_workspace == null:
		return
	var invoker = view.get_viewport().gui_get_focus_owner()
	view.close_session_workspace()
	view.full_invoker = invoker
	view.full_workspace = view.results_workspace
	view.results_workspace.attach(view.results_panel)
	view.results_workspace.show()
	view.results_workspace.present()
	view.adapt_layout()
	PitwallDesign.focus_later(view.results_workspace.buttons[0])


static func close_session_workspace(view) -> void:
	var closing = is_instance_valid(view.full_workspace) and view.full_workspace.visible
	if is_instance_valid(view.full_workspace):
		view.full_workspace.hide()
	view.full_workspace = null
	if not view.teammate_buttons.is_empty():
		view.teammate_buttons[0].get_parent().show()
	if view.inspector_home and view.right_panel.get_parent() != view.inspector_home:
		view.right_panel.reparent(view.inspector_home)
		view.inspector_home.move_child(
			view.right_panel, mini(2, view.inspector_home.get_child_count() - 1)
		)
		view.right_panel.size_flags_horizontal = Control.SIZE_FILL
	if (
		view.results_panel
		and view.results_home
		and view.results_panel.get_parent() != view.results_home
	):
		view.results_panel.reparent(view.results_home)
	view.adapt_layout()
	if closing:
		PitwallDesign.focus_later(
			(
				view.full_invoker
				if is_instance_valid(view.full_invoker) and view.full_invoker.is_visible_in_tree()
				else view.watch_button
			)
		)


static func open_analysis_workspace(view) -> void:
	if view.analysis_workspace == null:
		return
	var invoker = view.get_viewport().gui_get_focus_owner()
	view.close_session_workspace()
	view.full_invoker = invoker
	view.full_workspace = view.analysis_workspace
	view.analysis_workspace.attach(view.right_panel)
	view.refresh_navigation()
	view.analysis_workspace.show()
	view.analysis_workspace.present()
	view.adapt_layout()
	PitwallDesign.focus_later(view.analysis_workspace.drivers[view.sim.player_ids()[0]])
