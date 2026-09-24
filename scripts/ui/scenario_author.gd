class_name ScenarioAuthor
extends ConfirmationDialog
## Draft a challenge around a frozen state; no simulation commands are available here.
signal scenario_ready(data: Dictionary)
var source_sim: PracticeRaceSim
var lineage: Dictionary
var fields: Dictionary = {}
var goal: OptionButton
var notice: Label

func configure(sim: PracticeRaceSim, parent: Dictionary, existing: Dictionary = {}) -> void:
	source_sim = sim; lineage = parent.duplicate(true)
	title = "Author a scenario · frozen sandbox state"
	ok_button_text = "Export scenario…"; cancel_button_text = "Cancel draft"; dialog_hide_on_ok = false
	var body = VBoxContainer.new(); body.custom_minimum_size = Vector2(760, 500); body.size = Vector2(760, 500); add_child(body)
	body.add_child(UI.label("Starting track, field, resources and rules stay fixed.\nDescribe two approaches; their viability must be tested."))
	var scroll = ScrollContainer.new(); scroll.custom_minimum_size = Vector2(680, 370)
	scroll.follow_focus = true; scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED; body.add_child(scroll)
	var form = UI.vbox(scroll, true)
	var draft = existing if not existing.is_empty() else ScenarioBrief.defaults()
	for key in ["title", "briefing", "approach_a", "approach_b", "hint"]:
		var label = {"title": "Title · 80 characters", "briefing": "Decision / briefing · 600 characters", "approach_a": "Approach A · 240 characters", "approach_b": "Approach B · 240 characters", "hint": "Hint and limitations · 600 characters"}[key]
		form.add_child(UI.label(label, 13))
		if key in ["briefing", "hint"]:
			var input = TextEdit.new(); input.custom_minimum_size.y = 68; input.wrap_mode = TextEdit.LINE_WRAPPING_BOUNDARY; input.text = draft[key]
			form.add_child(input); fields[key] = input
		else:
			var input = LineEdit.new(); input.max_length = 80 if key == "title" else 240
			input.text = draft.title if key == "title" else draft.approaches[0 if key == "approach_a" else 1]
			form.add_child(input); fields[key] = input
	goal = UI.option(ScenarioBrief.GOALS.values(), func(_index): pass, ScenarioBrief.GOALS.keys().find(draft.goal))
	UI.field(form, "Observed goal (never grants rewards)", goal)
	notice = UI.label("Export creates data, not a race outcome. Canceling changes nothing."); body.add_child(notice)
	confirmed.connect(submit)
	canceled.connect(queue_free)
	PitwallDesign.scale_controls(self, float(App.settings.pitwall_text_scale))
	popup_centered(Vector2i(810, 590)); PitwallDesign.focus_later(fields.title)

func submit() -> void:
	var brief = {"version": 1, "title": fields.title.text.strip_edges(), "briefing": fields.briefing.text.strip_edges(),
		"approaches": [fields.approach_a.text.strip_edges(), fields.approach_b.text.strip_edges()],
		"hint": fields.hint.text.strip_edges(), "goal": ScenarioBrief.GOALS.keys()[goal.selected]}
	var error = ScenarioBrief.validate(brief)
	if not error.is_empty(): notice.text = error; return
	var data = ReplayScenario.build(source_sim, lineage, brief)
	if data.is_empty(): notice.text = "The source is unavailable. Select an earlier checkpoint."; return
	hide(); scenario_ready.emit(data); queue_free()
