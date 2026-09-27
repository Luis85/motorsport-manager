class_name RaceVisualPort
extends RefCounted
## Render-side query contract. Returned values/geometry are detached from live state.
## Implementations must not advance time, emit commands, draw or consume gameplay RNG.
const SURFACE_STATIONS = 96
const SURFACE_LANES = 7

func capture() -> Dictionary:
	return {}

func surface_values(_channel: String) -> Array:
	return []

func rejoin(_forecast: Dictionary) -> Dictionary:
	return {}

func detached_track() -> TrackGeometry:
	return null
