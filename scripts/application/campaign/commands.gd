class_name CampaignCommands
extends RefCounted
## Weak application command boundary; retaining a controller cannot retain a campaign.
var last_error: String = ""
var _source: WeakRef


func _init(state: CampaignState) -> void:
	_source = weakref(state)


func execute(action: String, payload: Dictionary = {}) -> bool:
	var state: CampaignState = _source.get_ref()
	if state == null:
		last_error = "This campaign is no longer available."
		return false
	var accepted = state.command(action, payload)
	last_error = state.last_error
	return accepted
