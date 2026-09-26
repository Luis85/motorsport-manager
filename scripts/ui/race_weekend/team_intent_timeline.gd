class_name RaceTeamIntentTimeline
extends Control
## Common distance domain for accepted windows and already-issued bounded intents.
## Selection is inspection only; editing stays in the existing Plan/Control pages.
signal selection_changed(text: String)
var model: StrategyRaceSim
var selected_driver = 0
var selected_item = 0
var lanes: Array = []
var stamp: Array = []
var surface: StyleBoxFlat
var update_count = 0

func configure(value: StrategyRaceSim) -> void: model = value
func _ready() -> void:
	focus_mode = Control.FOCUS_ALL; surface = PitwallDesign.chart_surface(); _size(); present()
func _size() -> void: custom_minimum_size = Vector2(250, ceilf(244 * get_theme_font_size("font_size") / 13.0))
func _notification(what: int) -> void:
	if what == NOTIFICATION_THEME_CHANGED and is_node_ready(): _size(); queue_redraw()
	elif what in [NOTIFICATION_FOCUS_ENTER, NOTIFICATION_FOCUS_EXIT]: queue_redraw()

func present() -> void:
	if model == null: return
	var next: Array = []
	for id in [3,6]:
		var c = model.cars[id]; var p = model.policy(id)
		next.append([c.distance,p.plan,p.next_stop,p.plan_status,p.owners,p.overrides,c.pit_order,c.route])
	if next == stamp: return
	stamp = next.duplicate(true); update_count += 1; lanes.clear()
	for id in [3,6]:
		var p = model.policy(id); var items: Array = []
		for index in range(p.plan.get("stops", []).size()):
			var stop = p.plan.stops[index]
			var gate_fraction = model.track.pit_entry / model.track.length
			items.append({"kind":"pit", "from":stop.from_lap - 1 + gate_fraction, "to":stop.to_lap - 1 + gate_fraction,
				"set":stop.set_id, "past":index < p.next_stop,
				"text":"Accepted window L%d–%d · %s · %s / owner %s" % [stop.from_lap,stop.to_lap,stop.set_id,"consumed" if index < p.next_stop else p.plan_status,p.owners.pit]})
		for channel in ["pace","engine"]:
			if not p.overrides.has(channel): continue
			var intent = p.overrides[channel]
			items.append({"kind":channel,"from":maxf(0,model.cars[id].distance/model.track.length),"to":intent.until_distance/model.track.length,
				"set":"", "past":false,"text":"Active %s override · value %d · until %.2f distance laps · handback to %s" % [channel,intent.value,intent.until_distance/model.track.length,p.owners[channel]]})
		if items.is_empty(): items.append({"kind":"none","from":0.0,"to":0.0,"set":"","past":false,"text":"No accepted windows or bounded overrides. Current owners: " + StrategyPlan.ownership_text(p)})
		lanes.append(items)
	selected_item = clampi(selected_item,0,lanes[selected_driver].size()-1)
	accessibility_name = "Two-driver accepted intentions, not a future command scheduler"
	accessibility_description = selected_text(); queue_redraw()

func selected_text() -> String:
	if lanes.is_empty(): return "No recorded intentions"
	return model.cars[[3,6][selected_driver]].name + " · " + lanes[selected_driver][selected_item].text

func _gui_input(event: InputEvent) -> void:
	if lanes.is_empty(): return
	if event is InputEventKey and event.pressed and not event.echo:
		match event.keycode:
			KEY_UP: selected_driver = 0; selected_item = 0
			KEY_DOWN: selected_driver = 1; selected_item = 0
			KEY_LEFT: selected_item = maxi(0,selected_item - 1)
			KEY_RIGHT: selected_item = mini(lanes[selected_driver].size()-1,selected_item + 1)
			_: return
	elif event is InputEventJoypadButton and event.pressed:
		match event.button_index:
			JOY_BUTTON_DPAD_UP: selected_driver = 0; selected_item = 0
			JOY_BUTTON_DPAD_DOWN: selected_driver = 1; selected_item = 0
			JOY_BUTTON_DPAD_LEFT: selected_item = maxi(0,selected_item - 1)
			JOY_BUTTON_DPAD_RIGHT: selected_item = mini(lanes[selected_driver].size()-1,selected_item + 1)
			_: return
	elif event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		grab_focus()
		var scale_factor = get_theme_font_size("font_size")/13.0
		selected_driver = 0 if event.position.y < 112 * scale_factor else 1
		var distance = clampf((event.position.x-48)/maxf(1,size.x-64),0,1)*model.laps
		var best = INF
		for i in range(lanes[selected_driver].size()):
			var item = lanes[selected_driver][i]; var diff = absf(distance-clampf(distance,item.from,item.to))
			if diff < best: best = diff; selected_item = i
	else: return
	accessibility_description = selected_text(); selection_changed.emit(selected_text()); queue_redraw(); accept_event()

