extends RefCounted
## Native appearance conformance uses the existing test owner and exact assertions.
const Assets = preload("res://native/assets.gd")


static func inspect(host: Object, _result: Variant) -> void:
	if not _materials(host) or not _caches(host):
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
	return host._check(
		(
			material.normal_enabled
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
