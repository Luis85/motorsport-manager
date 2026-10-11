extends RefCounted
## Native appearance conformance uses the existing test owner and exact assertions.
const Assets = preload("res://native/assets.gd")


static func inspect(host: Object, _result: Variant) -> void:
	if not _materials(host) or not _caches(host) or not _finish(host):
		return
	host.stage = 7
	await host.process_frame
	if not host._check(
		host.shell.world.actors.size() == 3,
		"Charted Home did not reconstruct all three companions."
	):
		return
	var expected := {"c1": "world-round", "c2": "world-long", "c3": "world-pointed"}
	for id in expected:
		if not host._check(
			host.shell.world.actors[id].get_meta("appearance_model") == expected[id],
			"Native personality appearance differs for " + id
		):
			return
	if not host._check(
		int(host.shell.world.actors["c1"].get_meta("equipment_attachment_count")) == 7,
		"Pip's six equipment slots were not attached at all seven canonical sockets."
	):
		return
	if not host._check(
		host.shell.guide.steps.size() == 11, "The authored Littlewild guide was not included."
	):
		return
	host.observed.chartedActors = 3
	host.observed.personalityVariants = true
	host.observed.equipmentAttachments = 7
	host.observed.guideSteps = 11
	var slots := {
		"head": ["item:trail_cap"],
		"body": ["item:rain_cape"],
		"back": ["item:field_satchel"],
		"feet": ["item:walking_boots", "item:walking_boots"],
		"tool": ["item:walking_staff"],
		"charm": ["item:friendship_charm"]
	}
	var actual: Dictionary = {}
	for node in host.shell.world.actors["c1"].find_children("*", "", true, false):
		if node.has_meta("equipment_slot"):
			var slot := str(node.get_meta("equipment_slot"))
			if not actual.has(slot):
				actual[slot] = []
			actual[slot].append(node.get_meta("asset_id"))
	if not host._check(
		actual == slots, "Actual equipped item instances differ from all six canonical slots."
	):
		return
	for id in {"c1": "#caa273", "c2": "#a4ba99", "c3": "#e0cbb0"}:
		var torso: MeshInstance3D = host.shell.world.actors[id].get_meta("rig").torso[0]
		var expected_color := Color({"c1": "#caa273", "c2": "#a4ba99", "c3": "#e0cbb0"}[id])
		if not host._check(
			torso.material_override.albedo_color == expected_color,
			"Native personality fur material differs for " + id
		):
			return
	host.shell.bridge.request("story")


static func _materials(host: Object) -> bool:
	var assets = Assets.new()
	var surface := {
		"color": "#112233",
		"sheen": 0.8,
		"sheenColor": "#ffeedd",
		"sheenRoughness": 0.6,
		"clearcoat": 0.5,
		"clearcoatRoughness": 0.2,
		"surface": {"kind": "fur", "seed": 17, "scale": 7, "strength": 0.24}
	}
	var material: StandardMaterial3D = assets.material(
		{"materials": {"skin": surface}}, {"material": "skin"}, {"skin": "#abcdef"}
	)
	var fine_surface: Dictionary = surface.duplicate(true)
	fine_surface.surface.version = 2
	var fine: StandardMaterial3D = assets.material(
		{"materials": {"skin": fine_surface}}, {"material": "skin"}
	)
	return host._check(
		(
			fine.get_meta("surface_algorithm") == "littlewild-surface-v2"
			and material.get_meta("surface_algorithm") == "littlewild-surface-v1"
			and fine.normal_texture != material.normal_texture
			and material.normal_enabled
			and material.normal_texture != null
			and material.albedo_texture != null
			and material.normal_texture.get_width() == 128
			and is_equal_approx(material.uv1_scale.x, 7)
			and material.clearcoat_enabled
			and is_equal_approx(material.clearcoat, 0.5)
			and is_equal_approx(material.clearcoat_roughness, 0.2)
			and material.rim_enabled
			and is_equal_approx(material.rim, 0.064)
			and is_equal_approx(material.rim_tint, 1.0)
			and material.albedo_color.to_html(false) == "abcdef"
			and material.get_meta("authored_surface").sheenColor == "#ffeedd"
			and material.has_meta("surface_limitation")
		),
		"Native physical material mapping or explicit sheen limitation was lost."
	)


static func _caches(host: Object) -> bool:
	var assets = Assets.new()
	var records := [
		{"category": "creature", "id": "cache-fixture", "materials": {"skin": "#123456"}}
	]
	assets.install(records)
	var mesh: Mesh = assets.primitive("box")
	var material: Material = assets.material(records[0], {"material": "skin"})
	assets.install(records.duplicate(true))
	if not host._check(
		(
			assets.primitive("box") == mesh
			and assets.material(records[0], {"material": "skin"}) == material
		),
		"Unchanged native asset catalogs discarded shared mesh/material resources."
	):
		return false
	records[0].materials.skin = "#abcdef"
	if not host._check(
		assets.definitions["creature:cache-fixture"].materials.skin == "#123456",
		"Native retained catalog changed through its caller-owned input."
	):
		return false
	assets.install(records)
	return host._check(
		(
			assets.primitive("box") != mesh
			and assets.material(records[0], {"material": "skin"}) != material
		),
		"Changed native asset catalogs retained stale mesh/material resources."
	)


