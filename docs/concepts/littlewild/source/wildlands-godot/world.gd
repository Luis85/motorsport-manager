extends Node3D
## Native presentation consumes detached views. Rendering never advances gameplay.
const AssetFactory = preload("res://native/assets.gd")
const CreatureFactory = preload("res://native/creatures.gd")
var assets = AssetFactory.new()
var creatures = CreatureFactory.new()
var camera := Camera3D.new()
var static_root := Node3D.new()
var actor_root := Node3D.new()
var entities: Dictionary = {}
var actors: Dictionary = {}
var last_view: Dictionary = {}
var canonical_view: Dictionary = {}
var room: Dictionary = {}
var room_floor := ""
var room_camera: Dictionary = {}
var observations: Dictionary = {}
var visual_time := 0.0
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
	canonical_view = view
	if not room.is_empty():
		view = view.duplicate(true)
		view.target = {"type": "interior", "buildingId": room.buildingId, "floorId": room_floor}
		view.interior = room
		var scenery: Dictionary = room.get("sceneProps", {})
		view.props = (
			scenery.get("props", []) if str(scenery.get("floorId", "")) == room_floor else []
		)
	last_view = view
	assets.install(view.get("assets", []))
	var state: Dictionary = view.get("state", {})
	var target: Variant = view.get("target")
	var signature := JSON.stringify(
		[
			state.get("estate"),
			state.get("terraform"),
			view.get("snapshot", {}).get("sceneId"),
			view.get("props"),
			target
		]
	)
	if (
		target is Dictionary
		and target.get("type") == "interior"
		and view.get("interior") is Dictionary
	):
		for floor_record in view.interior.get("floors", []):
			if str(floor_record.id) == str(target.floorId):
				signature += JSON.stringify(floor_record)
	for building in state.get("buildings", []):
		signature += str(_record_values(building, ["id", "kind", "x", "y", "door"]))
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
			_place_props(view.get("props", []))
	_update_actors(view)
	if not timeline.is_empty():
		apply_timeline(timeline)


func set_room(interior: Dictionary, floor_id: String) -> void:
	if room.is_empty():
		room_camera = {"center": center, "zoom": zoom, "yaw": yaw}
	room = interior.duplicate(true)
	room_floor = floor_id
	if not canonical_view.is_empty():
		update_view(canonical_view)


func clear_room() -> void:
	room.clear()
	room_floor = ""
	if not room_camera.is_empty():
		center = room_camera.center
		zoom = room_camera.zoom
		yaw = room_camera.yaw
		room_camera.clear()
	if not canonical_view.is_empty():
		update_view(canonical_view)


func _process(delta: float) -> void:
	var snapshot: Dictionary = last_view.get("snapshot", {})
	var animate := _is_animating(snapshot)
	if animate:
		visual_time += minf(maxf(delta, 0), 0.1)
	for id in actors:
		var observed: Dictionary = observations.get(id, {})
		if not observed.is_empty():
			_pose_actor(
				actors[id],
				observed,
				float(snapshot.get("simTime", 0)),
				animate,
				float(observed.get("velocity", 0)) * minf(delta, 0.1) if animate else 0
			)


func _height(state: Dictionary, x: float, y: float) -> float:
	var tiles: Dictionary = state.get("terraform", {}).get("tiles", {})
	var tile: Dictionary = tiles.get(str(roundi(x)) + "," + str(roundi(y)), {})
	return float(tile.get("height", 0))


func _record_values(record: Dictionary, fields: Array) -> Array:
	return fields.map(func(field): return record.get(field))


func _has_work(record: Dictionary, task: Dictionary, inside: bool) -> bool:
	return record.get("stationId") != null if inside else task.get("phase") == "work"


func _is_animating(snapshot: Dictionary) -> bool:
	return bool(snapshot.get("started", false)) and not bool(snapshot.get("paused", true))


func _pose_actor(
	actor: Node3D, observed: Dictionary, sim_time: float, animate: bool, stride: float
) -> void:
	creatures.pose(
		assets,
		actor,
		observed.actor,
		sim_time,
		visual_time,
		observed.moving,
		observed.working,
		animate,
		stride
	)


func _place_props(props: Array) -> void:
	for prop in props:
		_place(
			str(prop.category), str(prop.assetId), prop, str(prop.get("model", "world")), "props"
		)


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
				var ground: String = tile.get(
					"ground",
					"grass" if terrain.is_empty() or str(terrain[y])[x] == "." else "water"
				)
				if ground == "grass":
					_tile(
						gx,
						gy,
						float(tile.get("height", 0)),
						"#c6bd96" if x == 9 or y == 9 else "#9bb889"
					)
		for direction in [Vector2i(1, 0), Vector2i(0, 1)]:
			if islands.any(
				func(other):
					return (
						int(other.ix) == int(island.ix) + direction.x
						and int(other.iy) == int(island.iy) + direction.y
					)
			):
				_tile(
					int(island.ix) * 23 + (20.5 if direction.x else 9),
					int(island.iy) * 23 + (20.5 if direction.y else 9),
					0,
					"#b7a57f",
					Vector3(4 if direction.x else 1, 1, 4 if direction.y else 1)
				)
	if not islands.is_empty():
		center = Vector3(int(islands[0].ix) * 23 + 9, 0, int(islands[0].iy) * 23 + 9)
		_move_camera()
	for building in state.get("buildings", []):
		_place("building", str(building.kind), building, "world", "buildings")
	for node in state.get("nodes", []):
		if float(node.get("stock", 0)) > 0:
			_place("item", str(node.kind), node, "world", "nodes")


