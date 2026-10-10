extends RefCounted
## Canonical primitive trees retain IDs, parent-local transforms and material roles.
var definitions: Dictionary = {}
var installed_records: Array = []
var meshes: Dictionary = {}
var materials: Dictionary = {}
var surface_textures: Dictionary = {}
var surface_entries: Variant = null


func install(records: Array) -> void:
	# Detached view catalogs are values; unchanged snapshots retain GPU resources.
	if records == installed_records:
		return
	installed_records = records.duplicate(true)
	definitions.clear()
	meshes.clear()
	materials.clear()
	for record in installed_records:
		definitions[str(record.category) + ":" + str(record.id)] = record


func create(
	category: String, id: String, model := "world", materials_override: Dictionary = {}
) -> Node3D:
	var root := Node3D.new()
	root.set_meta("asset_id", category + ":" + id)
	var asset: Dictionary = definitions.get(category + ":" + id, {})
	var models: Dictionary = asset.get("models", {})
	if not models.has(model):
		model = (
			"world"
			if models.has("world")
			else str(models.keys()[0]) if not models.is_empty() else ""
		)
	root.set_meta("model_name", model)
	for record in models.get(model, {}).get("nodes", []):
		_create_node(root, asset, record, materials_override)
	return root


func _create_node(
	parent: Node3D, asset: Dictionary, record: Dictionary, overrides: Dictionary
) -> void:
	var node: Node3D
	if record.primitive == "group":
		node = Node3D.new()
	else:
		var instance := MeshInstance3D.new()
		instance.mesh = (
			baked(asset, str(record.get("mesh", "")))
			if record.primitive == "mesh"
			else primitive(str(record.primitive))
		)
		instance.material_override = material(asset, record, overrides)
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
	var basis := (
		Basis(Vector3.RIGHT, rotation.x)
		* Basis(Vector3.UP, rotation.y)
		* Basis(Vector3.BACK, rotation.z)
	)
	node.basis = basis.scaled_local(node.scale)
	node.visible = record.get("visible", true)
	for child in record.get("children", []):
		_create_node(node, asset, child, overrides)


func vector(input: Array) -> Vector3:
	return Vector3(float(input[0]), float(input[1]), float(input[2]))


func material(
	asset: Dictionary, record: Dictionary, overrides: Dictionary = {}
) -> StandardMaterial3D:
	var role: String = record.get("material", "")
	var value: Variant = asset.get("materials", {}).get(role, "#9bb98c")
	var properties: Dictionary = {"color": value} if value is String else value.duplicate()
	if overrides.has(role):
		var replacement: Variant = overrides[role]
		if replacement is String:
			properties["color"] = replacement
		else:
			properties = replacement.duplicate()
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
	result.clearcoat_enabled = float(properties.get("clearcoat", 0)) > 0
	result.clearcoat = float(properties.get("clearcoat", 0))
	result.clearcoat_roughness = float(properties.get("clearcoatRoughness", 0))
	# Godot has no cloth sheen BRDF. Rim is a documented approximation, not parity.
	result.rim_enabled = float(properties.get("sheen", 0)) > 0
	# Rim adds energy instead of redistributing it like cloth sheen. Bound it to 8%.
	result.rim = float(properties.get("sheen", 0)) * 0.08
	result.rim_tint = 1.0
	result.set_meta("authored_surface", properties.duplicate(true))
	if result.rim_enabled:
		result.set_meta(
			"surface_limitation",
			"Sheen uses bounded albedo-tinted rim; sheenColor/roughness are retained only."
		)
	if properties.get("transparent", false) or result.albedo_color.a < 1:
		result.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	if properties.has("emissive"):
		result.emission_enabled = true
		result.emission = Color(str(properties.emissive))
		result.emission_energy_multiplier = float(properties.get("emissiveIntensity", 1))
	if properties.has("surface"):
		_surface(result, properties.surface)
	materials[key] = result
	return result


