class_name RaceStrategyChart
extends Control
## Forecast stop schedules, not a fabricated cumulative-time series.
## Draws supplied stop positions and uncertainty ranges; never simulates a lap.
var options: Array = []
var total_laps = 1
var start_lap = 0.0
var current_set = ""
var stamp: Array = []
var update_count = 0
func _ready() -> void:
	custom_minimum_size = Vector2(250,210); focus_mode = Control.FOCUS_ALL
func present(model: RaceSim,id: int,forecast: Dictionary, initial_set: String = "") -> void:
	var car = model.cars[id]
	var data = [forecast.get("options",[]),model.laps,maxf(0,car.distance/model.track.length) if model.phase=="race" else 0.0,(car.set_id if initial_set.is_empty() else initial_set)]
	if data == stamp: return
	stamp = data.duplicate(true); options = data[0]; total_laps = data[1]; start_lap = data[2]; current_set = data[3]; update_count += 1
	var descriptions: Array[String] = ["Estimated stop schedules. Fractional laps are race distance, not numbered finish crossings."]
	for option in options:
		descriptions.append(option.title+": "+str(option.get("stops",[])))
	accessibility_name = "Strategy stint timeline"; accessibility_description = "
".join(descriptions); tooltip_text = accessibility_description
	queue_redraw()
func _draw() -> void:
	var font = get_theme_font("font"); var scale_factor=get_theme_font_size("font_size")/13.0
	var text_size=roundi(11*scale_factor);var caption_size=roundi(10*scale_factor)
	draw_style_box(PitwallDesign.chart_surface(),Rect2(Vector2.ZERO,size))
	draw_string(font,Vector2(12,20*scale_factor),"STOP SCHEDULES · ESTIMATES",HORIZONTAL_ALIGNMENT_LEFT,size.x-24,text_size,UI.ACCENT)
	var width = maxf(10,size.x-24)
	for i in range(options.size()):
		var option = options[i]; var y = (43+i*49)*scale_factor
		var title = option.get("title","Option")
		draw_string(font,Vector2(12,y),title,HORIZONTAL_ALIGNMENT_LEFT,width,text_size,UI.INK)
		if not option.get("available",false):
			draw_string(font,Vector2(12,y+20*scale_factor),"Unavailable · "+option.get("reason",""),HORIZONTAL_ALIGNMENT_LEFT,width,text_size,UI.MUTED); continue
		var left = start_lap; var set_id = current_set
		var segments = option.get("stops",[]).duplicate(true); segments.append({"at":float(total_laps),"set_id":""})
		for stop in segments:
			var finish = clampf(float(stop.at),left,total_laps)
			var a = 12+width*left/total_laps; var b = 12+width*finish/total_laps
			var compound = str(set_id).get_slice("-",1).left(1)
			var color = {"S":Color("bf6053"),"M":Color("d4ad58"),"H":Color("a9b9af"),"I":Color("529276"),"W":Color("578ca7")}.get(compound,UI.LINE)
			draw_rect(Rect2(a,y+6*scale_factor,maxf(1,b-a-1),16*scale_factor),color)
			if b-a>20: draw_string(font,Vector2(a+4,y+18*scale_factor),compound,HORIZONTAL_ALIGNMENT_LEFT,b-a-4,text_size,UI.RACE_INK)
			left=finish;set_id=stop.set_id
		draw_string(font,Vector2(12,y+36*scale_factor),"~%.0f–%.0fs remaining · %s risk" % [option.low,option.high,option.risk],HORIZONTAL_ALIGNMENT_LEFT,width,caption_size,UI.MUTED)
	draw_string(font,Vector2(12,size.y-9),"Distance laps %.1f → %d · unknown future stops/weather" % [start_lap,total_laps],HORIZONTAL_ALIGNMENT_LEFT,width,caption_size,UI.MUTED)

func _notification(what: int) -> void:
	if what==NOTIFICATION_THEME_CHANGED and is_node_ready():
		custom_minimum_size.y=ceilf(210*get_theme_font_size("font_size")/13.0);queue_redraw()
