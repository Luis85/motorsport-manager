extends SceneTree
## Native mouse/key paths; original node, drafts, memory, time and disk stay intact.
var checks=0
var failures: Array[String]=[]
var captures=0
var game
var app
var view
func _initialize(): call_deferred("run")
func check(value: bool,message: String):
	checks+=1
	if not value: failures.append(message);push_error(message)
func settle(count:int=5):
	for i in range(count): await process_frame
func point(c:Control)->Vector2:
	var p=c.get_global_rect().get_center()
	var window=c.get_window()
	if window != root: p+=Vector2(window.position)
	return p
func click(c:Control):
	var p=point(c)
	var move=InputEventMouseMotion.new();move.position=p;Input.parse_input_event(move)
	for pressed in [true,false]:
		var e=InputEventMouseButton.new();e.position=p;e.button_index=MOUSE_BUTTON_LEFT;e.pressed=pressed;Input.parse_input_event(e);await settle(2)
func key(code:Key,ctrl:bool=false):
	for pressed in [true,false]:
		var e=InputEventKey.new();e.keycode=code;e.pressed=pressed;e.ctrl_pressed=ctrl;Input.parse_input_event(e);await settle(2)
func inside(c:Control)->bool:
	if not c.is_visible_in_tree() or not root.get_visible_rect().encloses(c.get_global_rect()):return false
	var node=c.get_parent()
	while node:
		if node is Control and node.clip_contents and not node.get_global_rect().encloses(c.get_global_rect()):return false
		node=node.get_parent()
	return true
func capture(name:String):
	await settle();await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/scenario-authoring-"+name+".png");captures+=1
func build(size:Vector2i,scale:float):
	root.size=size;root.content_scale_size=size;app.settings.pitwall_text_scale=scale
	app.weekend=RivalScenarios.build(RivalScenarios.catalog()[0],app.library)
	game.show_weekend();view=game.content.get_child(0);view.set_process(false);view.guide.hide()
	await settle();view.open_topic(7);view.refresh();await settle()