## Native textures use the exact pixels baked by the portable engine algorithm.
func _surface(result: StandardMaterial3D, descriptor: Dictionary) -> void:
	if surface_entries == null:
		surface_entries = JSON.parse_string(
			FileAccess.get_file_as_string("res://surfaces/index.json")
		)
	if not surface_entries is Array:
		push_error("Missing portable surface texture index")
		return
	for entry in surface_entries:
		if (
			str(entry.surface.kind) != str(descriptor.kind)
			or int(entry.surface.seed) != int(descriptor.seed)
			or float(entry.surface.scale) != float(descriptor.scale)
			or float(entry.surface.strength) != float(descriptor.strength)
			or int(entry.surface.get("version", 1)) != int(descriptor.get("version", 1))
		):
			continue
		for role in ["color", "normal"]:
			var path := "res://" + str(entry[role])
			if not surface_textures.has(path):
				var image := Image.load_from_file(path)
				if image == null:
					push_error("Missing portable surface texture " + path)
					return
				image.generate_mipmaps()
				surface_textures[path] = ImageTexture.create_from_image(image)
		result.set_meta("surface_algorithm", entry.get("algorithm", "littlewild-surface-v1"))
		result.albedo_texture = surface_textures["res://" + str(entry.color)]
		result.normal_enabled = true
		result.normal_texture = surface_textures["res://" + str(entry.normal)]
		var repeat := float(descriptor.scale)
		result.uv1_scale = Vector3(repeat, repeat, 1)
		result.texture_filter = BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
		return
	push_error("Portable surface was not baked into this Godot project")


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


## Baked meshes keep Three's counter-clockwise triangles; Godot treats clockwise as front.
func baked(asset: Dictionary, id: String) -> Mesh:
	var key := str(asset.get("category", "")) + ":" + str(asset.get("id", "")) + "#" + id
	if meshes.has(key):
		return meshes[key]
	var data: Dictionary = asset.get("meshes", {}).get(id, {})
	var positions: Array = data.get("positions", [])
	var normals: Array = data.get("normals", [])
	var vertices := PackedVector3Array()
	var normal_values := PackedVector3Array()
	var uv_values := PackedVector2Array()
	var uvs: Array = data.get("uvs", [])
	for index in range(0, positions.size(), 3):
		vertices.append(Vector3(positions[index], positions[index + 1], positions[index + 2]))
		if normals.size() == positions.size():
			normal_values.append(Vector3(normals[index], normals[index + 1], normals[index + 2]))
	for index in range(vertices.size()):
		if uvs.size() == vertices.size() * 2:
			uv_values.append(Vector2(uvs[index * 2], uvs[index * 2 + 1]))
		else:
			var point := vertices[index]
			var radius := point.length()
			uv_values.append(
				Vector2(
					0.5 + atan2(point.z, point.x) / TAU,
					acos(clampf(point.y / radius, -1, 1)) / PI if radius > 0 else 0.5
				)
			)
	var source: Array = data.get("indices", range(vertices.size()))
	var indices := PackedInt32Array()
	for index in range(0, source.size() - 2, 3):
		indices.append_array([int(source[index]), int(source[index + 2]), int(source[index + 1])])
	var arrays := []
	arrays.resize(Mesh.ARRAY_MAX)
	arrays[Mesh.ARRAY_VERTEX] = vertices
	arrays[Mesh.ARRAY_INDEX] = indices
	arrays[Mesh.ARRAY_TEX_UV] = uv_values
	if normal_values.size() == vertices.size():
		arrays[Mesh.ARRAY_NORMAL] = normal_values
	var result := ArrayMesh.new()
	if not vertices.is_empty():
		result.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arrays)
		var surface := SurfaceTool.new()
		surface.create_from(result, 0)
		if normal_values.size() != vertices.size():
			surface.generate_normals()
		surface.generate_tangents()
		result = surface.commit()
	meshes[key] = result
	return result


func _roof() -> ArrayMesh:
	var points := [
		Vector3(-0.5, 0, -0.5),
		Vector3(0.5, 0, -0.5),
		Vector3(0, 0.62, -0.5),
		Vector3(-0.5, 0, 0.5),
		Vector3(0.5, 0, 0.5),
		Vector3(0, 0.62, 0.5)
	]
	var vertices := PackedVector3Array()
	for index in [0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 2, 0, 3, 2, 3, 5]:
		vertices.append(points[index])
	var surface := SurfaceTool.new()
	surface.begin(Mesh.PRIMITIVE_TRIANGLES)
	for point in vertices:
		surface.add_vertex(point)
	surface.generate_normals()
	return surface.commit()