static func _finish(host: Object) -> bool:
	var assets = Assets.new()
	var descriptor := {
		"version": 1,
		"kind": "painted-metal",
		"seed": 173,
		"scale": 4,
		"wear": 0.35,
		"palette": ["#40563a", "#a9a076"]
	}
	var properties := {"color": "#abcdef", "roughness": 0.7, "metalness": 0.8, "finish": descriptor}
	var record := {"material": "armor"}
	var asset := {"materials": {"armor": properties}}
	var material: StandardMaterial3D = assets.material(asset, record)
	var tinted: StandardMaterial3D = assets.material(asset, record, {"armor": "#112233"})
	var alternate: Dictionary = properties.duplicate(true)
	alternate.finish.palette = ["#704436", "#c9b088"]
	var changed: StandardMaterial3D = assets.material({"materials": {"armor": alternate}}, record)
	if not host._check(
		(
			material.get_meta("finish_algorithm") == "forge-finish-v1"
			and material.get_meta("authored_surface").finish == descriptor
			and material.albedo_texture != null
			and material.normal_enabled
			and material.normal_texture != null
			and material.roughness_texture != null
			and material.roughness_texture == material.metallic_texture
			and material.roughness_texture_channel == BaseMaterial3D.TEXTURE_CHANNEL_GREEN
			and material.metallic_texture_channel == BaseMaterial3D.TEXTURE_CHANNEL_BLUE
			and material.texture_filter == BaseMaterial3D.TEXTURE_FILTER_LINEAR_WITH_MIPMAPS
			and material.texture_repeat
			and material.uv1_scale == Vector3(4, 4, 1)
			and is_equal_approx(material.roughness, 0.7)
			and is_equal_approx(material.metallic, 0.8)
			and material.albedo_color.to_html(false) == "abcdef"
			and tinted.albedo_color.to_html(false) == "112233"
			and tinted.albedo_texture == material.albedo_texture
			and tinted.normal_texture == material.normal_texture
			and tinted.roughness_texture == material.roughness_texture
			and changed.albedo_texture != material.albedo_texture
		),
		"Native finish roles, recipe identity, scalar multipliers or shared texture cache differ."
	):
		return false
	var expected: Dictionary = JSON.parse_string(
		FileAccess.get_file_as_string("res://native-finish-pixels.json")
	)
	var textures := {
		"color": material.albedo_texture,
		"normal": material.normal_texture,
		"orm": material.roughness_texture
	}
	for role in textures:
		var image: Image = textures[role].get_image()
		var offset := (29 * 128 + 17) * 4
		if not host._check(
			(
				image.get_width() == 128
				and image.get_height() == 128
				and image.has_mipmaps()
				and image.get_data().slice(offset, offset + 4) == PackedByteArray(expected[role])
			),
			"Native finish image bytes differ from the portable generator for " + role
		):
			return false
	if not _default_finish(host):
		return false
	host.observed.nativeFinish = {
		"algorithm": "forge-finish-v1",
		"roles": 3,
		"channels": "roughness:G,metallic:B",
		"paletteIdentity": true,
		"defaultPaletteIdentity": true
	}
	return true


static func _default_finish(host: Object) -> bool:
	var omitted := {"version": 1, "kind": "painted-metal", "seed": 271, "scale": 2, "wear": 0.2}
	var explicit: Dictionary = omitted.duplicate(true)
	explicit.palette = ["#ffffff"]
	# Both compiler traversal orders must resolve both spellings to the same maps.
	for index_path in ["res://finishes/index.json", "res://native-finish-reversed-index.json"]:
		var assets = Assets.new()
		assets.finish_entries = JSON.parse_string(FileAccess.get_file_as_string(index_path))
		var first: StandardMaterial3D = assets.material(
			{"materials": {"paint": {"color": "#ffffff", "finish": omitted}}}, {"material": "paint"}
		)
		var second: StandardMaterial3D = assets.material(
			{"materials": {"paint": {"color": "#eeeeee", "finish": explicit}}},
			{"material": "paint"}
		)
		if not host._check(
			(
				first.albedo_texture != null
				and first.normal_texture != null
				and first.roughness_texture != null
				and first.albedo_texture == second.albedo_texture
				and first.normal_texture == second.normal_texture
				and first.roughness_texture == second.roughness_texture
				and first.metallic_texture == second.metallic_texture
				and first.get_meta("finish_algorithm") == "forge-finish-v1"
				and second.get_meta("finish_algorithm") == "forge-finish-v1"
				and not first.get_meta("authored_surface").finish.has("palette")
				and second.get_meta("authored_surface").finish.palette == ["#ffffff"]
			),
			"Native omitted and explicit default palettes did not share baked texture identity."
		):
			return false
	return true
