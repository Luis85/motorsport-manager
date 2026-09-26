extends "res://tests/ui_finish_observation_tests.gd"
## Native pointer/key inputs over the existing application; no browser replacement.
func scroll_to(control: Control) -> void:
	var page = control.get_parent()
	while page != null and not page is ScrollContainer: page = page.get_parent()
	if page != null: page.ensure_control_visible(control)
	await settle(8)

func panel_fixture() -> PracticeRaceSim:
	return DuelScenarios.build(DuelScenarios.catalog()[0], app.library)

func run() -> void:
	root.size = Vector2i(1440,900); root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	app = root.get_node("App"); await settle()
	app.settings.pitwall_text_scale = 1.0
	model = panel_fixture(); await reset()
	check(view.duel_workspace != null, "New native weekends expose integrated tactical controls")
	if view.duel_workspace == null: quit(1); return
	var workspace = view.duel_workspace; var panel = workspace.panel
	workspace.open_for(3); await settle(8)
	var before = RaceRecord.fingerprint(model.snapshot())
	await click(panel.refresh_button)
	check(panel.preview.get("available", false), "Native Compare produces a feasible preparation comparison")
	check(root.gui_get_focus_owner() == panel.comparison, "Comparison moves focus to the frozen evidence, not a command")
	check(panel.comparison.text.contains("RIVAL RESPONSE CASES"), "The player can compare response assumptions without a hidden-rival oracle")
	var evidence_scroll = panel.comparison_scroll()
	check(absf(panel.comparison.global_position.y - evidence_scroll.global_position.y) < 15, "Long comparison opens at its heading rather than hiding its first options")
	var scroll_before = evidence_scroll.scroll_vertical
	await key(KEY_PAGEDOWN)
	check(evidence_scroll.scroll_vertical > scroll_before, "Native Page Down reads long tactical evidence")
	await key(KEY_HOME)
	check(absf(panel.comparison.global_position.y - evidence_scroll.global_position.y) < 15, "Native Home returns to the captured driver and time")
	check(not panel.approve_button.disabled, "Review unlocks explicit recommendation approval")
	check(before == RaceRecord.fingerprint(model.snapshot()), "Comparison does not mutate commands, clock, tyres or random state")
	await click(panel.approve_button)
	check(TacticalDuels.current(model,3).plan.authority == "recommend", "Default native approval grants no execution authority")
	check(model.policy(3).owners.pit == "player", "Recommendation preserves manual pit ownership")
	await click(panel.end_button)
	check(TacticalDuels.current(model,3).status == "abandoned", "Native End plan explicitly ends the recommendation")
	await scroll_to(panel.authority); panel.authority.grab_focus(); await key(KEY_ENTER); await key(KEY_DOWN); await key(KEY_ENTER)
	check(panel.drafts[3].authority == "execute", "Native keyboard explicitly selects pit authority")
	check(view.unapplied_draft_kinds().has("tactical plan"), "Edited tactical draft participates in existing safe-exit guard")
	await scroll_to(panel.picker); panel.picker.grab_focus(); await key(KEY_ENTER); await key(KEY_DOWN); await key(KEY_ENTER)
	check(panel.driver_id == 6 and model.selected_id == 6, "Native driver picker explicitly targets Moreau")
	check(panel.drafts[6].authority == "recommend", "A teammate does not inherit Mercer's unapplied authority")
	panel.picker.grab_focus(); await key(KEY_ENTER); await key(KEY_UP); await key(KEY_ENTER)
	check(panel.driver_id == 3 and panel.drafts[3].authority == "execute", "Driver navigation retains the correct unapplied draft")
	await click(panel.refresh_button); await click(panel.approve_button)
	check(TacticalDuels.current(model,3).borrowed_pits and not TacticalDuels.live(TacticalDuels.current(model,6)), "Approval changes only the reviewed driver")
	check(not view.unapplied_draft_kinds().has("tactical plan"), "Successful approval clears the corresponding unsaved draft marker")
	var accepted = model.commands.size(); await click(panel.approve_button)
	check(model.commands.size() == accepted, "Repeated activation cannot duplicate a committed mandate")
	await scroll_to(panel.evidence_button); before = RaceRecord.fingerprint(model.snapshot())
	await click(panel.evidence_button); await settle()
	check(before == RaceRecord.fingerprint(model.snapshot()), "Tactical evidence is an observation, not an implicit pause or order")
	await key(KEY_ESCAPE); await settle()
	check(root.gui_get_focus_owner() == panel.evidence_button, "Escape restores the evidence invoker")
	await scroll_to(panel.team_button); await click(panel.team_button); await key(KEY_ESCAPE)
	check(root.gui_get_focus_owner() == panel.team_button, "Two-car comparison returns native focus")
	await click(panel.refresh_button)
	await capture("duels-comparison", "Native Compare scrolls to fixed evidence with conditional rival response cases; no command")
	await scroll_to(panel.picker)
	await capture("duels-authority", "Shipped untimed preparation grid; native recommendation, cancel, keyboard authority and approval")
	for resolution in [Vector2i(1440,900),Vector2i(1100,720)]:
		for scale in [1.0,1.15,1.3]:
			root.size = resolution; root.content_scale_size = resolution; app.settings.pitwall_text_scale = scale
			await reset(); workspace = view.duel_workspace; panel = workspace.panel; workspace.open_for(3); await settle(8)
			for control in [panel.refresh_button,panel.approve_button,panel.end_button,view.pause_button]:
				check(inside(control), "Primary action reachable at %s / %.2f: %s" % [resolution,scale,control.text])
			await scroll_to(panel.fuel)
			check(inside(panel.fuel), "Reserve can be reached without horizontal scrolling")
			await scroll_to(panel.picker)
			check(inside(panel.picker), "Driver identity can be reached at every retained size")
			check(model.policy(3).owners.pit == "engineer", "Layout and text settings preserve the existing approved authority")
			await capture("duels-%dx%d-%d" % [resolution.x,resolution.y,roundi(scale*100)], "Same approved record; actual resized native viewport/text scale")
	# Physical execution from the same declared preparation fixture. No synthetic finish.
	model = panel_fixture(); check(model.command("formation"), "Shipped scenario starts actual formation")
	check(await advance_until(func():return model.phase == "grid_ready",240), "Formation physically reaches the grid")
	check(model.command("lights"), "Lights require explicit approval")
	check(await advance_until(func():return model.phase == "race",30), "Actual lights lead to racing")
	await reset(); workspace = view.duel_workspace; panel = workspace.panel; workspace.open_for(3); await settle()
	# Input fields use real native controls; fixture values isolate legal command execution.
	panel.authority.select(1); panel.traffic.button_pressed=false; panel.rival_first.button_pressed=false
	panel.fuel.value=0; panel.floor_life.value=5; panel.changed()
	await click(panel.refresh_button); await click(panel.approve_button)
	check(TacticalDuels.current(model,3).get("borrowed_pits",false), "Native live comparison grants a bounded physical pit mandate")
	check(await advance_until(func():return TacticalDuels.current(model,3).get("own_entry",-1)>=0,300), "Native approved mandate produces physical entry")
	check(await advance_until(func():return TacticalDuels.current(model,3).get("own_exit",-1)>=0,150), "Service and physical exit complete without manual animation")
	view.refresh(); await settle()
	check(model.policy(3).owners.pit == "player", "Physical completion hands back to the previous owner")
	await capture("duels-physical-exit", "Actual mandate approval, physical entry, service, fitting and exit")
	await focus_return_checks(panel)
	var report={"passed":failures.is_empty(),"checks":checks,"errors":failures,"screenshots":captures.size(),"captures":captures,"engine":Engine.get_version_info().string}
	Storage.write_json("res://reports/tactical-duel-ui.json",report); print("TACTICAL_DUEL_UI ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)

func find_action(node: Node, text: String):
	if node is Button and node.text == text: return node
	for child in node.get_children():
		var found = find_action(child, text)
		if found != null: return found
	return null

func focus_return_checks(panel: TacticalPlanPanel) -> void:
	# Exercise the full-size route at the smallest enlarged-text profile. The same
	# actual post-service race and draft controls are retained; no fixture outcome is injected.
	panel.authority.select(1); panel.changed()
	var draft = panel.drafts[3].duplicate(true)
	var before = RaceRecord.fingerprint(model.snapshot())
	await click(view.focus_button); await settle(10)
	check(view.full_workspace == view.analysis_workspace and view.analysis_workspace.visible, "Native Focus opens the current tactical task")
	check(panel == view.duel_workspace.panel, "Focused tactics reuse the same draft controls")
	check(panel.comparison_scroll().size.y >= 200, "Focused form provides useful reading height at 1100/130")
	check(inside(view.pause_button), "Focused tactics keep player time control reachable")
	for id in [3,6]: check(inside(view.analysis_workspace.drivers[id]), "Both named drivers remain reachable in focused tactics")
	await scroll_to(panel.fuel)
	check(inside(panel.fuel), "Focused reserves remain reachable with native scrolling")
	await click(panel.refresh_button)
	check(root.gui_get_focus_owner() == panel.comparison, "Focused comparison receives keyboard focus")
	check(inside(panel.approve_button) and inside(panel.end_button), "Focused commit controls remain outside the scrolling form")
	await capture("duels-focused", "Actual post-service race; native Focus reuses the same unapplied draft and comparison")
	var back = find_action(view.analysis_workspace, "Back to pit wall")
	check(back != null, "Focused tactics provide a visible return action")
	if back != null: await click(back)
	await settle(10)
	check(view.full_workspace == null and view.race_workspace.visible, "Return restores the native pit wall")
	check(panel.drafts[3] == draft and view.unapplied_draft_kinds().has("tactical plan"), "Return retains the explicit driver's unapplied draft")
	check(before == RaceRecord.fingerprint(model.snapshot()), "Focus, comparison and return preserve authoritative state and RNG")
	check(view.focus_button.is_visible_in_tree() and root.gui_get_focus_owner() == view.focus_button, "Return restores the visible native invoker without a telemetry refresh")
	await capture("duels-focus-return", "Same physical post-service state, draft and invoker restored without advancing time")
