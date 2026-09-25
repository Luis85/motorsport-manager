class_name RaceStrategyChart
extends Control
## Read-only supplied stop schedules. Windows and physical orders remain distinct.
var options: Array = []
var total_laps = 1
var start_lap = 0.0
var current_set = ""
var stamp: Array = []
var update_count = 0
var option_index = 0
var stop_index = 0

func _ready() -> void:
	focus_mode = Control.FOCUS_ALL; mouse_default_cursor_shape = Control.CURSOR_CROSS
	_minimum()

func _minimum() -> void:
	custom_minimum_size = Vector2(250, ceilf(268 * get_theme_font_size("font_size") / 13.0))

func _notification(what: int) -> void:
	if what == NOTIFICATION_THEME_CHANGED and is_node_ready(): _minimum(); queue_redraw()
	elif what in [NOTIFICATION_FOCUS_ENTER, NOTIFICATION_FOCUS_EXIT]: queue_redraw()

func present(model: RaceSim, id: int, forecast: Dictionary, initial_set: String = "") -> void:
	var car = model.cars[id]
	var data = [forecast.get("options",[]),model.laps,maxf(0,car.distance/model.track.length) if model.phase=="race" else 0.0,car.set_id if initial_set.is_empty() else initial_set]
	if data == stamp: return
	stamp = data.duplicate(true); options = data[0]; total_laps = maxi(1,data[1]); start_lap = data[2]; current_set = data[3]; update_count += 1
	option_index = clampi(option_index,0,maxi(0,options.size()-1)); _describe(); queue_redraw()

func selected_text() -> String:
	if options.is_empty(): return "No forecast schedule available."
	var option = options[option_index]
	if not option.get("available",false): return option.title + " · Unavailable\n" + option.get("reason", "No supported estimate")
	var stops = option.get("stops",[])
	var detail = "No further stop in this estimate"
	if not stops.is_empty():
		var at = clampi(stop_index,0,stops.size()-1); var stop = stops[at]
		detail = "Stop %d · distance lap %.2f → %s" % [at+1,stop.at,stop.set_id]
	return detail + "\n~%.0f–%.0fs remaining · %s risk" % [option.low,option.high,option.risk]

func _describe() -> void:
	accessibility_name = "Strategy stint timeline"
	accessibility_description = "Estimated distance-lap schedules, not physical orders. Up/down chooses an option; left/right inspects its stops. " + selected_text()
	tooltip_text = accessibility_description

func _gui_input(event: InputEvent) -> void:
	if options.is_empty(): return
	var direction = ""
	if event.is_action_pressed("ui_up"): direction = "up"
	elif event.is_action_pressed("ui_down"): direction = "down"
	elif event.is_action_pressed("ui_left"): direction = "left"
	elif event.is_action_pressed("ui_right"): direction = "right"
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		grab_focus()
		var scale_factor = get_theme_font_size("font_size") / 13.0
		option_index = clampi(int((event.position.y/scale_factor-52)/51),0,options.size()-1)
		var distance = clampf((event.position.x-12)/maxf(1,size.x-24),0,1)*total_laps
		var best = INF
		var stops = options[option_index].get("stops",[])
		for i in range(stops.size()):
			if absf(stops[i].at-distance)<best: best=absf(stops[i].at-distance);stop_index=i
	else: return
	if direction == "up": option_index = maxi(0,option_index-1);stop_index=0
	elif direction == "down": option_index = mini(options.size()-1,option_index+1);stop_index=0
	elif direction == "left": stop_index = maxi(0,stop_index-1)
	elif direction == "right": stop_index = mini(maxi(0,options[option_index].get("stops",[]).size()-1),stop_index+1)
	_describe();queue_redraw();accept_event()

static func compound_color(set_id: String) -> Color:
	return {"S":Color("bf6053"),"M":Color("d4ad58"),"H":Color("a9b9af"),"I":Color("529276"),"W":Color("578ca7")}.get(set_id.get_slice("-",1).left(1),UI.LINE)

func _draw() -> void:
	var font = get_theme_font("font"); var scale_factor=get_theme_font_size("font_size")/13.0
	var text_size=roundi(12*scale_factor);var caption_size=roundi(11*scale_factor)
	draw_style_box(PitwallDesign.chart_surface(),Rect2(Vector2.ZERO,size))
	if has_focus(): draw_rect(Rect2(Vector2(2,2),size-Vector2(4,4)),UI.PRIMARY,false,2)
	var width = maxf(1,size.x-24)
	draw_string(font,Vector2(12,20*scale_factor),"STOP SCHEDULES · ESTIMATES",HORIZONTAL_ALIGNMENT_LEFT,width,caption_size,UI.ACCENT)
	for i in range(5):
		var x = 12+width*i/4.0
		draw_line(Vector2(x,45*scale_factor),Vector2(x,198*scale_factor),UI.LINE,1)
		draw_string(font,Vector2(clampf(x-18,12,size.x-48),39*scale_factor),"%.0f" % (float(total_laps)*i/4),HORIZONTAL_ALIGNMENT_CENTER,36,caption_size,UI.MUTED)
	for i in range(options.size()):
		var option = options[i]; var y = (61+i*51)*scale_factor
		draw_string(font,Vector2(12,y), ("› " if i==option_index else "")+option.get("title","Option"),HORIZONTAL_ALIGNMENT_LEFT,width,text_size,UI.INK)
		if not option.get("available",false):
			draw_string(font,Vector2(12,y+22*scale_factor),"Unavailable · "+option.get("reason",""),HORIZONTAL_ALIGNMENT_LEFT,width,caption_size,UI.MUTED);continue
		var left = start_lap; var set_id = current_set
		var segments = option.get("stops",[]).duplicate(true); segments.append({"at":float(total_laps),"set_id":""})
		for j in range(segments.size()):
			var stop = segments[j];var finish=clampf(float(stop.at),left,total_laps)
			var a=12+width*left/total_laps;var b=12+width*finish/total_laps
			draw_rect(Rect2(a,y+6*scale_factor,maxf(1,b-a-1),18*scale_factor),compound_color(set_id))
			if b-a>30: draw_string(font,Vector2(a+4,y+20*scale_factor),set_id.get_slice("-",1),HORIZONTAL_ALIGNMENT_LEFT,b-a-4,caption_size,UI.RACE_INK)
			if j<segments.size()-1:
				draw_line(Vector2(b,y+3*scale_factor),Vector2(b,y+27*scale_factor),UI.INK,2)
				if i==option_index and j==stop_index: draw_circle(Vector2(b,y+5*scale_factor),4,UI.INK)
			left=finish;set_id=stop.set_id
	var current_x = 12+width*clampf(start_lap/total_laps,0,1)
	draw_dashed_line(Vector2(current_x,45*scale_factor),Vector2(current_x,198*scale_factor),UI.PRIMARY,1,4)
	var lines=selected_text().split("\n")
	for i in range(mini(2,lines.size())):
		draw_string(font,Vector2(12,(217+i*18)*scale_factor),lines[i],HORIZONTAL_ALIGNMENT_LEFT,width,caption_size,UI.INK)
	draw_string(font,Vector2(12,size.y-10*scale_factor),"Distance laps · ↑/↓ option · ←/→ stop · inspection only",HORIZONTAL_ALIGNMENT_LEFT,width,caption_size,UI.MUTED)
