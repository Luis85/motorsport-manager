extends VBoxContainer
## Visiting a room is presentation only. Companion visits and production emit intents.
var runtime: Node
var world: Node3D
var actor_selection: Callable
var current_view: Dictionary = {}
var building_id := ""
var floor_id := ""
var room: Dictionary = {}
var querying := false
var pending_request := -1
var last_handled_request := -1
var building_ids: Array[String] = []
var building_signature := ""
var body := VBoxContainer.new()
var buildings := OptionButton.new()
var floors := OptionButton.new()
var stations := OptionButton.new()
var recipes := OptionButton.new()
var batches := SpinBox.new()
var description := Label.new()
var production := Button.new()
var visit := Button.new()
var feedback := Label.new()


func configure(bridge: Node, renderer: Node3D, selected: Callable) -> void:
	runtime = bridge
	world = renderer
	actor_selection = selected
	runtime.response_with_id.connect(_response)
	runtime.rejected_with_id.connect(_rejected)
	var disclosure := Button.new()
	disclosure.text = "Building floors"
	disclosure.pressed.connect(func(): body.visible = not body.visible)
	add_child(disclosure)
	add_child(body)
	body.visible = false
	body.add_child(buildings)
	var inspect_button := Button.new()
	inspect_button.text = "Look inside selected building"
	inspect_button.pressed.connect(
		func():
			if buildings.selected >= 0 and buildings.selected < building_ids.size():
				open(building_ids[buildings.selected])
	)
	body.add_child(inspect_button)
	body.add_child(floors)
	floors.item_selected.connect(_choose_floor)
	description.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.add_child(description)
	visit.text = "Suggest this floor to companion"
	visit.pressed.connect(
		func():
			runtime.request(
				"command",
				{
					"command":
					{
						"id": "visit-building-floor",
						"args": [actor_selection.call(), building_id, floor_id]
					}
				}
			)
	)
	body.add_child(visit)
	body.add_child(stations)
	body.add_child(recipes)
	batches.min_value = 1
	batches.max_value = 12
	batches.value = 1
	batches.prefix = "Batches "
	body.add_child(batches)
	production.text = "Place production order"
	production.pressed.connect(_produce)
	body.add_child(production)
	var leave := Button.new()
	leave.text = "Return to world map"
	leave.pressed.connect(close)
	body.add_child(leave)
	feedback.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.add_child(feedback)
	_set_enabled(false)


func update_view(view: Dictionary) -> void:
	current_view = view
	var signature := ""
	for building in view.get("snapshot", {}).get("buildings", []):
		signature += str([building.id, building.kind])
	if signature != building_signature:
		building_signature = signature
		building_ids.clear()
		buildings.clear()
		for building in view.get("snapshot", {}).get("buildings", []):
			building_ids.append(str(building.id))
			buildings.add_item(str(building.kind).capitalize() + " · " + str(building.id))
	if not building_id.is_empty():
		if not building_ids.has(building_id):
			close()
		else:
			_refresh()


func open(id: String) -> void:
	building_id = id
	if building_ids.has(id):
		buildings.select(building_ids.find(id))
	floor_id = ""
	body.visible = true
	_refresh()


func _refresh() -> void:
	if querying:
		return
	querying = true
	pending_request = runtime.request("query", {"name": "buildingInterior", "args": [building_id]})
	if pending_request < 0:
		querying = false


func _response(id: int, method: String, result: Variant) -> void:
	if method == "query":
		consume(result, id)


func _rejected(id: int, message: String) -> void:
	if id == pending_request:
		querying = false
		pending_request = -1
		feedback.text = message


func consume(result: Variant, id: int) -> bool:
	if not querying or id != pending_request:
		return false
	querying = false
	pending_request = -1
	last_handled_request = id
	if not result is Dictionary or not result.has("floors") or not result.has("buildingId"):
		feedback.text = "This building's interior is unavailable."
		return true
	if building_id.is_empty() or str(result.buildingId) != building_id:
		if not building_id.is_empty():
			_refresh()
		return true
	room = result
	floors.clear()
	var selected := 0
	for index in range(room.floors.size()):
		var floor_record: Dictionary = room.floors[index]
		floors.add_item(str(floor_record.label))
		if str(floor_record.id) == floor_id:
			selected = index
	if room.floors.is_empty():
		close()
		return true
	floors.select(selected)
	_choose_floor(selected)
	return true


func _choose_floor(index: int) -> void:
	if room.is_empty() or index < 0 or index >= room.floors.size():
		return
	var selected: Dictionary = room.floors[index]
	floors.select(index)
	floor_id = str(selected.id)
	var previous_station: Variant = (
		stations.get_item_metadata(stations.selected) if stations.selected >= 0 else null
	)
	var previous_recipe: Variant = (
		recipes.get_item_metadata(recipes.selected) if recipes.selected >= 0 else null
	)
	stations.clear()
	for station in selected.get("stations", []):
		if station.get("production", false):
			stations.add_item(str(station.label))
			stations.set_item_metadata(stations.item_count - 1, station.id)
			if station.id == previous_station:
				stations.select(stations.item_count - 1)
	recipes.clear()
	for recipe in room.get("recipes", []):
		recipes.add_item(str(recipe.name) + " · " + str(recipe.queued) + " queued")
		recipes.set_item_metadata(recipes.item_count - 1, recipe.id)
		if recipe.id == previous_recipe:
			recipes.select(recipes.item_count - 1)
	var activity: Array[String] = []
	for actor in room.get("actors", []):
		if str(actor.floorId) == floor_id:
			activity.append(str(actor.name) + " · " + str(actor.action))
	description.text = (
		str(room.buildingName)
		+ " · "
		+ str(selected.label)
		+ "\n"
		+ ("\n".join(activity) if not activity.is_empty() else "No companion on this floor.")
		+ "\nInputs: "
		+ JSON.stringify(room.get("input", {}))
		+ "\nFinished goods: "
		+ JSON.stringify(room.get("output", {}))
	)
	_set_enabled(true)
	production.disabled = stations.item_count == 0 or recipes.item_count == 0
	production.tooltip_text = (
		"This floor has no available production workstation or recipe."
		if production.disabled
		else "Ingredients must be physically delivered to this building."
	)
	world.set_room(room, floor_id)


func _produce() -> void:
	if production.disabled:
		return
	runtime.request(
		"command",
		{
			"command":
			{
				"id": "order-building-production",
				"args":
				[
					building_id,
					floor_id,
					stations.get_item_metadata(stations.selected),
					recipes.get_item_metadata(recipes.selected),
					int(batches.value)
				]
			}
		}
	)


func _set_enabled(enabled: bool) -> void:
	floors.disabled = not enabled
	visit.disabled = not enabled
	production.disabled = not enabled
	visit.tooltip_text = (
		"Look inside a building first."
		if not enabled
		else "The companion finishes current work and walks here; observing this room does not move them."
	)


func close() -> void:
	body.visible = false
	querying = false
	pending_request = -1
	building_id = ""
	floor_id = ""
	room.clear()
	floors.clear()
	stations.clear()
	recipes.clear()
	description.text = ""
	feedback.text = ""
	_set_enabled(false)
	world.clear_room()


func reset() -> void:
	close()
	building_signature = ""
