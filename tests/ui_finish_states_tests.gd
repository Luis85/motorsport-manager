extends "res://tests/ui_finish_populated_tests.gd"
## Production component-state fixture and disclosed synthetic retention boundaries.
## These messages/conditions are diagnostic load, not physical race observations.
var contrast_measurements: Array = []

func contrast(a: Color,b: Color) -> float:
	var x=a.srgb_to_linear();var y=b.srgb_to_linear()
	var first=0.2126*x.r+0.7152*x.g+0.0722*x.b
	var second=0.2126*y.r+0.7152*y.g+0.0722*y.b
	return (maxf(first,second)+0.05)/(minf(first,second)+0.05)

func style_fixture(scale_factor: float) -> void:
	view.hide()
	var fixture=UI.panel();game.add_child(fixture);fixture.position=Vector2(30,110);fixture.size=Vector2(1000,540)
	var body=UI.vbox(fixture)
	body.add_child(UI.label("NATIVE PRODUCTION CONTROL STATES",22,UI.INK))
	body.add_child(UI.paragraph("Diagnostic fixture only · no sporting data · same theme, controls and cached styles as the live pit wall."))
	var buttons=UI.hbox(body);var all: Array[Button]=[]
	for label in ["Normal","Hover","Focus","Pressed","Selected","Disabled"]:
		var button=PitwallDesign.race_button(label,func():pass,label=="Pressed");buttons.add_child(button);all.append(button)
		if label=="Disabled":button.disabled=true;button.tooltip_text="Unavailable in this disclosed fixture; no command is dispatched."
		if label=="Selected":PitwallDesign.navigation(button,true)
	var badges=HFlowContainer.new();body.add_child(badges)
	for state in [["Clear","neutral"],["Forecast","info"],["Draft","warning"],["Critical","danger"],["Executing","info"],["Stale evidence","warning"],["Acknowledged","good"],["Completed","good"]]:
		var badge=RaceStatusBadge.new();badges.add_child(badge);badge.present(state[0],state[1])
	var identity=UI.hbox(body)
	for id in [3,6]:
		var emblem=RaceDriverEmblem.new();emblem.number=model.cars[id].number;emblem.tint=Color(model.cars[id].color);identity.add_child(emblem)
		identity.add_child(UI.label(model.cars[id].name,18,UI.INK))
	body.add_child(UI.paragraph("Color is redundant: selection has an underline; severity, forecasts, drafts and action stages are named. No state transition moves the hit target."))
	PitwallDesign.scale_controls(fixture,scale_factor);PitwallDesign.linear_focus(all);RaceAccessibility.describe(fixture)
	await settle(5)
	var base=all[1].get_global_rect()
	var motion=InputEventMouseMotion.new();motion.position=base.get_center();motion.global_position=motion.position;Input.parse_input_event(motion);await settle()
	check(all[1].get_draw_mode()==BaseButton.DRAW_HOVER,"G18 production hover is reached by native pointer")
	all[2].grab_focus();await settle()
	var down=InputEventMouseButton.new();down.position=all[3].get_global_rect().get_center();down.global_position=down.position;down.button_index=MOUSE_BUTTON_LEFT;down.pressed=true
	Input.parse_input_event(down);await settle()
	for button in all.slice(0,5):
		var state="hover" if button==all[1] else "pressed" if button==all[3] else "normal"
		var ink=button.get_theme_color("font_"+state+"_color") if state!="normal" else button.get_theme_color("font_color")
		var paper=button.get_theme_stylebox(state).bg_color
		if paper.a==0:paper=UI.PANEL
		var measured=contrast(ink,paper)
		contrast_measurements.append({"control":button.text,"state":state,"scale":scale_factor,"ratio":measured})
		check(measured>=4.5,"G18 measured state text contrast meets the declared 4.5 target: "+button.text+" "+str(scale_factor))
	check(base==all[1].get_global_rect(),"G18 native state changes preserve hit-target geometry")
	await capture("component-states-"+str(roundi(scale_factor*100)),"Synthetic native production component-state fixture; not an approved additional product screen")
	down.pressed=false;Input.parse_input_event(down);await settle()
	var cached=PitwallDesign.race_styles.size();var node_count=get_node_count()
	for i in range(60):
		for button in all:PitwallDesign.navigation(button,button.text=="Selected")
	check(cached==PitwallDesign.race_styles.size() and node_count==get_node_count(),"G18 repeated state application does not allocate new controls or race styles")
	fixture.queue_free();view.show();await settle()

