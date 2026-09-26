class_name RaceStintHistory
extends Control
## Two-driver measured fitting intervals. No scheduled stop becomes a fitted stint.
signal selection_changed(text: String)
var model: RaceSim
var stamp: Array = []
var update_count = 0
var selected_driver = 0
var selected_stint = 0
var panel_style: StyleBoxFlat
func _ready() -> void:
	panel_style = PitwallDesign.chart_surface(); focus_mode = Control.FOCUS_ALL; resize_chart()
func resize_chart() -> void:
	custom_minimum_size = Vector2(250,ceilf(224*get_theme_font_size("font_size")/13.0))
func _notification(what: int) -> void:
	if what == NOTIFICATION_THEME_CHANGED and is_node_ready(): resize_chart(); queue_redraw()
	elif what in [NOTIFICATION_FOCUS_ENTER,NOTIFICATION_FOCUS_EXIT]: queue_redraw()
func present(value: RaceSim) -> void:
	model=value
	var next=[value.cars[3].stints,value.cars[6].stints,value.cars[3].distance,value.cars[6].distance,value.cars[3].pit_stops,value.cars[6].pit_stops]
	if next==stamp:return
	stamp=next.duplicate(true);update_count+=1
	selected_stint=clampi(selected_stint,0,maxi(0,model.cars[[3,6][selected_driver]].stints.size()-1))
	accessibility_name="Measured tyre stints for Mercer and Moreau"
	accessibility_description=selected_text();selection_changed.emit(selected_text());queue_redraw()
func selected_text() -> String:
	if model==null:return "No measured stint data"
	var car=model.cars[[3,6][selected_driver]]
	if car.stints.is_empty():return car.name+" · No recorded fitted stints"
	var stint=car.stints[clampi(selected_stint,0,car.stints.size()-1)]
	var right=car.distance/model.track.length if stint.to<0 else stint.to
	return "%s · %s · distance laps %.2f → %.2f · %s" % [car.name,stint.set_id,stint.from,right,"fitted at finish" if stint.to<0 and (car.finished or car.dnf) else "currently fitted" if stint.to<0 else "replaced physically"]
func _gui_input(event: InputEvent) -> void:
	if model==null:return
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_UP:selected_driver=0;selected_stint=0
			KEY_DOWN:selected_driver=1;selected_stint=0
			KEY_LEFT:selected_stint=maxi(0,selected_stint-1)
			KEY_RIGHT:selected_stint=mini(model.cars[[3,6][selected_driver]].stints.size()-1,selected_stint+1)
			_:return
	elif event is InputEventJoypadButton and event.pressed:
		match event.button_index:
			JOY_BUTTON_DPAD_UP:selected_driver=0;selected_stint=0
			JOY_BUTTON_DPAD_DOWN:selected_driver=1;selected_stint=0
			JOY_BUTTON_DPAD_LEFT:selected_stint=maxi(0,selected_stint-1)
			JOY_BUTTON_DPAD_RIGHT:selected_stint=mini(model.cars[[3,6][selected_driver]].stints.size()-1,selected_stint+1)
			_:return
	elif event is InputEventMouseButton and event.pressed and event.button_index==MOUSE_BUTTON_LEFT:
		grab_focus();var scale_factor=get_theme_font_size("font_size")/13.0
		selected_driver=0 if event.position.y<110*scale_factor else 1
		var car=model.cars[[3,6][selected_driver]]
		var distance=clampf((event.position.x-12)/maxf(1,size.x-30),0,1)*model.laps
		for i in range(car.stints.size()):
			var stint=car.stints[i];var right=car.distance/model.track.length if stint.to<0 else stint.to
			if distance>=stint.from and distance<=right:selected_stint=i;break
	else:return
	selected_stint=clampi(selected_stint,0,maxi(0,model.cars[[3,6][selected_driver]].stints.size()-1))
	accessibility_description=selected_text();selection_changed.emit(selected_text());queue_redraw();accept_event()
func _draw() -> void:
	if model==null or panel_style==null:return
	draw_style_box(panel_style,Rect2(Vector2.ZERO,size))
	if has_focus():draw_rect(Rect2(Vector2(2,2),size-Vector2(4,4)),UI.PRIMARY,false,2)
	var font=get_theme_font("font");var width=maxf(1,size.x-30)
	var scale_factor=get_theme_font_size("font_size")/13.0
	var text_size=roundi(12*scale_factor);var caption=roundi(11*scale_factor)
	draw_string(font,Vector2(12,22*scale_factor),"FITTED SETS / MEASURED DISTANCE",HORIZONTAL_ALIGNMENT_LEFT,width,caption,UI.ACCENT)
	for i in range(5):
		var x=12+width*i/4.0
		draw_line(Vector2(x,48*scale_factor),Vector2(x,163*scale_factor),UI.LINE,1)
		draw_string(font,Vector2(x-12,42*scale_factor),"%.0f" % (model.laps*i/4.0),HORIZONTAL_ALIGNMENT_CENTER,24,caption,UI.MUTED)
	for index in range(2):
		var car=model.cars[[3,6][index]];var y=(66+index*55)*scale_factor
		draw_string(font,Vector2(12,y),car.short+" · "+str(car.pit_stops)+" physical services",HORIZONTAL_ALIGNMENT_LEFT,width,text_size,UI.INK)
		for i in range(car.stints.size()):
			var stint=car.stints[i]
			var left=clampf(stint.from,0,model.laps);var right=clampf(car.distance/model.track.length if stint.to<0 else stint.to,left,model.laps)
			var a=12+width*left/model.laps;var b=12+width*right/model.laps
			var rect=Rect2(a,y+7*scale_factor,maxf(2,b-a-1),20*scale_factor)
			draw_rect(rect,RaceStrategyChart.compound_color(stint.set_id))
			if index==selected_driver and i==selected_stint:draw_rect(rect.grow(2),UI.INK,false,1)
			if b-a>34:draw_string(font,Vector2(a+4,y+22*scale_factor),str(stint.set_id).get_slice("-",1),HORIZONTAL_ALIGNMENT_LEFT,b-a-4,text_size,UI.INK)
	draw_string(font,Vector2(12,190*scale_factor),selected_text(),HORIZONTAL_ALIGNMENT_LEFT,width,text_size,UI.INK)
	draw_string(font,Vector2(12,212*scale_factor),"↑/↓ driver · ←/→ stint · no future extrapolation",HORIZONTAL_ALIGNMENT_LEFT,width,caption,UI.MUTED)
