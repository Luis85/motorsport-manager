class_name RaceObservationWorkspace
extends HBoxContainer
## Race and qualifying share the spatial observation surface, not their session controls.
func _ready() -> void:
	size_flags_horizontal = Control.SIZE_EXPAND_FILL
	size_flags_vertical = Control.SIZE_EXPAND_FILL
	add_theme_constant_override("separation", PitwallDesign.SPACE_2)
