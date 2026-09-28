class_name RaceAnalysisWorkspace
extends VBoxContainer
## Focused analysis reuses the live inspector and its fixed commit boundary.
signal close_requested
signal driver_requested(id: int)
var model: RaceViewQuery
var heading: Label
var drivers: Dictionary = {}
var content: VBoxContainer
func configure(value: RaceViewQuery) -> void:model=value
func _ready() -> void:
	size_flags_vertical=Control.SIZE_EXPAND_FILL
	var row=UI.hbox(self)
	heading=UI.label("ANALYSIS",PitwallDesign.TYPE.display,UI.ACCENT);heading.size_flags_horizontal=Control.SIZE_EXPAND_FILL;row.add_child(heading)
	row.add_child(UI.button("Back to pit wall",func():close_requested.emit()))
	var team=UI.hbox(self)
	for id in [3,6]:
		var b=UI.button("",func():driver_requested.emit(id));b.clip_text=true;b.size_flags_horizontal=Control.SIZE_EXPAND_FILL;team.add_child(b);drivers[id]=b
	content=UI.vbox(self,true)
func attach(panel: Control) -> void:
	if panel.get_parent()!=content:panel.reparent(content)
	panel.custom_minimum_size.x=0;panel.size_flags_horizontal=Control.SIZE_EXPAND_FILL;panel.size_flags_vertical=Control.SIZE_EXPAND_FILL;panel.show()
func present() -> void:
	if heading==null:return
	for id in drivers:
		var c=model.car(id)
		drivers[id].text="%s · %s %.0f%% · fuel ~%+.1f laps\n%s" % [c.name,c.compound,c.tyre,model.race_forecaster_fuel_margin(c),str(c.intent).get_slice(" · ",0)]
		drivers[id].tooltip_text="%s · Fitted %s · %.0f%% average tyre. Estimated finish fuel %+.1f lap units.\n%s" % [c.name,c.set_id,c.tyre,model.race_forecaster_fuel_margin(c),c.intent]
		drivers[id].accessibility_description=drivers[id].tooltip_text
		PitwallDesign.navigation(drivers[id],model.selected_id==id)
