class_name RacecraftPanel
extends VBoxContainer
## Staged setup values never get overwritten by a live telemetry refresh.
var sim: RaceSim
var dispatch: Callable
var fields: Dictionary = {}
var sliders: Dictionary = {}
var draft_effects: Label
var drafts: Dictionary = {}
var edited: Dictionary = {}
var delta_labels: Dictionary = {}
var loaded_driver = -1
var apply_button: Button
var reset_button: Button
var note: Label
var effects_label: Label
var heat_label: Label
var bias: SpinBox
var bias_button: Button
var actions: HBoxContainer
var garage_form: VBoxContainer
var live_heading: Label
var live_row: HBoxContainer

func configure(model: RaceSim, command: Callable) -> void:
	sim = model; dispatch = command

func _ready() -> void:
	add_theme_constant_override("separation", 7)
	add_child(UI.label("GARAGE SETUP", 15, UI.ACCENT))
	var intro = UI.paragraph("Stage values, then Apply. Focus a field for its trade-off; F1 opens help."); intro.add_theme_font_size_override("font_size", 12); add_child(intro)
	garage_form = UI.vbox(self); garage_form.add_theme_constant_override("separation", 5)
	for key in CarSetup.SPECS:
		var spec = CarSetup.SPECS[key]
		var label_row = UI.hbox(garage_form)
		var label = UI.label(spec[2], 13); label.size_flags_horizontal = Control.SIZE_EXPAND_FILL; label_row.add_child(label)
		var delta = UI.label("", 11, UI.MUTED); label_row.add_child(delta); delta_labels[key] = delta
		var field = UI.spin(CarSetup.DEFAULTS[key], spec[0], spec[1], 1, func(value):
			if loaded_driver >= 0:
				drafts[loaded_driver][key] = int(value); edited[loaded_driver] = true
			refresh_status())
		field.custom_minimum_size = Vector2(80,32)
		var slider=HSlider.new();slider.min_value=spec[0];slider.max_value=spec[1];slider.step=1
		slider.custom_minimum_size.x=90;slider.size_flags_horizontal=Control.SIZE_EXPAND_FILL
		label_row.add_child(slider);label_row.add_child(field);fields[key]=field;sliders[key]=slider
		slider.value_changed.connect(func(value): field.value=value)
		slider.tooltip_text=spec[3];slider.accessibility_name=spec[2]+" draft"
		field.value_changed.connect(func(value): slider.set_value_no_signal(value))
		field.get_line_edit().add_theme_stylebox_override("normal", UI.box(UI.CARD, UI.LINE, 4, 5))
		field.get_line_edit().add_theme_font_size_override("font_size", 13)
		field.tooltip_text = spec[3]; field.get_line_edit().tooltip_text = spec[3]; label.tooltip_text = spec[3]
	actions = UI.hbox(self)
	apply_button = UI.button("Apply setup", apply_draft, true); actions.add_child(apply_button)
	reset_button = UI.button("Revert", revert); actions.add_child(reset_button)
	note = UI.paragraph(""); note.add_theme_font_size_override("font_size", 12); add_child(note)
	live_heading = UI.label("LIVE BRAKE BIAS", 14, UI.ACCENT); add_child(live_heading)
	live_row = UI.hbox(self)
	bias = UI.spin(56, 52, 62, 1, func(_value): pass); bias.custom_minimum_size.x = 80; live_row.add_child(bias)
	bias_button = UI.button("Set front %", func(): dispatch.call("brake_bias", {"value": int(bias.value)})); live_row.add_child(bias_button)
	draft_effects=UI.paragraph("");garage_form.add_child(draft_effects)
	effects_label = UI.paragraph(""); add_child(effects_label)
	heat_label = UI.paragraph(""); add_child(heat_label)
	refresh()

func garage_allowed() -> bool:
	var c = sim.cars[sim.selected_id]
	return c.player and not c.finished and not c.dnf and (sim.phase in ["briefing", "race_preparation"] or sim.phase == "qualifying" and c.route == "garage")

