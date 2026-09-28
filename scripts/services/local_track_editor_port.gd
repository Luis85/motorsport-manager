class_name LocalTrackEditorPort
extends TrackEditorPort
## Local-file adapter. Repository callbacks are supplied by the composition root.
var _catalog: Callable
var _save: Callable

func _init(read_catalog: Callable, save_track: Callable) -> void:
	_catalog = read_catalog
	_save = save_track

func catalog() -> Array:
	return _catalog.call().duplicate(true)

func save_authoring(document: Dictionary) -> Dictionary:
	var copy = document.duplicate(true)
	var error: String = _save.call(copy)
	return {"ok": error.is_empty(), "error": error, "document": copy}

func load_authoring(path: String) -> Dictionary:
	var result = Storage.read_json(path)
	if not result.ok:
		return result
	if not result.data is Dictionary:
		return {"ok": false, "error": "The track file must contain an authoring document."}
	var errors = TrackDocument.validate(result.data)
	if not errors.is_empty():
		return {"ok": false, "error": "\n".join(errors)}
	return {"ok": true, "data": result.data.duplicate(true)}

func export_value(path: String, value: Dictionary) -> String:
	return Storage.write_json(path, value)

func read_reference(path: String) -> Dictionary:
	var image = Image.new()
	if image.load(path) != OK:
		return {"ok": false, "error": "Could not read this image."}
	if image.get_width() > 2048 or image.get_height() > 2048:
		var ratio = 2048.0 / maxf(image.get_width(), image.get_height())
		image.resize(maxi(1, int(image.get_width() * ratio)), maxi(1, int(image.get_height() * ratio)))
	var bytes = image.save_png_to_buffer()
	if bytes.size() > 6000000:
		return {"ok": false, "error": "Use an image under 6 MB after PNG conversion."}
	return {"ok": true, "png": Marshalls.raw_to_base64(bytes)}
