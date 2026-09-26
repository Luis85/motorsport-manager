extends SceneTree
## Real native input, comparative layout and public-information presentation.
var checks=0
var failures: Array[String]=[]
var captures=0
var game
var app
var view
var sim
func _initialize(): call_deferred("run")
func check(value: bool,message: String):
	checks+=1
	if not value: failures.append(message);push_error(message)
func settle(count: int=6):
	for i in range(count): await process_frame
func inside(c: Control)->bool:
	if not c.is_visible_in_tree() or not root.get_visible_rect().encloses(c.get_global_rect()): return false
	var parent=c.get_parent()
	while parent:
		if parent is Control and parent.clip_contents and not parent.get_global_rect().encloses(c.get_global_rect()): return false
		parent=parent.get_parent()
	return true
func click(control:Control):
	var point=control.get_global_rect().get_center()
	var move=InputEventMouseMotion.new();move.position=point;Input.parse_input_event(move)
	for pressed in [true,false]:
		var e=InputEventMouseButton.new();e.position=point;e.button_index=MOUSE_BUTTON_LEFT;e.pressed=pressed;Input.parse_input_event(e);await settle(2)
func key(value:Key,ctrl:bool=false):
	for pressed in [true,false]:
		var e=InputEventKey.new();e.keycode=value;e.pressed=pressed;e.ctrl_pressed=ctrl;Input.parse_input_event(e);await settle(2)
func capture(name:String):
	await settle();await RenderingServer.frame_post_draw
	root.get_texture().get_image().save_png("res://reports/rivals-"+name+".png");captures+=1
func build(size:Vector2i,scale:float):
	root.size=size;root.content_scale_size=size;app.settings.pitwall_text_scale=scale
	sim=RivalScenarios.build(RivalScenarios.catalog()[0],app.library)
	sim.phase="race";sim.paused=true
	for c in sim.cars: c.distance=300+(12-c.id)*24;c.previous_distance=c.distance;c.speed=40.0
	app.weekend=sim;game.show_weekend();view=game.content.get_child(0);view.set_process(false)
	await settle();view.canvas.fit();await settle()
