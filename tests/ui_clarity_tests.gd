extends "res://tests/tactical_duel_ui_tests.gd"
## UI-only regression coverage over shipped preparation scenarios and native controls.
## Resize/input tests are not human usability, hardware/controller or screen-reader tests.

func unobscured(control: Control) -> bool:
	if not inside(control): return false
	var node = control.get_parent()
	while node is Control:
		if node.clip_contents and not node.get_global_rect().encloses(control.get_global_rect()): return false
		node = node.get_parent()
	return true

func window_fits(window: Window) -> bool:
	return window.visible and Rect2i(Vector2i.ZERO, root.size).encloses(Rect2i(window.position, window.size))

func window_control_fits(window: Window, control: Control) -> bool:
	return window_fits(window) and control.is_visible_in_tree() and Rect2(Vector2.ZERO, Vector2(window.size)).encloses(control.get_global_rect())

func dialog_key(dialog: Window, code: Key) -> void:
	for down in [true, false]:
		var event = InputEventKey.new(); event.keycode = code; event.pressed = down
		dialog.push_input(event); await settle(3)

func reveal_limits(panel: TacticalPlanPanel) -> void:
	if panel.stage != "plan": await click(panel.edit_button)
	await scroll_to(panel.limits_button)
	if not panel.limits_body.visible: await click(panel.limits_button)

