class_name PitwallComparison
extends VBoxContainer
## Alternatives remain together; all numbers originate in the existing forecaster.
var rows: Array = []
var caption: Label
var latest: Dictionary = {}
var pit_summary: Label

func _ready() -> void:
	add_theme_constant_override("separation", 2)
	caption = UI.label("ESTIMATED REMAINING RACE", 11, PitwallDesign.MUTED); add_child(caption); caption.hide() # The first row already names active versus unapplied draft.
	pit_summary = UI.label("", 12); add_child(pit_summary)
	for i in range(3):
		var panel = UI.panel(); panel.add_theme_stylebox_override("panel", UI.box(UI.CARD, UI.LINE, 4, 1)); add_child(panel)
		var body = UI.vbox(panel); body.add_theme_constant_override("separation", 0)
		var header = UI.hbox(body)
		var title = UI.label("", 13); title.size_flags_horizontal = Control.SIZE_EXPAND_FILL; header.add_child(title)
		var value = UI.label("", 13); header.add_child(value)
		var detail = UI.label("", 12, PitwallDesign.MUTED); detail.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART; body.add_child(detail)
		rows.append({"panel": panel, "title": title, "value": value, "detail": detail})

func present(forecast: Dictionary, is_draft: bool = false) -> void:
	latest = forecast
	var options = forecast.get("options", [])
	for i in range(rows.size()):
		var row = rows[i]; row.panel.visible = i < options.size()
		if i >= options.size(): continue
		var option = options[i]
		row.title.text = "Draft plan (unapplied)" if is_draft and option.get("id") == "current" else option.get("title", option.get("id", "Option")).capitalize()
		row.value.text = "~%.0f–%.0f s" % [option.get("low", 0), option.get("high", 0)] if option.get("available", false) else "Unavailable"
		var gain = float(option.get("gain", 0))
		var difference = "Baseline" if i == 0 else "~%.1f s %s vs %s" % [absf(gain), "faster" if gain >= 0 else "slower", "draft" if is_draft else "active plan"]
		row.detail.text = option.get("reason", "") if not option.get("available", false) else "%s risk · %s" % [str(option.get("risk", "Uncertain")).capitalize(), difference]
		row.detail.tooltip_text = row.detail.text
	caption.text = "DRAFT ESTIMATES · NOT APPROVED" if is_draft else "ACTIVE PLAN · ESTIMATES"
	var pit = forecast.get("pit", {})
	pit_summary.text = "Estimates · pit ~%.0f–%.0f s · rejoin ~P%d–%d" % [pit.get("loss_low", 0), pit.get("loss_high", 0), pit.get("position_low", 0), pit.get("position_high", 0)]
	pit_summary.tooltip_text = "Net pit loss estimate including transit, service and shared-box queue.\n" + "\n".join(forecast.get("assumptions", []))
