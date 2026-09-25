class_name RaceStintHistory
extends Control
## Two-driver measured stint intervals; no future extrapolation or tyre creation.
var model: RaceSim
var stamp: Array=[]
var update_count=0
func _ready() -> void:
	custom_minimum_size=Vector2(250,175);focus_mode=Control.FOCUS_ALL
func _notification(what: int) -> void:
	if what == NOTIFICATION_THEME_CHANGED and is_node_ready():
		custom_minimum_size.y=ceilf(175*get_theme_font_size("font_size")/13.0);queue_redraw()
func present(value: RaceSim) -> void:
	model=value
	var next=[value.cars[3].stints,value.cars[6].stints,value.cars[3].distance,value.cars[6].distance]
	if next==stamp:return
	stamp=next.duplicate(true);update_count+=1
	accessibility_name="Measured tyre stints for MER and MOR";accessibility_description=str(next);queue_redraw()
func _draw() -> void:
	if model==null:return
	draw_style_box(PitwallDesign.chart_surface(),Rect2(Vector2.ZERO,size))
	var font=get_theme_font("font");var width=maxf(1,size.x-30)
	var scale_factor=get_theme_font_size("font_size")/13.0
	var text_size=roundi(12*scale_factor);var caption_size=roundi(11*scale_factor)
	draw_string(font,Vector2(12,23*scale_factor),"FITTED SETS / MEASURED RACE DISTANCE",HORIZONTAL_ALIGNMENT_LEFT,width,text_size,UI.ACCENT)
	for index in range(2):
		var car=model.cars[[3,6][index]];var y=(48+index*54)*scale_factor
		draw_string(font,Vector2(12,y),car.short+" · "+str(car.pit_stops)+" physical pit visits",HORIZONTAL_ALIGNMENT_LEFT,width,text_size,UI.INK)
		for stint in car.stints:
			var left=clampf(stint.from,0,model.laps);var right=clampf(car.distance/model.track.length if stint.to<0 else stint.to,left,model.laps)
			var a=12+width*left/model.laps;var b=12+width*right/model.laps
			draw_rect(Rect2(a,y+7*scale_factor,maxf(1,b-a-1),20*scale_factor),UI.SELECTED)
			if b-a>30:draw_string(font,Vector2(a+4,y+22*scale_factor),str(stint.set_id).get_slice("-",1),HORIZONTAL_ALIGNMENT_LEFT,b-a-4,text_size,UI.INK)
	draw_string(font,Vector2(12,size.y-10),"Lap-equivalent distance 0 → %d · intervals end at measured distance" % model.laps,HORIZONTAL_ALIGNMENT_LEFT,width,caption_size,UI.MUTED)