func run() -> void:
	root.size = Vector2i(1440,900); root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	app = root.get_node("App"); await settle()
	for resolution in [Vector2i(1440,900), Vector2i(1100,720)]:
		for scale in [1.0,1.15,1.3]:
			root.size = resolution; root.content_scale_size = resolution; app.settings.pitwall_text_scale = scale
			model = panel_fixture(); await reset(); view.duel_workspace.open_for(3); await settle(8)
			var panel = view.duel_workspace.panel
			var profile = "%dx%d-%d" % [resolution.x,resolution.y,roundi(scale*100)]
			check(panel.stage == "plan" and panel.plan_body.visible, "New draft starts at Plan / " + profile)
			check(not panel.review_body.visible and not panel.approve_button.is_visible_in_tree(), "Approval is not presented before comparison / " + profile)
			check(not panel.end_button.visible and not panel.extension_row.visible, "Absent mandate and irrelevant extension controls are omitted / " + profile)
			check(not panel.limits_body.visible, "Optional reserve editing starts collapsed / " + profile)
			check(unobscured(panel.picker) and unobscured(panel.refresh_button), "Explicit driver and primary action are not clipped / " + profile)
			check(panel.refresh_button.size.y >= ceilf(32*scale), "Primary target respects the scaled control minimum / " + profile)
			await capture("clarity-plan-"+profile, "Shipped untimed preparation fixture; unchanged draft and physics; actual native viewport/text scaling")
			var before = RaceRecord.fingerprint(model.snapshot())
			await click(panel.refresh_button)
			check(panel.stage == "review" and not panel.plan_body.visible, "Compare enters the separate review without losing the form / " + profile)
			check(root.gui_get_focus_owner() == panel.comparison, "Evidence has native keyboard focus / " + profile)
			check(unobscured(panel.approve_button) and unobscured(panel.refresh_button) and unobscured(panel.draft_label), "Approval and its explanation remain fixed outside the scroll / " + profile)
			check(panel.comparison.text.contains("Advice only") and panel.comparison.text.contains("Daniel Mercer"), "Reviewed target and execution consent are visible in the summary / " + profile)
			check(panel.case_copy.text.contains("RIVAL RESPONSE CASES") and panel.option_rows.size() == 3, "Alternatives and uncertainty are retained / " + profile)
			check(panel.fuel.get_line_edit().accessibility_name == "Minimum fuel remaining (laps)", "Semantic field name survives accessibility annotation / " + profile)
			await capture("clarity-review-"+profile, "Frozen comparison; model ranges and authority separate from approval")
			await click(panel.edit_button); await settle(8)
			check(root.gui_get_focus_owner() == panel.kind and unobscured(panel.kind), "Back to draft restores a visible editing target / " + profile)
			await reveal_limits(panel)
			await scroll_to(panel.fuel)
			check(unobscured(panel.fuel), "Expanded reserve field is reachable without horizontal scrolling / " + profile)
			await scroll_to(panel.limits_button); await click(panel.limits_button)
			check(root.gui_get_focus_owner() == panel.limits_button and not panel.limits_body.visible, "Collapsing keeps focus out of the hidden section / " + profile)
			check(before == RaceRecord.fingerprint(model.snapshot()), "Review, back and disclosure change no simulation/RNG state / " + profile)
			await click(panel.refresh_button); await click(panel.approve_button)
			check(panel.stage == "status" and not panel.approve_button.visible, "Approval leads to follow-up, not duplicate consent / " + profile)
			check(unobscured(panel.edit_button) and unobscured(panel.end_button), "Follow-up actions remain reachable / " + profile)
			check(root.gui_get_focus_owner() == panel.status_copy, "Successful approval focuses its receipt / " + profile)
			check(panel.status_copy.text.contains("advice only") and panel.status_copy.text.contains("Current pit owner: player"), "Receipt distinguishes original consent from current owner / " + profile)
			var receipt_scroll = panel.comparison_scroll()
			var before_reading = receipt_scroll.scroll_vertical
			var scroll_limit = int(receipt_scroll.get_v_scroll_bar().max_value - receipt_scroll.get_v_scroll_bar().page)
			await key(KEY_PAGEDOWN)
			check(before_reading >= scroll_limit or receipt_scroll.scroll_vertical > before_reading, "Keyboard reads the receipt when it overflows / " + profile)
			var expected_home = mini(scroll_limit, receipt_scroll.scroll_vertical + roundi(panel.status_copy.global_position.y - receipt_scroll.global_position.y))
			await key(KEY_HOME)
			check(absi(receipt_scroll.scroll_vertical - expected_home) <= 2, "Home returns to the receipt heading, not hidden comparison content / " + profile)
			await capture("clarity-receipt-"+profile, "Actual native approval of advice only; existing pit owner remains player")
			before = RaceRecord.fingerprint(model.snapshot())
			await click(view.find_button)
			var picker = view.navigator
			check(window_fits(picker), "First Find popup fits the viewport, including its bottom / " + profile)
			check(window_control_fits(picker, picker.destination_preview) and window_control_fits(picker, picker.get_ok_button()) and window_control_fits(picker, picker.get_cancel_button()), "Find preview and both footer actions stay on screen / " + profile)
			await capture("clarity-find-"+profile, "First native popup; wrapped preview and footer within the actual viewport")
			await dialog_key(picker, KEY_ESCAPE)
			check(not picker.visible and root.gui_get_focus_owner() == view.find_button and before == RaceRecord.fingerprint(model.snapshot()), "Find closes to its invoker without changing race state / " + profile)
	# All further checks run at the smallest retained large-text profile.
	var panel = view.duel_workspace.panel
	var before = RaceRecord.fingerprint(model.snapshot())
	await click(panel.end_button)
	check(panel.confirm_dialog != null and TacticalDuels.live(TacticalDuels.current(model,3)), "Opening End tactic does not end the mandate")
	if panel.confirm_dialog == null: quit(1); return
	check(panel.confirm_dialog.dialog_text.contains("STAYS VALID"), "Physical pit-stop consequence is in the confirmation, not a tooltip")
	check(panel.confirm_dialog.gui_get_focus_owner() == panel.confirm_dialog.get_cancel_button(), "Destructive confirmation defaults to keeping choices")
	await capture("clarity-confirm-end", "Native guarded cancellation dialog; existing mandate unchanged")
	await dialog_key(panel.confirm_dialog, KEY_ENTER)
	check(panel.confirm_dialog == null and before == RaceRecord.fingerprint(model.snapshot()), "Default Enter cancels safely without touching model/RNG")
	await click(panel.end_button); await dialog_key(panel.confirm_dialog, KEY_ESCAPE)
	check(before == RaceRecord.fingerprint(model.snapshot()) and root.gui_get_focus_owner() == panel.end_button, "Escape dismisses and restores the exact invoker")
	await click(panel.end_button); await click_dialog(panel.confirm_dialog.get_ok_button())
	check(panel.stage == "plan" and TacticalDuels.current(model,3).status == "abandoned", "Explicit confirmation ends only the pinned tactic")
	check(not TacticalDuels.live(TacticalDuels.current(model,6)), "No teammate mandate is fabricated")
	await reveal_limits(panel); panel.fuel.value = 0.8; await settle()
	var draft = panel.drafts[3].duplicate(true)
	await scroll_to(panel.reset_button); await click(panel.reset_button)
	await dialog_key(panel.confirm_dialog, KEY_ESCAPE)
	check(panel.drafts[3] == draft and edited_tactic(panel), "Cancel reset preserves the unapplied draft and dirty marker")
	await click(panel.reset_button); await click_dialog(panel.confirm_dialog.get_ok_button())
	check(panel.drafts[3] == TacticalForecast.draft(model,3) and not edited_tactic(panel), "Confirmed reset replaces only the unapplied draft")
	check(TacticalDuels.current(model,3).status == "abandoned", "Draft reset does not rewrite tactical evidence")
	# Validation focuses the actual native field and keeps the explanation next to Compare.
	panel.first.value = 10; panel.last.value = 3; panel.changed(); await settle()
	await click(panel.refresh_button); await settle(8)
	check(panel.stage == "plan" and panel.draft_label.text.contains("Latest lap must be at or after earliest lap"), "Invalid window gives a visible corrective explanation")
	check(root.gui_get_focus_owner() == panel.last.get_line_edit() and unobscured(panel.last.get_parent()), "Invalid window returns focus to the visible Latest lap field and label")
	await capture("clarity-invalid-window", "Synthetic invalid field combination; native validation focus; no race command")
	panel.last.value = 12; panel.changed(); await click(panel.refresh_button)
	var commands = model.commands.size()
	check(model.command("formation"), "Staleness fixture explicitly starts real formation")
	panel.refresh(); await settle()
	check(panel.approve_button.disabled and not panel.draft_label.text.is_empty(), "A material session change blocks stale approval and explains why")
	panel.approve(); check(model.commands.size() == commands + 1, "Programmatic repeated/stale activation cannot bypass disabled consent")
	# Search is a destination picker with an actionable empty state, not a command palette.
	before = RaceRecord.fingerprint(model.snapshot())
	await click(view.find_button); var finder = view.navigator
	finder.search.text = "does-not-exist"; finder.filter_views(finder.search.text); await settle()
	check(finder.matches.is_empty() and finder.get_ok_button().disabled and finder.destination_preview.text.contains("Clear"), "Empty search explains recovery and offers no phantom destination")
	check(window_control_fits(finder, finder.destination_preview) and window_control_fits(finder, finder.get_cancel_button()), "Empty-state explanation and exit remain on screen")
	await capture("clarity-find-empty", "Native Find empty state; current race time remains under player control")
	await click_dialog(finder.clear_button)
	check(finder.search.text.is_empty() and not finder.matches.is_empty() and finder.gui_get_focus_owner() == finder.search, "Clear restores all views and search focus")
	finder.search.text = "Tactical evidence"; finder.filter_views(finder.search.text); await settle()
	check(finder.matches.size() == 1 and finder.matches[0][1] == 1, "Tactical evidence resolves to its reading route, not the editor")
	check(finder.destination_preview.text.contains("physical stops"), "Selected destination explains the expected content")
	check(window_control_fits(finder, finder.destination_preview) and window_control_fits(finder, finder.get_ok_button()), "Exact-result preview and open action remain on screen")
	await capture("clarity-find-evidence", "Native exact-match search with destination explanation")
	await dialog_key(finder, KEY_ENTER); await settle()
	var reading: Window = null
	for window in root.get_embedded_subwindows():
		if window.visible and window.title == "Tactical evidence": reading = window
	check(reading != null, "Enter opens the promised tactical evidence reader")
	if reading != null: await dialog_key(reading, KEY_ESCAPE)
	check(root.gui_get_focus_owner() == view.find_button, "Evidence opened from Find returns focus to Find")
	check(before == RaceRecord.fingerprint(model.snapshot()), "Finding and reading destinations preserve model, commands, clock and RNG")
	# Pin cancellation to the reviewed revision even if a different command wins meanwhile.
	model = panel_fixture()
	check(model.command("formation"), "Guard fixture starts actual formation")
	check(await advance_until(func(): return model.phase == "grid_ready",240), "Guard fixture physically reaches the grid")
	check(model.command("lights"), "Guard fixture explicitly releases the lights")
	check(await advance_until(func(): return model.phase == "race",30), "Guard fixture reaches the live race")
	await reset(); view.duel_workspace.open_for(3); panel = view.duel_workspace.panel; await settle()
	await click(panel.refresh_button); await click(panel.approve_button); await click(panel.end_button)
	check(model.command("pit", {"id":3}), "Competing accepted pit order uses the normal authoritative boundary")
	commands = model.commands.size(); await click_dialog(panel.confirm_dialog.get_ok_button())
	check(model.commands.size() == commands and panel.draft_label.text.contains("changed"), "Stale confirmation cannot cancel a newer tactical revision")
	check(model.cars[3].pit_order, "A physical accepted stop survives a stale tactic-end confirmation")
	var report = {"passed":failures.is_empty(),"checks":checks,"errors":failures,"screenshots":captures.size(),"captures":captures,"engine":Engine.get_version_info().string}
	Storage.write_json("res://reports/ui-clarity.json",report); print("UI_CLARITY ",JSON.stringify(report)); quit(0 if failures.is_empty() else 1)

func edited_tactic(panel: TacticalPlanPanel) -> bool:
	return bool(panel.edited.get(panel.driver_id,false)) and view.unapplied_draft_kinds().has("tactical plan")
