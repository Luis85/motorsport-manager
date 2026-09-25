class_name RaceSectorTable
extends VBoxContainer
## Compact comparison table used by qualifying, practice and telemetry.
var rows: Array[Label] = []

func _ready() -> void:
	add_theme_constant_override("separation", 3)
	var header = UI.hbox(self)
	for text in ["LAP", "S1", "S2", "S3", "TOTAL"]:
		var label = UI.label(text, 10, UI.MUTED); label.size_flags_horizontal = Control.SIZE_EXPAND_FILL; header.add_child(label)

func present(records: Array, limit: int = 8) -> void:
	while rows.size() < mini(limit, records.size()):
		var label = UI.label("", 11); add_child(label); rows.append(label)
	for i in range(rows.size()):
		rows[i].visible = i < mini(limit, records.size())
		if not rows[i].visible: continue
		var record = records[maxi(0, records.size() - limit) + i]
		var sectors = record.get("sectors", [0.0, 0.0, 0.0])
		rows[i].text = "%02d      %6.2f      %6.2f      %6.2f      %s%s" % [record.get("lap", record.get("run", i + 1)), sectors[0], sectors[1], sectors[2], RaceSim.format_time(record.get("time", record.get("seconds", 0.0))), "  INVALID" if not record.get("valid", true) else ""]
