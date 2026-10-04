extends RefCounted
## Canonical primitive trees retain IDs, parent-local transforms and material roles.
var definitions: Dictionary = {}
var meshes: Dictionary = {}
var materials: Dictionary = {}

func install(records: Array) -> void:
	definitions.clear()
	for record in records:
		definitions[str(record.category) + ":" + str(record.id)] = record

func create(category: String, id: String, model := "world") -> Node3D:
	var root := Node3D.new()
	root.set_meta("asset_id", category + ":" + id)
	var asset: Dictionary = definitions.get(category + ":" + id, {})
	var models: Dictionary = asset.get("models", {})
	if not models.has(model):
		model = "world" if models.has("world") else str(models.keys()[0]) if not models.is_empty() else ""
	for record in models.get(model, {}).get("nodes", []):
		_create_node(root, asset, record)
	return root

func _create_node(parent: Node3D, asset: Dictionary, record: Dictionary) -> void:
	var node: Node3D
	if record.primitive == "group":
		node = Node3D.new()
	else:
		var instance := MeshInstance3D.new()
		instance.mesh = primitive(str(record.primitive))
		instance.material_override = material(asset, record)
		if not record.get("castShadow", true):
			instance.cast_shadow = GeometryInstance3D.SHADOW_CASTING_SETTING_OFF
		node = instance
	parent.add_child(node)
	node.name = str(record.get("id", "Primitive"))
	node.set_meta("canonical_id", record.get("id", ""))
	node.position = vector(record.get("position", [0, 0, 0]))
	node.scale = vector(record.get("scale", [1, 1, 1]))
	# Three's intrinsic XYZ Euler order is Basis Rx * Ry * Rz.
	var rotation := vector(record.get("rotation", [0, 0, 0]))
	var basis := Basis(Vector3.RIGHT, rotation.x) * Basis(Vector3.UP, rotation.y) * Basis(Vector3.BACK, rotation.z)
	node.basis = basis.scaled_local(node.scale)
	node.visible = record.get("visible", true)
	for child in record.get("children", []):
		_create_node(node, asset, child)

func vector(input: Array) -> Vector3:
	return Vector3(float(input[0]), float(input[1]), float(input[2]))

func material(asset: Dictionary, record: Dictionary) -> StandardMaterial3D:
	var value: Variant = asset.get("materials", {}).get(record.get("material", ""), "#9bb98c")
	var properties: Dictionary = {"color": value} if value is String else value.duplicate()
	properties.merge(record.get("materialProps", {}), true)
	var key := JSON.stringify(properties)
	if materials.has(key):
		return materials[key]
	var result := StandardMaterial3D.new()
	result.albedo_color = Color(str(properties.get("color", "#9bb98c")))
	result.albedo_color.a = float(properties.get("opacity", 1.0))
	result.roughness = float(properties.get("roughness", 0.98))
	result.metallic = float(properties.get("metalness", 0.0))
	result.cull_mode = BaseMaterial3D.CULL_DISABLED
	if properties.get("transparent", false) or result.albedo_color.a < 1:
		result.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if properties.has("emissive"):
		result.emission_enabled = true
		result.emission = Color(str(properties.emissive))
		result.emission_energy_multiplier = float(properties.get("emissiveIntensity", 1))
	materials[key] = result
	return result

func colored(color: String) -> StandardMaterial3D:
	return material({"materials": {"color": color}}, {"material": "color"})

func primitive(kind: String) -> Mesh:
	if meshes.has(kind):
		return meshes[kind]
	var mesh: Mesh
	match kind:
		"box":
			var box := BoxMesh.new()
			box.size = Vector3.ONE
			mesh = box
		"cylinder", "cone":
			var cylinder := CylinderMesh.new()
			cylinder.top_radius = 0 if kind == "cone" else 1
			cylinder.bottom_radius = 1
			cylinder.height = 1
			cylinder.radial_segments = 7 if kind == "cone" else 8
			mesh = cylinder
		"ring":
			var ring := TorusMesh.new()
			ring.inner_radius = 0.93
			ring.outer_radius = 1.07
			ring.rings = 16
			ring.ring_segments = 4
			mesh = ring
		"ground":
			var plane := PlaneMesh.new()
			plane.size = Vector2.ONE
			mesh = plane
		"roof":
			mesh = _roof()
		_:
			var sphere := SphereMesh.new()
			sphere.radius = 1
			sphere.height = 2
			sphere.radial_segments = 6 if kind == "tiny" else 10
			sphere.rings = 4 if kind == "tiny" else 7
			mesh = sphere
	meshes[kind] = mesh
	return mesh

func _roof() -> ArrayMesh:
	var points := [Vector3(-0.5, 0, -0.5), Vector3(0.5, 0, -0.5), Vector3(0, 0.62, -0.5), Vector3(-0.5, 0, 0.5), Vector3(0.5, 0, 0.5), Vector3(0, 0.62, 0.5)]
	var vertices := PackedVector3Array()
	for index in [0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 2, 0, 3, 2, 3, 5]:
		vertices.append(points[index])
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for point in vertices:
		surface.add_vertex(point)
	surface.generate_normals()
	return surface.commit()