func run() -> void:
	root.size=Vector2i(1100,720);root.content_scale_size=root.size
	game=load("res://scenes/main.tscn").instantiate();root.add_child(game);app=root.get_node("App");await settle();app.settings.pitwall_text_scale=1.3
	model=race_fixture();await reset()
	view.open_weather(3);await click(view.focus_button);await settle()
	var links=view.weather_panel.get("sector_buttons")
	check(links!=null,"G07 observed sectors link to the existing surface inspector")
	if links!=null:
		var signature=race_fingerprint();await click(links[1]);await settle()
		check(view.canvas.show_surface and model.track.sector_at(view.canvas.inspected_fraction*model.track.length)==1,"G07 native sector link locates that measured track sector")
		check(signature==race_fingerprint(),"G07 sector selection changes only observation, never weather, speed or orders")
		await capture("sector-link","Native observed sector selection on a disclosed synthetic race-entry boundary")
	view.close_session_workspace();view.close_detail()
	for i in range(2010):model.post("radio","DIAGNOSTIC %04d · " % i+"Long retained native message; not an actual incident. ".repeat(7))
	view.open_topic(2);await click(view.focus_button);await settle()
	var radio=view.radio_inspector;var signature=race_fingerprint()
	check(model.events.size()==2000 and radio.caption.text.contains("2000"),"G13 retention limit is explicit; control count does not scale with events")
	check(radio.rows.size()==8,"G13 long history uses eight stable message cards")
	await scroll_to(radio.older);check(reachable(radio.older),"G13 native wheel scrolling exposes history pagination")
	await click(radio.older);var snapshot=radio.frozen.duplicate(true);var page=radio.page
	var focus=root.gui_get_focus_owner();var row_id=radio.rows[0].panel.get_instance_id()
	model.post("incident","DIAGNOSTIC incoming event during historical reading")
	signature=race_fingerprint()
	for i in range(25):view.refresh()
	check(radio.history_mode and radio.frozen==snapshot and radio.page==page and root.gui_get_focus_owner()==focus,"G13 incoming events do not move frozen history or focus")
	check(row_id==radio.rows[0].panel.get_instance_id() and signature==race_fingerprint(),"G13 refresh keeps stable rows and authoritative data unchanged")
	await capture("radio-retention-history","Synthetic 2000-event long-text retention boundary; not a physical incident history")
	await scroll_to(radio.live);await click(radio.live)
	var filter=radio.live.get_parent().get_child(2)
	await choose(filter,4);await settle()
	check(radio.caption.text.contains("No matching"),"G13 empty filtered history is explicit")
	await choose(filter,0);await settle()
	check(not radio.history_mode and radio.rows[0].text.text.contains("incoming"),"G13 native Live returns to newest retained evidence")
	view.close_session_workspace();view.close_detail();await settle()
	var event_count=model.events.size()
	for i in range(55):view.feedback("DIAGNOSTIC "+("Rejected · stale evidence" if i%2==0 else "Accepted · command acknowledgement only"))
	check(view.messages.size()==50 and model.events.size()==event_count,"G13 bounded UI command messages never replace or grow race radio evidence")
	await click(view.messages_button);await settle()
	var reading: AcceptDialog
	for window in root.get_embedded_subwindows():
		if window is AcceptDialog and window.visible:reading=window
	check(reading!=null,"G13 native command-message route remains available")
	await capture("command-history","Synthetic accepted/rejected UI feedback retention boundary, separate from authoritative race events")
	if reading:await key(KEY_ESCAPE)
	# Create a file where a parent directory would be required, entirely in isolated user data.
	Storage.write_json("user://save-blocker",{"diagnostic":true})
	var old_path=app.checkpoint_path;app.checkpoint_path="user://save-blocker/weekend.json"
	await menu_item(view.weekend_menu,0)
	check(not view.radio_label.text.to_lower().contains("saved") and (view.radio_label.text.contains("Cannot") or view.radio_label.text.contains("failed")),"G13 native save failure cannot report success")
	app.checkpoint_path=old_path
	var message_count=view.messages.size();await menu_item(view.weekend_menu,1);await key(KEY_ESCAPE)
	check(view.messages.size()==message_count,"G13 canceling export produces no success acknowledgement")
	# Pointer selection across unequal histories must not keep the other driver's index.
	view.open_results_workspace();view.results_workspace.show_page(2);await settle()
	var stints=view.results_workspace.stint_chart
	check(view.results_workspace.get("pit_visit_selector")!=null,"G14 completed pit visits have explicit correlated record selection")
	model.phase="results" # Disclosed unequal-history boundary, not a measured result.
	model.cars[3].stints=[{"set_id":"3-M1","from":0.0,"to":1.0},{"set_id":"3-H1","from":1.0,"to":2.0}]
	model.cars[6].stints=[{"set_id":"6-M1","from":0.0,"to":1.0}]
	view.results_workspace.present();await settle();stints.grab_focus();await key(KEY_RIGHT)
	var point=stints.global_position+Vector2(stints.size.x-10,130*stints.get_theme_font_size("font_size")/13.0)
	for pressed in [true,false]:
		var event=InputEventMouseButton.new();event.position=point;event.global_position=point;event.button_index=MOUSE_BUTTON_LEFT;event.pressed=pressed;Input.parse_input_event(event);await settle()
	check(stints.selected_driver==1 and stints.selected_stint==0,"G14 pointer selection clamps to the newly inspected driver's retained intervals")
	view.close_session_workspace();view.close_detail()
	for scale_factor in [1.0,1.15,1.3]:await style_fixture(scale_factor)
	var report={"passed":failures.is_empty(),"checks":checks,"errors":failures,"captures":captures,"screenshots":captures.size(),"contrast":contrast_measurements,"engine":Engine.get_version_info().string,"limitations":"Synthetic retention and control-state diagnostics. Contrast target is a local numeric check, not universal accessibility certification."}
	Storage.write_json("res://reports/ui-finish-states.json",report)
	print("UI_FINISH_STATES ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
