class_name TrackReferencePreview
extends RefCounted
## Application-owned reference-lap demonstration, not the racing/tyre simulation.
var _track: TrackGeometry
var _running: bool = false
var _distance: float = 0.0
var _elapsed: float = 0.0
var _laps: int = 0

func toggle(track: TrackGeometry) -> void:
	if _running:
		stop()
		return
	if track == null or track.preview_only or track.length <= 0:
		return
	_track = track.detached_copy()
	_distance = 0.0
	_elapsed = 0.0
	_laps = 0
	_running = true

func stop() -> void:
	_running = false

func advance(elapsed: float) -> void:
	if not _running or not is_finite(elapsed) or elapsed <= 0:
		return
	var delta = minf(elapsed, 0.1)
	var sample = _track.sample(_distance)
	_distance += sample.speed * delta / sample.path_scale
	_elapsed += delta
	while _distance >= _track.length:
		_distance -= _track.length
		_laps += 1

func capture() -> Dictionary:
	return {"running": _running, "distance": _distance, "elapsed": _elapsed, "laps": _laps}
