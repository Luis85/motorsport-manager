class_name TrackPreviewHandle
extends RefCounted
## Preview input and detached observations, without application clock authority.
var _source: WeakRef


func _init(preview: TrackReferencePreview) -> void:
	_source = weakref(preview)


func toggle(track: TrackGeometry) -> void:
	var preview = _source.get_ref()
	if preview != null:
		preview.toggle(track)


func stop() -> void:
	var preview = _source.get_ref()
	if preview != null:
		preview.stop()


func capture() -> Dictionary:
	var preview = _source.get_ref()
	return (
		preview.capture()
		if preview != null
		else {"running": false, "distance": 0.0, "elapsed": 0.0, "laps": 0}
	)
