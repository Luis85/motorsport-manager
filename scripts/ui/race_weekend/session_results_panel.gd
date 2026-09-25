class_name SessionResultsPanel
extends VBoxContainer
## First-class results surface built only from authoritative completed-session data.
var model: RaceSim
var classification: Tree
var summary: Label

func configure(value: RaceSim) -> void:
	model = value

func _ready() -> void:
	add_theme_constant_override("separation", 8)
	add_child(UI.label("SESSION RESULTS", 18, UI.ACCENT))
	summary = UI.paragraph(""); add_child(summary)
	classification = Tree.new(); classification.columns = 6; classification.hide_root = true; classification.column_titles_visible = true
	for i in range(6):
		classification.set_column_title(i, ["POS", "DRIVER", "TIME / GAP", "TYRE", "PITS", "BEST"][i])
	classification.size_flags_vertical = Control.SIZE_EXPAND_FILL; add_child(classification)
	refresh()

func refresh() -> void:
	if model == null or classification == null: return
	classification.clear(); var root = classification.create_item()
	var order = model.standings(model.phase in ["qualifying", "qualifying_results"])
	for i in range(order.size()):
		var c = order[i]; var row = classification.create_item(root)
		row.set_text(0, str(i + 1)); row.set_text(1, c.short)
		var result = "DNF" if c.dnf else ("WINNER" if i == 0 else ("+%.3f" % maxf(0, c.finish_time - order[0].finish_time) if c.finished and order[0].finished else RaceSim.format_time(c.qual_best)))
		row.set_text(2, result); row.set_text(3, c.compound); row.set_text(4, str(c.pit_stops)); row.set_text(5, RaceSim.format_time(c.best_lap))
		for col in range(6): row.set_custom_bg_color(col, UI.SELECTED if c.player else UI.PANEL)
	summary.text = "Classification uses completed laps and measured session evidence. Review / Debrief retains decision evidence; no hypothetical finishing position is presented as fact."