func _draw() -> void:
	if surface == null or model == null or lanes.is_empty(): return
	draw_style_box(surface,Rect2(Vector2.ZERO,size))
	if has_focus(): draw_rect(Rect2(Vector2(2,2),size-Vector2(4,4)),UI.PRIMARY,false,2)
	var font=get_theme_font("font");var scale_factor=get_theme_font_size("font_size")/13.0
	var caption=roundi(11*scale_factor);var font_size=roundi(12*scale_factor);var width=maxf(1,size.x-64)
	draw_string(font,Vector2(12,22*scale_factor),"ACCEPTED WINDOWS & ACTIVE OVERRIDES",HORIZONTAL_ALIGNMENT_LEFT,size.x-24,caption,UI.ACCENT)
	for i in range(5):
		var x=48+width*i/4.0
		draw_line(Vector2(x,45*scale_factor),Vector2(x,170*scale_factor),UI.LINE,1)
		draw_string(font,Vector2(x-16,39*scale_factor),"%.0f" % (model.laps*i/4.0),HORIZONTAL_ALIGNMENT_CENTER,32,caption,UI.MUTED)
	for index in range(2):
		var c=model.cars[[3,6][index]];var y=(56+index*62)*scale_factor
		draw_string(font,Vector2(8,y),c.short,HORIZONTAL_ALIGNMENT_LEFT,38,font_size,UI.INK)
		for item_index in range(lanes[index].size()):
			var item=lanes[index][item_index]
			if item.kind=="none":
				draw_string(font,Vector2(48,y),"No active recorded intentions",HORIZONTAL_ALIGNMENT_LEFT,width,caption,UI.MUTED);continue
			var offset={"pit":0,"pace":18,"engine":36}.get(item.kind,0)*scale_factor
			var a=48+width*clampf(item.from/model.laps,0,1);var b=48+width*clampf(item.to/model.laps,0,1)
			var rect=Rect2(a,y+offset,maxf(4,b-a),13*scale_factor)
			var color=RaceStrategyChart.compound_color(item.set) if item.kind=="pit" else UI.ACCENT
			if item.past: color=color.lerp(UI.CARD,0.65)
			draw_rect(rect,color, item.kind=="pit", -1 if item.kind=="pit" else 2)
			if item_index==selected_item and index==selected_driver: draw_rect(rect.grow(2),UI.INK,false,1)
		var at=48+width*clampf(c.distance/model.track.length/model.laps,0,1)
		draw_line(Vector2(at,y-10*scale_factor),Vector2(at,y+52*scale_factor),UI.PRIMARY,2)
	var selected=selected_text()
	# A bounded text alternative is also exposed in the adjacent Label by the host.
	draw_string(font,Vector2(12,192*scale_factor),selected,HORIZONTAL_ALIGNMENT_LEFT,size.x-24,font_size,UI.INK)
	draw_string(font,Vector2(12,213*scale_factor),"Distance laps · filled = windows · outlines = issued intents",HORIZONTAL_ALIGNMENT_LEFT,size.x-24,caption,UI.MUTED)
	draw_string(font,Vector2(12,234*scale_factor),"↑/↓ driver · ←/→ item · inspection never schedules a command",HORIZONTAL_ALIGNMENT_LEFT,size.x-24,caption,UI.MUTED)