func run():
	game=load("res://scenes/main.tscn").instantiate();root.add_child(game);app=root.get_node("App");await settle()
	for size in [Vector2i(1440,900),Vector2i(1100,720)]:
		for scale in [1.0,1.15,1.3]:
			await build(size,scale)
			var label="%dx%d-text%d"%[size.x,size.y,roundi(scale*100)]
			check(inside(view.pause_button) and inside(view.speed_control) and inside(view.weekend_menu),"Single header time/menu controls fit "+label)
			check(inside(view.decision_controls[3].box) and inside(view.decision_controls[6].box),"Both named Box targets remain fixed "+label)
			check(view.car_cards[3].status.text.contains("Engineer") and view.car_cards[3].facts[2].get_parent().get_child(0).text.contains("YOU"),"Pace and pit ownership are distinguished "+label)
			var before=JSON.stringify(sim.snapshot())
			await click(view.group_buttons.Strategy);await settle()
			check(view.strategy_desk.topic_buttons[0].get_parent()==view.topic_buttons[view.practice_page_index].get_parent() and not view.context_navigation.visible,"Compare/Plan/Control/Practice share one navigation row "+label)
			var all_options=true
			for row in view.comparison.rows: all_options=all_options and inside(row.panel)
			check(all_options,"All three complete alternatives fit without scrolling "+label)
			for id in [3,6]:
				var readable_actions=true
				for button in view.car_cards[id].actions.get_children():
					if not button.is_visible_in_tree(): continue
					var label_width=button.get_theme_font("font").get_string_size(button.text,HORIZONTAL_ALIGNMENT_LEFT,-1,button.get_theme_font_size("font_size")).x
					var decoration=button.get_theme_stylebox("normal").get_minimum_size().x
					readable_actions=readable_actions and inside(button) and button.size.y>=ceilf(32*scale) and button.get_theme_font_size("font_size")==roundi(12*scale) and button.size.x>=ceilf(label_width+decoration)
				check(readable_actions,"Complete driver action labels and scaled targets remain visible %d / %s"%[id,label])
			check(before==JSON.stringify(sim.snapshot()),"Mouse navigation never commits or advances "+label)
			await capture(label)
	await build(Vector2i(1920,1080),1.3);await capture("wide-watch")
	check(inside(view.decision_controls[6].box) and view.canvas.size.x>1000,"Wide desktop preserves dominant circuit and both drivers")
	await build(Vector2i(1100,720),1.3)
	var retained_styles=[]
	for button in view.car_cards[3].actions.get_children(): retained_styles.append(button.get_theme_stylebox("normal").get_instance_id())
	for i in range(20): view.refresh()
	var refreshed_styles=[]
	for button in view.car_cards[3].actions.get_children(): refreshed_styles.append(button.get_theme_stylebox("normal").get_instance_id())
	check(retained_styles==refreshed_styles,"Driver action styles are reused during telemetry refresh, not rebuilt")
	var before=JSON.stringify(sim.snapshot())
	await click(view.weekend_menu)
	check(view.weekend_menu.get_popup().visible and before==JSON.stringify(sim.snapshot()),"Actual menu click opens a native popup without changing pause or gameplay")
	await capture("weekend-popup");await key(KEY_ESCAPE)
	check(not view.weekend_menu.get_popup().visible and root.gui_get_focus_owner()==view.weekend_menu,"Escape closes utility menu and returns focus")
	await key(KEY_K,true);view.navigator.search.text="rival";view.navigator.filter_views("rival");await key(KEY_ENTER)
	check(view.right_panel.visible and view.tabs.current_tab==8 and view.team_panel.topics.selected==1,"Keyboard Find navigates to Team/Battles without a race command")
	await click(view.rivals_button);await settle()
	var dialogs=root.get_embedded_subwindows().filter(func(w):return w.visible and w is AcceptDialog)
	check(not dialogs.is_empty() and before==JSON.stringify(sim.snapshot()),"Public profile action is observational and keyboard-readable")
	if not dialogs.is_empty():
		var rich=dialogs[0].get_children().filter(func(n):return n is RichTextLabel)[0]
		var fg=rich.get_theme_color("default_color").srgb_to_linear();var bg=dialogs[0].get_theme_stylebox("panel").bg_color.srgb_to_linear()
		var dark=fg.r*0.2126+fg.g*0.7152+fg.b*0.0722;var light=bg.r*0.2126+bg.g*0.7152+bg.b*0.0722
		check((light+0.05)/(dark+0.05)>=4.5,"Actual rich-text foreground contrasts against the rendered dialog paper")
	await capture("public-field");await key(KEY_ESCAPE);await settle()
	view.select_driver(0);view.open_topic(3);await settle()
	check(view.public_inspector.masks[3].is_visible_in_tree() and not view.wheel_dashboard.is_visible_in_tree() and not view.tyre_buttons[0].is_visible_in_tree(),"Rival inspection does not reveal exact private wheel condition or stock")
	check(not view.rows[0].get_tooltip_text(0).contains("Tyres ") and view.rows[0].get_text(4)=="RUN","Public timing uses run status rather than exact rival tread")
	await capture("rival-inspector")
	view.select_driver(3);view.open_topic(0);view.show_drive(0);await settle()
	check(view.pace.is_visible_in_tree() and not view.public_inspector.masks[0].visible,"Returning to own driver restores the real controls")
	view.pace.grab_focus();before=JSON.stringify(sim.snapshot());await key(KEY_B);await key(KEY_5)
	check(before==JSON.stringify(sim.snapshot()),"Race shortcuts do not fire while a native picker owns focus")
	view.open_practice(3);await settle();view.practice_panel.drafts[3].laps=3
	view.open_topic(8);view.team_panel.show_topic(1);view.open_practice(3);await settle()
	check(view.practice_panel.drafts[3].laps==3,"Unapplied practice draft survives rival-field navigation")
	app.settings.pitwall_text_scale=1.0;root.size=Vector2i(1100,720);root.content_scale_size=root.size
	game.show_rival_scenarios();await settle();await capture("scenarios")
	var report={"passed":failures.is_empty(),"checks":checks,"failures":failures,"screenshots":captures}
	Storage.write_json("res://reports/rivals-ui.json",report);print("RIVALS_UI ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
