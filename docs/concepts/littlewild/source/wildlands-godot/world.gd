extends Node3D
## Native presentation consumes detached views. Rendering never advances gameplay.
const AssetFactory = preload("res://native/assets.gd")
var assets = AssetFactory.new()
var camera := Camera3D.new()
var static_root := Node3D.new()
var actor_root := Node3D.new()
var entities: Dictionary = {}
var actors: Dictionary = {}
var last_view: Dictionary = {}
var static_signature := ""
var center := Vector3(9, 0, 9)
var yaw := 0.75
var zoom := 29.0
var selected := ""
var timeline: Dictionary = {}
var timeline_camera: Dictionary = {}

func _ready() -> void:
	add_child(static_root)
	add_child(actor_root)
	add_child(camera)
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.current = true
	camera.far = 600
	var environment := WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color("#d6e5df")
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color("#fff0d6")
	environment.environment.ambient_light_energy = 0.8
	add_child(environment)
	var sun := DirectionalLight3D.new()
	sun.rotation_degrees = Vector3(-55, -30, 0)
	sun.light_energy = 1.5
	add_child(sun)
	_move_camera()

func _move_camera() -> void:
	camera.size = zoom
	camera.position = center + Vector3(sin(yaw) * 45, 42, cos(yaw) * 45)
	camera.look_at(center)

func orbit(amount: float) -> void:
	yaw += amount
	_move_camera()

func magnify(amount: float) -> void:
	zoom = clampf(zoom * amount, 5, 100)
	_move_camera()

func update_view(view: Dictionary) -> void:
	last_view = view
	assets.install(view.get("assets", []))
	var state: Dictionary = view.get("state", {})
	var target: Variant = view.get("target")
	var signature := JSON.stringify([state.get("estate"), state.get("terraform"), view.get("snapshot", {}).get("sceneId"), view.get("props"), target])
	for building in state.get("buildings", []):
		signature += str([building.get("id"), building.get("kind"), building.get("x"), building.get("y"), building.get("door")])
	for node in state.get("nodes", []):
		signature += str([node.get("id"), node.get("kind"), float(node.get("stock", 0)) > 0])
	if signature != static_signature:
		static_signature = signature
		for child in static_root.get_children():
			child.free()
		entities.clear()
		if target is Dictionary and target.get("type") == "interior":
			_build_interior(view, str(target.floorId))
		else:
			_build_exterior(state, view.get("worldProfile", {}), target)
			for prop in view.get("props", []):
				_place(str(prop.category), str(prop.assetId), prop, str(prop.get("model", "world")), "props")
	_update_actors(view)
	if not timeline.is_empty():
		apply_timeline(timeline)

func _height(state: Dictionary, x: float, y: float) -> float:
	return float(state.get("terraform", {}).get("tiles", {}).get(str(roundi(x)) + "," + str(roundi(y)), {}).get("height", 0))

func _tile(x: float, y: float, height: float, color: String, size := Vector3.ONE) -> void:
	var mesh := MeshInstance3D.new()
	mesh.mesh = assets.primitive("box")
	mesh.material_override = assets.colored(color)
	mesh.position = Vector3(x, height - 0.12, y)
	mesh.scale = Vector3(size.x, 0.25 * size.y, size.z)
	static_root.add_child(mesh)

func _build_exterior(state: Dictionary, profile: Dictionary, target: Variant) -> void:
	_tile(9, 9, -0.65, "#a2c4c5", Vector3(900, 1, 900))
	var islands: Array = state.get("estate", {}).get("islands", [{"ix": 0, "iy": 0}])
	if target is Dictionary and target.get("type") == "island":
		islands = [{"ix": target.ix, "iy": target.iy}]
	var terrain: Array = profile.get("terrain", [])
	var overrides: Dictionary = state.get("terraform", {}).get("tiles", {})
	for island in islands:
		for x in range(19):
			for y in range(19):
				var gx := int(island.ix) * 23 + x
				var gy := int(island.iy) * 23 + y
				var tile: Dictionary = overrides.get(str(gx) + "," + str(gy), {})
				var ground: String = tile.get("ground", "grass" if terrain.is_empty() or str(terrain[y])[x] == "." else "water")
				if ground == "grass":
					_tile(gx, gy, float(tile.get("height", 0)), "#c6bd96" if x == 9 or y == 9 else "#9bb889")
		for direction in [Vector2i(1, 0), Vector2i(0, 1)]:
			if islands.any(func(other): return int(other.ix) == int(island.ix) + direction.x and int(other.iy) == int(island.iy) + direction.y):
				_tile(int(island.ix) * 23 + (20.5 if direction.x else 9), int(island.iy) * 23 + (20.5 if direction.y else 9), 0, "#b7a57f", Vector3(4 if direction.x else 1, 1, 4 if direction.y else 1))
	if not islands.is_empty():
		center = Vector3(int(islands[0].ix) * 23 + 9, 0, int(islands[0].iy) * 23 + 9)
		_move_camera()
	for building in state.get("buildings", []):
		_place("building", str(building.kind), building, "world", "buildings")
	for node in state.get("nodes", []):
		if float(node.get("stock", 0)) > 0:
			_place("item", str(node.kind), node, "world", "nodes")

