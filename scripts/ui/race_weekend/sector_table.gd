class_name RaceSectorTable
extends VBoxContainer
## Native cells align measurements without fixed-space pseudo-columns.
## Missing/unmeasured sectors are unavailable, never fabricated zeroes.
var rows: Array[HBoxContainer] = []
var cells: Array = []
var empty: Label
var stamp: Array = []

func _ready() -> void:
	add_theme_constant_override("separation", 3)
	var header = UI.hbox(self)
	for text in ["LAP", "S1", "S2", "S3", "TOTAL"]: _cell(header, text, UI.MUTED)
	empty = UI.paragraph("No measured laps yet."); add_child(empty)
	for i in range(8):
		var row = UI.hbox(self); rows.append(row); row.hide()
		var values: Array[Label] = []
		for column in range(5): values.append(_cell(row, "—", UI.INK))
		cells.append(values)

func _cell(parent: Control, text: String, color: Color) -> Label:
	var label = UI.label(text, 11, color)
	label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	label.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	parent.add_child(label); return label

func present(records: Array, limit: int = 8) -> void:
	if empty == null: return
	var count = mini(clampi(limit, 0, rows.size()), records.size())
	var data = records.slice(records.size() - count) if count > 0 else []
	if stamp == data: return
	stamp = data.duplicate(true); empty.visible = count == 0
	for i in range(rows.size()):
		rows[i].visible = i < count
		if i >= count: continue
		var record = data[i]
		var sectors = record.get("sectors", [])
		var values = cells[i]
		values[0].text = str(record.get("lap", record.get("run", i + 1)))
		for column in range(3):
			values[column + 1].text = "%.3f" % float(sectors[column]) if column < sectors.size() and float(sectors[column]) > 0 else "—"
		var total = float(record.get("time", record.get("seconds", 0.0)))
		values[4].text = RaceSim.format_time(total) + (" !" if not record.get("valid", true) else "")
		var description = "Invalid lap: " + str(record.get("reason", "not classified")) if not record.get("valid", true) else ("Measured pit lap" if record.get("pit_lap", false) else "Measured lap")
		for value in values: value.tooltip_text = description + ". Unavailable sector data is shown as —."
