class_name RaceTyreReadout
extends HBoxContainer
## Finite identity/status readout; choosing stock is not fitting stock.
var model: RaceSim
var fitted: Label
var planned: Label
func configure(value: RaceSim) -> void:model=value
func _ready() -> void:
	for text in ["FITTED / ON CAR","PLANNED / NOT FITTED"]:
		var surface=PitwallDesign.race_panel(false,8);surface.size_flags_horizontal=Control.SIZE_EXPAND_FILL;add_child(surface)
		var body=UI.vbox(surface);body.add_child(UI.label(text,11,UI.ACCENT))
		var value=UI.paragraph("",UI.INK);body.add_child(value)
		if fitted==null:fitted=value
		else:planned=value
func present() -> void:
	if fitted==null:return
	var car=model.cars[model.selected_id]
	if not car.player:fitted.text="Private condition";planned.text="Private plan";return
	var a=TyreInventory.find(car,car.set_id);var b=TyreInventory.planned(car,model.phase=="race")
	fitted.text="%s · %.0f%% life" % [a.get("label","—"),a.get("life",0)]
	planned.text="No set selected" if b.is_empty() else "%s · %.0f%% · %s" % [b.label,b.life,"used" if b.used else "fresh"]
