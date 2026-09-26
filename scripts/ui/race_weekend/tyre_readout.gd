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
	var minimum = 100.0; var limiting = "—"; var punctures: Array[String] = []
	for wheel_id in a.get("wheels", {}):
		var wheel = a.wheels[wheel_id]
		if wheel.life < minimum: minimum = wheel.life; limiting = wheel_id
		if wheel.punctured: punctures.append(wheel_id)
	fitted.text = "%s · %s\n%.0f%% average · %.0f%% minimum %s" % [a.get("id", "—"), "PUNCTURE " + "/".join(punctures) if not punctures.is_empty() else "condition retained", a.get("life", 0), minimum, limiting]
	var usable = 0; var fresh = 0
	for item in car.tyre_sets:
		if WheelTyres.usable(item):
			usable += 1
			if not item.used: fresh += 1
	fitted.tooltip_text = "%d usable sets, including %d fresh; %d unusable. Driver-owned inventory; opening never fits a set." % [usable, fresh, car.tyre_sets.size() - usable]
	planned.text="No usable set selected" if b.is_empty() else "%s · %.0f%% · %s\n%s" % [b.id,b.life,"used" if b.used else "fresh","Already fitted; selection does not renew it." if b.id == a.get("id", "") else "Fits only on release, formation or physical service."]
