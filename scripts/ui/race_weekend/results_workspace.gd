class_name RaceResultsWorkspace
extends VBoxContainer
## Full session review. Existing classification and persistence actions are reused.
signal close_requested
signal action_requested(action: String)
var model: RaceSim
var result_panel: SessionResultsPanel
var pages: Array[Control] = []
var buttons: Array[Button] = []
var narrative: Label
var laps: RaceMetricChart
var sectors: RaceSectorTable
var compare: CheckButton
var lap_note: Label
var drivers: OptionButton
var driver_id = 3
var mode = 0
var next_button: Button
var stint_chart: RaceStintHistory
var journal: RaceJournalView
func configure(value: RaceSim) -> void: model = value
func _ready() -> void:
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	var top = UI.hbox(self)
	var title = UI.label("SESSION / REVIEW",PitwallDesign.TYPE.display,UI.ACCENT); title.size_flags_horizontal = Control.SIZE_EXPAND_FILL; top.add_child(title)
	top.add_child(UI.button("Back to pit wall",func(): close_requested.emit()))
	var nav = UI.hbox(self)
	for text in ["Classification","Lap evidence","Stints & pit stops","Decisions"]:
		var index = buttons.size(); var button = UI.button(text,func(): show_page(index)); nav.add_child(button); buttons.append(button)
	for i in range(4): pages.append(UI.vbox(self,true))
	# Classification is attached by the host, retaining the exact same stable TreeItems.
	drivers = UI.option([model.cars[3].name,model.cars[6].name],func(index): driver_id = [3,6][index]; present()); pages[1].add_child(drivers)
	compare = UI.check("Compare teammate · same session",false,func(_value):present()); pages[1].add_child(compare)
	var lap_scroll = ScrollContainer.new(); lap_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	lap_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; pages[1].add_child(lap_scroll)
	var lap_body = UI.vbox(lap_scroll); lap_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lap_note = UI.paragraph(""); lap_body.add_child(lap_note)
	laps = RaceMetricChart.new(); lap_body.add_child(laps)
	sectors = RaceSectorTable.new(); lap_body.add_child(sectors)
	var stint_scroll = ScrollContainer.new(); stint_scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	stint_scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; pages[2].add_child(stint_scroll)
	var stint_body = UI.vbox(stint_scroll); stint_body.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	stint_chart=RaceStintHistory.new();stint_body.add_child(stint_chart)
	narrative = UI.paragraph(""); stint_body.add_child(narrative)
	var explanation = UI.paragraph("Measured consequences remain separate from estimates. Open the debrief for accepted orders, estimated losses at the time of the call, and actual pit visits. Experiments cannot replace the original result.")
	pages[3].add_child(explanation)
	if model is StrategyRaceSim:
		journal=RaceJournalView.new();journal.configure(model);journal.size_flags_vertical=Control.SIZE_EXPAND_FILL;pages[3].add_child(journal)
	var deep = UI.hbox(pages[3])
	for label in [["Open debrief","debrief"],["Circuit notebook","notebook"],["Replay / sandbox","replay"]]:
		if label[1] in ["notebook","replay"] and not model is PracticeRaceSim:continue
		deep.add_child(UI.button(label[0],func(): action_requested.emit(label[1])))
	var actions = UI.hbox(self)
	for label in [["Export evidence","export"],["Next session / weekend","next"]]:
		var button=UI.button(label[0],func(): action_requested.emit(label[1]),label[1]=="next");actions.add_child(button)
		if label[1]=="next":next_button=button
	show_page(0)
func show_page(index: int) -> void:
	mode = index
	for i in range(pages.size()): pages[i].visible = i == index; PitwallDesign.navigation(buttons[i],i==index)
	present()
func attach(panel: SessionResultsPanel) -> void:
	result_panel = panel
	if panel.get_parent() != pages[0]: panel.reparent(pages[0])
	panel.size_flags_vertical = Control.SIZE_EXPAND_FILL; panel.show()