func refresh() -> void:
	if fields.is_empty(): return
	var c = sim.cars[sim.selected_id]
	if loaded_driver != c.id:
		loaded_driver = c.id
		if not drafts.has(c.id): drafts[c.id] = c.car_setup.duplicate()
		for key in fields: fields[key].set_value_no_signal(drafts[c.id][key])
		bias.set_value_no_signal(c.car_setup.bias)
	if not edited.get(c.id, false):
		drafts[c.id] = c.car_setup.duplicate()
		for key in fields: fields[key].set_value_no_signal(drafts[c.id][key])
	for key in fields:
		fields[key].editable=garage_allowed();sliders[key].editable=garage_allowed();sliders[key].set_value_no_signal(fields[key].value)
	bias.editable = c.player and not c.dnf and not c.finished and sim.phase == "race" and c.route == "track"
	bias_button.disabled = not bias.editable
	live_heading.visible = sim.phase == "race"; live_row.visible = sim.phase == "race"
	garage_form.visible = garage_allowed() or sim.phase in ["briefing", "race_preparation", "qualifying_results"]
	var effect = CarSetup.effects(c, sim.average(sim.water))
	effects_label.text = "FITTED SETUP · %d%% front bias\nCorner support %+.1f%% · Straight pace %+.1f%%\nBalance %s" % [c.car_setup.bias, (effect.corner - 1) * 100, (effect.straight - 1) * 100, "understeer tendency" if effect.balance > 0.015 else ("oversteer tendency" if effect.balance < -0.015 else "neutral")]
	effects_label.add_theme_font_size_override("font_size", 12)
	heat_label.text = "Engine %.0f°C · Brakes %.0f°C\nThese are management-model estimates." % [c.engine_temperature, c.brake_temperature]
	heat_label.add_theme_font_size_override("font_size", 12)
	refresh_status()

func refresh_status() -> void:
	if not note or loaded_driver < 0: return
	var changed = drafts[loaded_driver] != sim.cars[loaded_driver].car_setup
	if not changed: edited[loaded_driver] = false
	for key in delta_labels:
		delta_labels[key].text = "%d → %d" % [sim.cars[loaded_driver].car_setup[key], drafts[loaded_driver][key]]
		delta_labels[key].tooltip_text = "Fitted → unapplied draft. " + CarSetup.SPECS[key][3]
	apply_button.disabled = not changed or not garage_allowed(); reset_button.disabled = not changed
	note.text = sim.cars[loaded_driver].name + (" · Unapplied adjustments · no effect yet." if changed else " · Setup is applied.")
	apply_button.tooltip_text = "Apply only to " + sim.cars[loaded_driver].name + "." if garage_allowed() else "Mechanical changes unlock in the garage or race preparation."
	if not garage_allowed(): note.text += "\nMechanical changes unlock in the garage or race preparation."
	if draft_effects:
		var c=sim.cars[loaded_driver].duplicate();c.car_setup=drafts[loaded_driver]
		var effect=CarSetup.effects(c,sim.average(sim.water))
		draft_effects.text="DRAFT EFFECTS · CURRENT TYRE/SURFACE HELD CONSTANT\nCorner %+.1f%% · straight %+.1f%% · traction %+.1f%%\nChanges have no effect until Apply." % [(effect.corner-1)*100,(effect.straight-1)*100,(effect.traction-1)*100]
		for key in sliders:sliders[key].set_value_no_signal(fields[key].value)

func apply_draft() -> void:
	if not garage_allowed(): return
	dispatch.call("setup_all", {"values": drafts[loaded_driver].duplicate()})
	refresh_status()

func has_user_edits() -> bool:
	for id in drafts:
		if edited.get(id, false) and drafts[id] != sim.cars[id].car_setup: return true
	return false

func revert() -> void:
	edited[loaded_driver] = false
	drafts[loaded_driver] = sim.cars[loaded_driver].car_setup.duplicate()
	for key in fields: fields[key].set_value_no_signal(drafts[loaded_driver][key])
	refresh_status()

class WheelDashboard extends VBoxContainer:
	var model: RaceSim
	var cards: Dictionary = {}
	var heading: Label
	var details: Label
	var selected_wheel = "FL"
	func _ready():
		heading = UI.label("FOUR CONTACT PATCHES", 12, UI.ACCENT); add_child(heading)
		var grid = GridContainer.new(); grid.columns = 2; add_child(grid)
		for key in WheelTyres.KEYS:
			var b = UI.button("", func(): selected_wheel = key; refresh())
			b.custom_minimum_size = Vector2(110, 67); b.size_flags_horizontal = Control.SIZE_EXPAND_FILL
			b.add_theme_font_size_override("font_size", 12); grid.add_child(b); cards[key] = b
		details = UI.paragraph(""); details.add_theme_font_size_override("font_size", 11); add_child(details)
		refresh()
	func refresh():
		if not model or cards.is_empty(): return
		var c = model.cars[model.selected_id]; var item = TyreInventory.find(c, c.set_id)
		heading.text = "FITTED %s · %d HEAT CYCLES" % [item.label, item.heat_cycles]
		for key in cards:
			var w = item.wheels[key]
			cards[key].text = "%s   %d%%\n%.0f° surface / %.0f° core" % [key, w.life, w.surface, w.core]
			UI.set_active(cards[key], key == selected_wheel, w.punctured)
			cards[key].tooltip_text = "Front/rear · left/right. Click to inspect retained tyre damage."
		var w = item.wheels[selected_wheel]
		details.text = "%s · %s\nPressure %.2f× cold · Load %.2f×\nGraining %.1f · Blistering %.1f · Flat spot %.1f" % [selected_wheel, "PUNCTURED — replace this set" if w.punctured else "condition retained with this set", w.pressure, w.load, w.grain, w.blister, w.flat]
