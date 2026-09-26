extends "res://tests/ui_finish_execution_tests.gd"
## Full native guide traversal and shared-draft exits at supported desktop profiles.

func reachable(control: Control) -> bool:
	if not is_instance_valid(control) or not inside(control): return false
	var rect = control.get_global_rect()
	var parent = control.get_parent()
	while parent is Control:
		if parent.clip_contents and not parent.get_global_rect().grow(1).encloses(rect): return false
		parent = parent.get_parent()
	return true

func menu_item(menu: MenuButton, id: int) -> void:
	await click(menu)
	var target_index=menu.get_popup().get_item_index(id)
	for i in range(menu.get_popup().item_count+2):
		if menu.get_popup().get_focused_item()==target_index:break
		await key(KEY_DOWN)
	await key(KEY_ENTER)

func guide_dismiss() -> Button:
	return view.guide.counter.get_parent().get_child(1)

func run() -> void:
	game=load("res://scenes/main.tscn").instantiate();root.add_child(game)
	app=root.get_node("App");await settle()
	for profile in [[1440,900,1.0],[1280,800,1.15],[1100,720,1.3]]:
		root.size=Vector2i(profile[0],profile[1]);root.content_scale_size=root.size
		app.settings.pitwall_text_scale=profile[2]
		model=PracticeRaceSim.new(TrackGeometry.new(app.library[7]),{"laps":12,"scenario":"dry","intensity":"calm","seed":7314})
		model.paused=true;await reset()
		app.settings.guides={}; var signature=JSON.stringify(model.snapshot())
		await menu_item(view.weekend_menu,2)
		check(view.guide.visible,"G15 native Weekend menu opens the existing guide at "+str(profile))
		for step in range(view.guide.steps.size()):
			await settle(5)
			var title=view.guide.steps[step].title
			check(view.guide.step_index==step,"G15 native Next reaches "+title+" at "+str(profile))
			check(is_instance_valid(view.guide.target) and view.guide.target.is_visible_in_tree(),"G15 guide target is a visible composed control: "+title)
			check(reachable(view.guide.next_button) and reachable(guide_dismiss()),"G15 guide navigation stays in bounds: "+title+" "+str(profile))
			var obstruction=false
			var critical: Array[Control]=[view.session_header.pause_button,view.session_header.speed_control,view.weekend_menu]
			if view.primary_button.is_visible_in_tree():critical.append(view.primary_button)
			if is_instance_valid(view.full_workspace) and view.full_workspace==view.practice_workspace and view.full_workspace.visible:
				for id in [3,6]:
					if view.practice_workspace.panels[id].run.is_visible_in_tree():critical.append(view.practice_workspace.panels[id].run)
				if view.practice_workspace.session_action.is_visible_in_tree():critical.append(view.practice_workspace.session_action)
				if view.practice_workspace.finish.is_visible_in_tree():critical.append(view.practice_workspace.finish)
			if not is_instance_valid(view.full_workspace) or not view.full_workspace.visible:
				for id in [3,6]: critical.append(view.car_cards[id].name_label)
			for button in critical:
				if button.get_global_rect().intersects(view.guide.card.get_global_rect()):obstruction=true
			check(not obstruction,"G15 guide does not cover persistent controls or either car: "+title+" "+str(profile))
			check(signature==JSON.stringify(model.snapshot()),"G15 guide step is observation only: "+title)
			if step in [0,2,8,12,view.guide.steps.size()-1]:
				await capture("guide-%d-%d" % [profile[0],step],"Native complete guide traversal on a real unstarted weekend; guide/settings changes only")
			await click(view.guide.next_button)
		check(not view.guide.visible,"G15 native Finish dismisses the guide")
		view.close_session_workspace();view.close_detail();await settle()
		await menu_item(view.weekend_menu,2);await click(view.guide.next_button)
		var saved=view.guide.step_index
		await click(guide_dismiss());await menu_item(view.weekend_menu,2)
		check(view.guide.step_index==saved,"G15 dismissed guide resumes its saved step")
		await click(guide_dismiss());view.close_detail()
		# Exact same dictionaries in compact and full practice; default construction is clean.
		check(not view.practice_panel.has_user_edits(),"G15 default practice plans do not trigger abandonment warning")
		view.open_practice_workspace();await settle()
		var panel=view.practice_workspace.panels[6]
		await click(panel.objective_buttons.setup)
		check(view.practice_panel.drafts[6].objective=="setup" and view.practice_panel.edited.get(6,false),"G15 native programme edit is shared with compact route")
		check(not view.practice_panel.edited.get(3,false),"G15 teammate draft does not acquire the other driver's edit")
		var leaves=[0]
		view.confirm_leave(func():leaves[0]+=1);await settle()
		check(leaves[0]==0 and is_instance_valid(view.exit_dialog) and view.exit_dialog.dialog_text.contains("practice"),"G15 practice-only edits receive explicit safe-exit warning")
		if is_instance_valid(view.exit_dialog):
			var before=JSON.stringify(model.snapshot())
			await key(KEY_B);await key(KEY_5);await pad(JOY_BUTTON_START)
			check(before==JSON.stringify(model.snapshot()),"G16 modal blocks global keyboard and controller race actions")
			await key(KEY_SPACE) # Native Space may activate focused Stay; it is not a leaked pause.
			if is_instance_valid(view.exit_dialog) and view.exit_dialog.visible:await key(KEY_ESCAPE)
			check(before==JSON.stringify(model.snapshot()),"G16 native dialog activation does not become a race command")
			check(leaves[0]==0,"G15 canceled exit retains practice draft and current weekend")
	var report={"passed":failures.is_empty(),"checks":checks,"errors":failures,"captures":captures,"screenshots":captures.size(),"engine":Engine.get_version_info().string}
	Storage.write_json("res://reports/ui-finish-guide.json",report)
	print("UI_FINISH_GUIDE ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)

func race_fingerprint() -> String:
	var snapshot=model.snapshot();snapshot.erase("selected_id")
	return JSON.stringify(snapshot)

func scroll_to(control: Control) -> void:
	var ancestor=control.get_parent()
	while ancestor!=null and not ancestor is ScrollContainer:ancestor=ancestor.get_parent()
	if ancestor==null:return
	for i in range(35):
		if reachable(control):break
		var position=ancestor.get_global_rect().get_center()
		var event=InputEventMouseButton.new();event.position=position;event.global_position=position;event.pressed=true;event.factor=3
		event.button_index=MOUSE_BUTTON_WHEEL_UP if control.global_position.y<ancestor.global_position.y else MOUSE_BUTTON_WHEEL_DOWN
		Input.parse_input_event(event)
		var release=event.duplicate();release.pressed=false;Input.parse_input_event(release);await settle(2)