func present() -> void:
	if narrative == null: return
	if result_panel: result_panel.refresh()
	if next_button:
		next_button.disabled=model.phase not in ["qualifying_results","practice_results","results"]
		next_button.tooltip_text="Complete the session before advancing." if next_button.disabled else "Advance explicitly; original result acceptance remains separate."
	if journal and mode==3:journal.present()
	if stint_chart:stint_chart.visible=model.phase=="results";stint_chart.present(model)
	var c = model.cars[driver_id]
	var records = lap_records(driver_id)
	var data = lap_data(records)
	var secondary: Array = []; var secondary_name = ""
	var other_id = 6 if driver_id == 3 else 3
	compare.disabled = model.phase == "practice_results"
	compare.tooltip_text = "Practice objectives, setup and run conditions may differ; compare their reports rather than pair unmatched runs." if compare.disabled else "Observed laps are not a controlled strategy attribution. Unmatched lap/run IDs remain gaps."
	compare.text = "Compare " + model.cars[other_id].name + " · dashed trace"
	if compare.button_pressed and not compare.disabled:
		var other = lap_data(lap_records(other_id))
		var pair = RaceMetricChart.align_recordings(data.positions, data.values, other.positions, other.values)
		if not pair.is_empty():
			var warnings: Dictionary = {}
			for source in [data, other]:
				for i in range(source.positions.size()):
					if source.labels[i].ends_with(" !"): warnings[float(source.positions[i])] = true
			data.positions = pair.x; data.values = pair.first
			data.labels = pair.x.map(func(at): return ("Run " if model.phase == "qualifying_results" else "Lap ") + str(int(at)) + (" !" if warnings.has(at) else ""))
			secondary = pair.second; secondary_name = model.cars[other_id].short + " dashed"
	var bounds = RaceMetricChart.padded_range(data.values + secondary)
	var axis = "Run" if model.phase == "qualifying_results" else ("Practice lap" if model.phase == "practice_results" else "Lap")
	laps.present_samples("Measured laps · " + c.short,"seconds",data.values,bounds.x,bounds.y,data.positions,data.labels,axis,secondary,secondary_name)
	var invalid = records.filter(func(entry): return not entry.get("valid", true)).size()
	var pits = records.filter(func(entry): return entry.get("pit_lap", false)).size()
	lap_note.text = "%s · %d recorded laps · %d invalid · %d pit laps\n! marks invalid or pit laps; measured durations remain visible, but do not establish a fastest lap. Gaps are unavailable, never zero." % [c.name,records.size(),invalid,pits]
	if model.phase == "practice_results": lap_note.text += "\nPractice is not classified. Run/lap labels preserve the original observations."
	sectors.present(records)

	if model.phase != "results":
		narrative.text = "No final race stint or pit-visit summary for this session. Qualifying and practice use measured lap evidence; fitting a tyre set in the garage is not a race pit stop."
		return
	var lines: Array[String] = []
	for id in [3,6]:
		var car = model.cars[id]
		lines.append("%s · %d completed laps · %d actual pit visits" % [car.name,car.completed,car.pit_stops])
		for stint in car.stints:
			var finish = "ongoing" if stint.to < 0 else "%.2f" % stint.to
			lines.append("%s  ·  distance laps %.2f → %s" % [stint.set_id,stint.from,finish])
		lines.append("")
	narrative.text = "MEASURED STINT HISTORY

" + "
".join(lines) + "
A planned stop is not counted as a physical visit."

func lap_records(id: int) -> Array:
	var c = model.cars[id]
	if model.phase == "qualifying_results": return c.qual_history
	if model.phase == "practice_results":
		var records: Array = []
		if model is PracticeRaceSim:
			for run in model.practice_driver(id).runs:
				for i in range(run.samples.size()):
					var sample = run.samples[i].duplicate(true)
					# Practice time is the crossing timestamp; seconds is the lap duration.
					sample.observed_at = sample.get("time")
					sample.erase("time")
					sample.label = "%s / lap %d" % [run.id, i + 1]
					sample.lap = records.size() + 1
					records.append(sample)
		return records
	return c.history

func lap_data(records: Array) -> Dictionary:
	var values: Array = []; var positions: Array = []; var labels: Array = []
	for i in range(records.size()):
		var entry = records[i]
		var value: Variant = entry.get("time", entry.get("seconds"))
		values.append(value if RaceMetricChart.finite_value(value) and float(value) > 0 else null)
		positions.append(entry.get("lap", entry.get("run", i + 1)))
		var label = str(entry.get("label", ("Run " if model.phase == "qualifying_results" else "Lap ") + str(positions.back())))
		if not entry.get("valid", true) or entry.get("pit_lap", false): label += " !"
		labels.append(label)
	return {"values":values,"positions":positions,"labels":labels}
