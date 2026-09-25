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
	laps = RaceMetricChart.new(); pages[1].add_child(laps)
	sectors = RaceSectorTable.new(); pages[1].add_child(sectors)
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
	var records: Array = c.qual_history if model.phase == "qualifying_results" else c.history
	if model.phase == "practice_results":
		records = []
		if model is PracticeRaceSim:
			for run in model.practice_driver(driver_id).runs:
				for sample in run.samples: records.append({"seconds":sample.seconds})
	var times: Array = []
	for entry in records:
		var seconds = float(entry.get("time",entry.get("seconds",0)))
		if seconds > 0: times.append(seconds)
	laps.present("Measured laps · " + c.short,"seconds",times, minf(0 if times.is_empty() else times.min()-1,90),maxf(100,0 if times.is_empty() else times.max()+1))
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
