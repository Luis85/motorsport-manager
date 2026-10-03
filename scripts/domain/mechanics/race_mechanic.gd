class_name RaceMechanic
extends RefCounted


## Construction-time rule provider. Never retain the supplied aggregate or own time.
## A provider has stable identity, ordered prerequisites and explicit aggregate hooks.
func definition() -> Dictionary:
	return {}


func install(
	_simulation: RaceSim, _geometry: TrackGeometry = null, _options: Dictionary = {}
) -> void:
	pass