func _place(
	category: String, id: String, record: Dictionary, model: String, collection: String
) -> void:
	var instance: Node3D = assets.create(category, id, model)
	instance.position = Vector3(
		float(record.x),
		_height(last_view.get("state", {}), float(record.x), float(record.y)),
		float(record.y)
	)
	if category == "building":
		var door: Dictionary = record.get("door", {})
		instance.rotation.y = (
			PI / 2
			if door.get("dx") == 1
			else -PI / 2 if door.get("dx") == -1 else PI if door.get("dy") == -1 else 0.0
		)
	static_root.add_child(instance)
	instance.set_meta("canonical_id", record.id)
	entities[collection + ":" + str(record.id)] = instance


func _build_interior(view: Dictionary, floor_id: String) -> void:
	var interior: Dictionary = (
		view.get("interior", {}) if view.get("interior") is Dictionary else {}
	)
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
	_place_props(view.get("props", []))


func _update_actors(view: Dictionary) -> void:
	var records: Array = view.get("snapshot", {}).get("actors", [])
	var interior: Variant = view.get("interior")
	var target: Variant = view.get("target")
	var definitions: Array = view.get("creatures", [])
	var seen: Dictionary = {}
	var state: Dictionary = view.get("state", {})
	var canonical: Dictionary = {}
	for entry in state.get("colony", {}).get("creatures", []):
		canonical[str(entry.id)] = entry
	var indoors: Dictionary = state.get("interiors", {}).get("locations", {})
	var open_environment := (
		str(view.get("worldProfile", {}).get("environment", {}).get("mode", "")) == "indoor"
	)
	if interior is Dictionary and target is Dictionary:
		records = interior.get("actors", []).filter(
			func(actor): return str(actor.floorId) == str(target.floorId)
		)
	for record in records:
		var id := str(record.id)
		var creature: Dictionary = canonical.get(id, record)
		if not creatures.onsite(state, creature):
			continue
		if not interior is Dictionary and not open_environment and indoors.has(id):
			continue
		seen[id] = true
		var asset_id := str(creature.get("archetype", ""))
		for definition in definitions:
			if definition.get("id") == creature.get("archetype"):
				asset_id = str(definition.get("visualAsset", asset_id))
		var appearance_values := _record_values(creature, ["archetype", "personality", "equipment"])
		appearance_values.append(assets.definitions.get("actor:" + asset_id, {}))
		var appearance := JSON.stringify(appearance_values)
		if actors.has(id) and actors[id].get_meta("appearance_key", "") != appearance:
			actors[id].free()
			actors.erase(id)
		if not actors.has(id):
			var actor: Node3D = creatures.create(assets, creature, definitions)
			actor.set_meta("appearance_key", appearance)
			actor_root.add_child(actor)
			actors[id] = actor
			var label := Label3D.new()
			label.text = str(record.name)
			label.name = "ActorName"
			label.position.y = float(actor.get_meta("label_height", 1.3))
			label.billboard = BaseMaterial3D.BILLBOARD_ENABLED
			label.font_size = 32
			actor.add_child(label)
		var point: Dictionary = record.get("position", record)
		var actor: Node3D = actors[id]
		actor.get_node("ActorName").text = str(record.name)
		var position := Vector3(
			float(point.x),
			0 if interior is Dictionary else _height(state, float(point.x), float(point.y)),
			float(point.y)
		)
		var distance := actor.position.distance_to(position) if observations.has(id) else 0.0
		actor.position = position
		var direction := float(record.get("direction", 0))
		if not interior is Dictionary:
			direction = float(creature.get("creature", {}).get("dir", 0))
		actor.rotation = Vector3(0, direction, 0)
		actor.visible = true
		actor.scale = (
			actor.get_meta("appearance_scale", Vector3.ONE) * (1.12 if id == selected else 1.0)
		)
		var task: Dictionary = (
			creature.get("task", {}) if creature.get("task") is Dictionary else {}
		)
		var moving := bool(record.get("moving", task.get("phase") == "walk"))
		var working := not moving and _has_work(record, task, interior is Dictionary)
		var sim_time := float(view.get("snapshot", {}).get("simTime", 0))
		var previous: Dictionary = observations.get(id, {})
		var elapsed := sim_time - float(previous.get("time", sim_time))
		var velocity := distance / elapsed if elapsed > 0 else float(previous.get("velocity", 0))
		observations[id] = {
			"actor": creature,
			"moving": moving,
			"working": working,
			"time": sim_time,
			"velocity": velocity
		}
		_pose_actor(actor, observations[id], sim_time, _is_animating(view.get("snapshot", {})), 0)
		entities["creatures:" + id] = actor
	for id in actors.keys():
		if not seen.has(id):
			actors[id].free()
			actors.erase(id)
			observations.erase(id)
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
		node.position = Vector3(
			float(values.get("x", node.position.x)),
			float(values.get("height", node.position.y)),
			float(values.get("y", node.position.z))
		)
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
	if not canonical_view.is_empty():
		update_view(canonical_view)


func reset_presentation() -> void:
	room.clear()
	room_floor = ""
	room_camera.clear()
	center = Vector3(9, 0, 9)
	zoom = 29.0
	yaw = 0.75
	observations.clear()
	visual_time = 0
	timeline.clear()
	timeline_camera.clear()
	static_signature = ""
	for actor in actors.values():
		actor.free()
	actors.clear()
	entities.clear()