func run():
	game=load("res://scenes/main.tscn").instantiate();root.add_child(game);app=root.get_node("App");await settle()
	app.checkpoint_path="user://replay-ui-original.json";app.sandbox_path="user://replay-ui-sandbox.json"
	for size in [Vector2i(1440,900),Vector2i(1100,720)]:
		for scale in [1.0,1.15,1.3]:
			await build(size,scale)
			var sim=app.weekend
			view.practice_panel.drafts[3].laps=3
			check(app.save_weekend().is_empty(),"Save original before UI experiment")
			var before=JSON.stringify(sim.snapshot());var disk=FileAccess.get_file_as_bytes(app.checkpoint_path)
			check(inside(view.replay_button) and inside(view.bookmark_button),"Review replay/checkpoint actions fit "+str(size)+" / "+str(scale))
			await click(view.replay_button)
			var replay=game.replay_controller.workspace
			check(replay!=null,"Native review action opens replay")
			if replay==null:continue
			check(inside(replay.return_button) and inside(replay.branch_button) and inside(replay.picker),"Viewer keeps primary actions visible "+str(size)+" / "+str(scale))
			check(not view.visible and view.process_mode==Node.PROCESS_MODE_DISABLED and JSON.stringify(sim.snapshot())==before,"Replay suspends the original view without writing pause/speed/RNG")
			check(replay.status.text.contains("not re-simulated"),"Saved snapshot is not falsely labeled a verified race")
			replay.picker.grab_focus();await key(KEY_SPACE);await key(KEY_5)
			check(JSON.stringify(sim.snapshot())==before,"Replay picker shortcuts never target original race")
			await key(KEY_ESCAPE) # Close picker popup, if Space opened it.
			if game.replay_controller.workspace==null:
				await click(view.replay_button);replay=game.replay_controller.workspace
			await click(replay.branch_button)
			check(replay.sandbox_view!=null and replay.sandbox_record.origin=="sandbox","Native branch action opens a labeled sandbox")
			if replay.sandbox_view==null:continue
			replay.sandbox_view.set_process(false)
			check(inside(replay.return_button) and inside(replay.sandbox_return) and inside(replay.sandbox_view.pause_button),"Sandbox and original return controls remain reachable "+str(size)+" / "+str(scale))
			check(FileAccess.get_file_as_bytes(app.checkpoint_path)==disk,"Sandbox initial phase autosave does not rewrite original slot")
			var branch=replay.sandbox_view.sim
			await click(replay.sandbox_view.primary_button)
			check(branch.phase=="formation" and JSON.stringify(sim.snapshot())==before,"Formation click changes only sandbox")
			replay.sandbox_view.refresh();await settle()
			check(FileAccess.get_file_as_bytes(app.checkpoint_path)==disk,"Sandbox phase transition autosave cannot touch original disk bytes")
			var saved=Storage.read_json(app.sandbox_path)
			check(saved.ok and saved.data.record.origin=="sandbox" and saved.data.record.event_id!=view.recording.event_id,"Phase autosave writes separately identified sandbox envelope")
			if size==Vector2i(1100,720) and scale==1.3:await capture("sandbox-1100x720-text130")
			await click(replay.sandbox_return)
			check(replay.sandbox_view==null and inside(replay.branch_button),"Return to replay saves and closes sandbox")
			if size==Vector2i(1100,720) and scale==1.3:await capture("1100x720-text130")
			await click(replay.return_button)
			check(game.content.get_child(0)==view and view.visible and view.practice_panel.drafts[3].laps==3,"Original view identity and unapplied practice draft survive round trip")
			check(JSON.stringify(sim.snapshot())==before and FileAccess.get_file_as_bytes(app.checkpoint_path)==disk,"Round trip preserves complete original memory and save")
	await build(Vector2i(1100,720),1.3)
	check(not game.replay_controller.open_data({"kind":false}).is_empty() and game.replay_controller.workspace==null,"Wrong-type import header is rejected before suspending the original")
	var before=JSON.stringify(app.weekend.snapshot());await click(view.replay_button)
	var replay=game.replay_controller.workspace
	await click(replay.export_scenario_button);await settle()
	var author=replay.author
	check(is_instance_valid(author) and author.visible,"Authoring opens from the frozen replay state")
	author.fields.title.text="";author.submit()
	check(author.visible and author.notice.text.contains("title"),"Invalid draft keeps form open with a reason")
	author.fields.title.text="Hold or stop?";author.goal.select(1)
	author.fields.hint.text="Changing an approach changes exposure, not a promised win. ".repeat(10)
	author.goal.grab_focus();await settle()
	check(inside(author.get_ok_button()) and inside(author.get_cancel_button()),"Author actions remain outside the scrolled form")
	await capture("scenario-author-1100x720-text130")
	check(root.get_visible_rect().encloses(Rect2(Vector2(author.position),Vector2(author.size))),"Enlarged-text author dialog stays inside native viewport")
	var exported: Array=[];author.scenario_ready.connect(func(data):exported.append(data))
	# Native OK click triggers validation and opens the actual file dialog.
	await click(author.get_ok_button());await settle()
	check(exported.size()==1 and ReplayScenario.validate(exported[0]).is_empty(),"Native author confirmation produces validated scenario data")
	var dialogs=replay.get_children().filter(func(n):return n is FileDialog and n.visible)
	check(dialogs.size()==1,"Scenario export requires explicit file destination")
	if not dialogs.is_empty():
		var dialog:FileDialog=dialogs[0]
		if FileAccess.file_exists("user://authored-replay-ui.scenario.json"):DirAccess.remove_absolute("user://authored-replay-ui.scenario.json")
		dialog.current_path=ProjectSettings.globalize_path("user://authored-replay-ui.scenario.json")
		await click(dialog.get_ok_button());await settle()
		var saved_export=Storage.read_json("user://authored-replay-ui.scenario.json")
		check(saved_export.ok and saved_export.data.digest==exported[0].digest,"Native file-confirm writes this authored scenario, not a stale export")
		# Close the success acknowledgement before navigating back.
		await key(KEY_ESCAPE);await settle()
	check(JSON.stringify(app.weekend.snapshot())==before,"Authoring and export never advance original time or spend resources")
	game.replay_controller.close();await settle()
	if exported.size()==1:
		var bad=exported[0].duplicate(true);bad.brief.title="tampered"
		check(not game.replay_controller.open_data(bad).is_empty() and game.replay_controller.workspace==null,"Invalid scenario import leaves the original view active")
		check(game.replay_controller.open_data(exported[0]).is_empty(),"Authored scenario imports through replay-only entry")
		replay=game.replay_controller.workspace;await settle();await click(replay.branch_button);replay.sandbox_view.set_process(false)
		check(replay.sandbox_record.parent.scenario.goal=="finish_both" and replay.scenario_status.text.contains("pending"),"Authored instructions and observed goal follow the sandbox")
		await click(replay.scenario_details_button);await settle()
		var readers=replay.sandbox_view.get_children().filter(func(n):return n is AcceptDialog and n.visible)
		check(readers.size()==1 and root.get_visible_rect().encloses(Rect2(Vector2(readers[0].position),Vector2(readers[0].size))),"Long authored briefing uses a bounded native reader")
		await key(KEY_ESCAPE);await settle()
		await capture("authored-sandbox-1100x720-text130")
		await click(replay.sandbox_return);await click(replay.return_button)
	var report={"passed":failures.is_empty(),"checks":checks,"failures":failures,"screenshots":captures}
	Storage.write_json("res://reports/scenario-authoring-ui.json",report);print("SCENARIO_AUTHORING_UI ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
