class_name LocalWeekendEntryStore
extends WeekendEntryStore
var _path: String

func _init(path: String) -> void:
	_path = path

func save_record(record: RaceRecord) -> String:
	return ReplayStorage.save_session(_path, record)