func _place(category: String, id: String, record: Dictionary, model: String, collection: String) -> void:
	var instance: Node3D = assets.create(category, id, model)
	instance.position = Vector3(float(record.x), _height(last_view.get("state", {}), float(record.x), float(record.y)), float(record.y))
	if category == "building":
		var door: Dictionary = record.get("door", {})
		instance.rotation.y = PI / 2 if door.get("dx") == 1 else -PI / 2 if door.get("dx") == -1 else PI if door.get("dy") == -1 else 0.0
	static_root.add_child(instance)
	instance.set_meta("canonical_id", record.id)
	entities[collection + ":" + str(record.id)] = instance

func _build_interior(view: Dictionary, floor_id: String) -> void:
	var interior: Dictionary = view.get("interior", {}) if view.get("interior") is Dictionary else {}
	for floor_record in interior.get("floors", []):
		if str(floor_record.id) != floor_id:
			continue
		var cells: Array = floor_record.get("cells", [])
		if cells.is_empty():
			for x in range(int(floor_record.width)):
				for y in range(int(floor_record.height)):
					cells.append({"x": x, "y": y})
		for cell in cells:
			_tile(float(cell.x), float(cell.y), 0, "#decbaa")
		for station in floor_record.get("stations", []):
			_tile(float(station.x), float(station.y), 0.45, "#ad9975", Vector3(0.7, 3, 0.7))
		center = Vector3(float(floor_record.width) / 2, 0, float(floor_record.height) / 2)
		zoom = maxf(float(floor_record.width), float(floor_record.height)) + 5
		_move_camera()
	for prop in view.get("props", []):
		_place(str(prop.category), str(prop.assetId), prop, str(prop.get("model", "world")), "props")

func _update_actors(view: Dictionary) -> void:
	var records: Array = view.get("snapshot", {}).get("actors", [])
	var interior: Variant = view.get("interior")
	var target: Variant = view.get("target")
	var definitions: Array = view.get("creatures", [])
	var seen: Dictionary = {}
	if interior is Dictionary and target is Dictionary:
		records = interior.get("actors", []).filter(func(actor): return str(actor.floorId) == str(target.floorId))
	for record in records:
		var id := str(record.id)
		seen[id] = true
		if not actors.has(id):
			var asset_id := str(record.get("visualAsset", record.get("archetype", "sproutling")))
			for definition in definitions:
				if str(definition.id) == str(record.get("archetype", "")):
					asset_id = str(definition.get("visualAsset", asset_id))
			var actor: Node3D = assets.create("actor", asset_id)
			actor_root.add_child(actor)
			actors[id] = actor
			var label := Label3D.new()
			label.text = str(record.name)
			label.name = "ActorName"
			label.position.y = 1.8
			label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			label.font_size = 32
			actor.add_child(label)
		var point: Dictionary = record.get("position", record)
		var actor: Node3D = actors[id]
		actor.get_node("ActorName").text = str(record.name)
		actor.position = Vector3(float(point.x), _height(view.get("state", {}), float(point.x), float(point.y)), float(point.y))
		var direction := float(record.get("direction", 0))
		for canonical in view.get("state", {}).get("colony", {}).get("creatures", []):
			if str(canonical.id) == id and not interior is Dictionary:
				direction = float(canonical.get("creature", {}).get("dir", 0))
		actor.rotation = Vector3(0, direction, 0)
		actor.visible = true
		actor.scale = Vector3.ONE * (1.12 if id == selected else 1.0)
		entities["creatures:" + id] = actor
	for id in actors.keys():
		if not seen.has(id):
			actors[id].free()
			actors.erase(id)
			entities.erase("creatures:" + str(id))

func apply_timeline(sample: Dictionary) -> void:
	if timeline_camera.is_empty():
		timeline_camera = {"center": center, "zoom": zoom}
	timeline = sample
	for pose in sample.get("poses", []):
		var key := str(pose.target.category) + ":" + str(pose.target.id)
		if not entities.has(key):
			continue
		var node: Node3D = entities[key]
		var values: Dictionary = pose.values
		node.position = Vector3(float(values.get("x", node.position.x)), float(values.get("height", node.position.y)), float(values.get("y", node.position.z)))
		if values.has("rotation"):
			node.rotation.y = float(values.rotation)
		if values.has("scale"):
			node.scale = Vector3.ONE * float(values.scale)
		if values.has("opacity"):
			node.visible = float(values.opacity) > 0
	var values: Dictionary = sample.get("camera", {})
	center.x = float(values.get("x", center.x))
	center.z = float(values.get("y", center.z))
	if values.has("zoom"):
		zoom = 29 / maxf(float(values.zoom), 0.1)
	_move_camera()

func clear_timeline() -> void:
	timeline.clear()
	if not timeline_camera.is_empty():
		center = timeline_camera.center
		zoom = timeline_camera.zoom
		timeline_camera.clear()
		_move_camera()
	static_signature = ""
	if not last_view.is_empty():
		update_view(last_view)

func reset_presentation() -> void:
	timeline.clear()
	timeline_camera.clear()
	static_signature = ""
	for actor in actors.values():
		actor.free()
	actors.clear()
	entities.clear()
