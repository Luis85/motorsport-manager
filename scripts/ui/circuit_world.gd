class_name CircuitWorld
extends Node2D
## Cached world-space illustration. Camera movement changes transforms, never scenery RNG.
## All generated scenery is decorative: no geometry, grip, weather or simulation writes.
const GRASS = Color("c7d5ac")
const ASPHALT = Color("69766d")
const CREAM = Color("f8f0d8")
var geometry: TrackGeometry
var document: Dictionary = {}
var detail = true
var scenery_visible = true
var road_visible = true
var pits_visible = true
var features_visible = true
var environment = "meadow"
var season = "summer"
var decorations: Array = []
var patches: Array = []
var road_index: Dictionary = {}
var build_count = 0
var draw_count = 0
var signature = ""
var reference_texture: Texture2D
var reference_visible = false
var rng = RandomNumberGenerator.new()
var road_batches: Array = []
var road_batch_geometry: TrackGeometry
var road_batch_builds = 0

func configure(g: TrackGeometry, d: Dictionary, rich: bool = true) -> void:
	geometry = g; document = d; detail = rich
	var look = d.get("visual", {})
	environment = str(look.get("environment", "woodland" if d.get("id", "") == "spa" else "meadow"))
	season = str(look.get("season", "summer"))
	var key = JSON.stringify([d.get("nodes", []), d.get("pits", []), d.get("visual", {}), rich]).sha256_text()
	if key != signature and not g.preview_only:
		signature = key; _generate(); build_count += 1
	queue_redraw()

func _generate() -> void:
	decorations.clear(); patches.clear(); road_index.clear()
	rng.seed = int(document.get("visual", {}).get("seed", 1975))
	for i in range(geometry.points.size()):
		var p = geometry.points[i]
		var cell = Vector2i(floor(p.x / 40), floor(p.y / 40))
		if not road_index.has(cell): road_index[cell] = []
		road_index[cell].append([p, geometry.widths[i] * 0.5])
	for p in geometry.pit_points:
		var cell = Vector2i(floor(p.x / 40), floor(p.y / 40))
		if not road_index.has(cell): road_index[cell] = []
		road_index[cell].append([p, 9.0])
	var area = geometry.bounds.grow(160)
	# Macro shapes deliberately use a limited palette, not high-frequency terrain noise.
	for i in range(36 if detail else 14):
		var center = Vector2(rng.randf_range(area.position.x, area.end.x), rng.randf_range(area.position.y, area.end.y))
		var radius = Vector2(rng.randf_range(55, 210), rng.randf_range(35, 125))
		patches.append({"p": center, "r": radius, "tone": i % 4, "phase": rng.randf() * TAU})
	var count = (420 if environment == "woodland" else 250) if detail else 70
	for i in range(count * 3):
		if decorations.size() >= count: break
		var p = Vector2(rng.randf_range(area.position.x, area.end.x), rng.randf_range(area.position.y, area.end.y))
		var radius = rng.randf_range(7, 16)
		if _near_road(p, radius + 9): continue
		decorations.append({"p": p, "r": radius, "variant": rng.randi_range(0, 5)})

func _near_road(p: Vector2, clearance: float) -> bool:
	var cell = Vector2i(floor(p.x / 40), floor(p.y / 40))
	for x in range(-2, 3):
		for y in range(-2, 3):
			for item in road_index.get(cell + Vector2i(x, y), []):
				if p.distance_to(item[0]) < item[1] + clearance + 4: return true
	return false

func _draw() -> void:
	draw_count += 1
	var ground = Color("d5ceb0") if season == "autumn" else GRASS
	if environment == "coastal": ground = Color("d6d5b4")
	draw_rect(Rect2(-200000, -200000, 400000, 400000), ground)
	if geometry == null: return
	if scenery_visible:
		for patch in patches:
			var palette = [Color("bfd0a1"), Color("d6ddb7"), Color("cbd8ad"), Color("b8c99b")] if season != "autumn" else [Color("c5c59c"), Color("dcd2ac"), Color("c9c698"), Color("d5c698")]
			blob(patch.p, patch.r, patch.phase, palette[patch.tone])
		# The optional coastal surround stays beyond the eastern road bounds, not through a real layout.
		if environment == "coastal":
			var b = geometry.bounds
			var shore = b.end.x + 45
			draw_rect(Rect2(shore - 20, b.position.y - 5000, 6000, b.size.y + 10000), Color("e6dabb"))
			draw_rect(Rect2(shore, b.position.y - 5000, 6000, b.size.y + 10000), Color("96bdbc"))
			for i in range(45):
				var y = b.position.y - 900 + i * 70
				draw_line(Vector2(shore + 20, y), Vector2(shore + 80 + (i % 3) * 25, y), Color("bbd5c9"), 2, true)
		for tree in decorations:
			if environment == "coastal" and tree.p.x > geometry.bounds.end.x + 25: continue
			_draw_tree(tree.p, tree.r, tree.variant)
		for obj in document.get("objects", []): _draw_prop(obj)
	if reference_visible and reference_texture and document.has("reference"):
		var ref = document.reference
		var width = float(ref.width); var height = width * reference_texture.get_height() / float(reference_texture.get_width())
		draw_set_transform(Vector2(ref.x, ref.y), 0, Vector2(1, -1))
		draw_texture_rect(reference_texture, Rect2(-width / 2, -height / 2, width, height), false, Color(1, 1, 1, ref.opacity))
		draw_set_transform(Vector2.ZERO)
	if road_visible: _draw_road()
	if features_visible:
		for feature in document.get("features", []): _draw_feature(feature)
	if pits_visible: _draw_pits()

func blob(center: Vector2, radius: Vector2, phase: float, color: Color) -> void:
	var poly = PackedVector2Array()
	for i in range(36):
		var angle = TAU * i / 36
		var ripple = 1 + 0.08 * sin(angle * 3 + phase) + 0.045 * cos(angle * 5 - phase)
		poly.append(center + Vector2(cos(angle) * radius.x, sin(angle) * radius.y) * ripple)
	draw_colored_polygon(poly, color)

func _draw_tree(p: Vector2, r: float, variant: int) -> void:
	var palette = [Color("6f9567"), Color("82a474"), Color("97ad78"), Color("668c65"), Color("b4b27a"), Color("86a782")] if season != "autumn" else [Color("b7925d"), Color("c9a364"), Color("9ca16b"), Color("a67e58"), Color("c0ae76"), Color("7b9768")]
	var color = palette[posmod(variant, palette.size())]
	draw_circle(p + Vector2(r * 0.34, -r * 0.5), r * 1.12, Color("566a4733"), true, -1, true)
	if variant % 3 == 0:
		var poly = PackedVector2Array([p + Vector2(0, r), p + Vector2(-r * 0.72, -r * 0.65), p + Vector2(r * 0.72, -r * 0.65)])
		draw_colored_polygon(poly, color.darkened(0.08))
		draw_colored_polygon(PackedVector2Array([p + Vector2(0, r), p + Vector2(-r * 0.72, -r * 0.65), p + Vector2(0, -r * 0.28)]), color.lightened(0.07))
	else:
		draw_circle(p, r, color, true, -1, true)
		draw_circle(p + Vector2(-r * 0.25, r * 0.25), r * 0.73, color.lightened(0.09), true, -1, true)
		if detail: draw_circle(p + Vector2(r * 0.15, r * 0.5), r * 0.34, color.lightened(0.16), true, -1, true)

func _draw_prop(obj: Dictionary) -> void:
	var p = Vector2(obj.get("x", 0), obj.get("y", 0))
	var r = deg_to_rad(float(obj.get("rotation", 0)))
	var s = clampf(float(obj.get("scale", 1)), 0.2, 8)
	draw_set_transform(p, r, Vector2.ONE * s)
	var type = str(obj.get("type", "tree"))
	match type:
		"tree", "woodland": _draw_tree(Vector2.ZERO, 10, 1)
		"water", "pool":
			blob(Vector2.ZERO, Vector2(25, 16), 1.1, Color("e5d8b5")); blob(Vector2.ZERO, Vector2(22, 13), 1.1, Color("94bab6"))
			draw_line(Vector2(-8, 4), Vector2(12, 4), Color("d5e0cf"), 1.2, true)
		"yacht":
			draw_colored_polygon(PackedVector2Array([Vector2(-12, -5), Vector2(8, -5), Vector2(16, 0), Vector2(8, 5), Vector2(-12, 5)]), CREAM)
			draw_rect(Rect2(-6, -3, 12, 6), Color("adbbb0"))
		"tent":
			draw_rect(Rect2(-10, -8, 24, 20), Color("526b4633"))
			draw_rect(Rect2(-12, -6, 24, 16), CREAM)
			draw_colored_polygon(PackedVector2Array([Vector2(-12, -6), Vector2(0, 5), Vector2(12, -6)]), Color("c29771"))
			draw_colored_polygon(PackedVector2Array([Vector2(-12, 10), Vector2(0, 5), Vector2(12, 10)]), Color("d5b188"))
		"grandstand":
			draw_rect(Rect2(-23, -14, 51, 29), Color("526b4644")); draw_rect(Rect2(-25, -9, 50, 27), Color("8d9b83"))
			for j in range(5):
				draw_line(Vector2(-23, -7 + j * 4), Vector2(23, -7 + j * 4), Color("dfd1ae"), 2, true)
				if detail:
					for k in range(12): draw_circle(Vector2(-21 + k * 4, -6 + j * 4), 0.8, Color("8e6c55") if (j + k) % 3 else Color("47695b"))
			draw_rect(Rect2(-26, 10, 52, 9), Color("f1e7cb"))
		"garage": _building(Vector2(34, 19), Color("8b9e86"), 5)
		"cafe": _building(Vector2(21, 16), Color("b58b6b"), 2)
		"tower": _building(Vector2(13, 14), Color("84988c"), 2)
		_: _building(Vector2(17, 13), Color("ada087"), 3)
	draw_set_transform(Vector2.ZERO)

func _building(dim: Vector2, color: Color, doors: int) -> void:
	draw_rect(Rect2(-dim * 0.5 + Vector2(4, -5), dim), Color("4c624238"))
	draw_rect(Rect2(-dim * 0.5, dim), color.darkened(0.16))
	draw_rect(Rect2(-dim * 0.5 + Vector2(0, 3), dim), CREAM)
	draw_colored_polygon(PackedVector2Array([Vector2(-dim.x / 2, 3), Vector2(0, dim.y / 2 + 3), Vector2(dim.x / 2, 3), Vector2(0, -dim.y / 2 + 3)]), color)
	for i in range(doors):
		draw_rect(Rect2(-dim.x * 0.42 + dim.x * 0.84 * i / doors, -dim.y / 2, dim.x * 0.65 / doors, 3), Color("547064"))

func prepare_road_batches() -> void:
	if road_batch_geometry == geometry: return
	road_batch_geometry = geometry; road_batches.clear(); road_batch_builds += 1
	var n = geometry.points.size()
	for pass_index in range(2):
		var extra = 2.2 if pass_index == 0 else 0.0
		var points = PackedVector2Array(); var indices = PackedInt32Array()
		for i in range(n):
			var j = (i + 1) % n
			var a = geometry.points[i]; var b = geometry.points[j]
			var ai = geometry.normals[i] * (geometry.widths[i] * 0.5 + extra)
			var bi = geometry.normals[j] * (geometry.widths[j] * 0.5 + extra)
			var offset = points.size()
			points.append_array(PackedVector2Array([a + ai, b + bi, b - bi, a - ai]))
			indices.append_array(PackedInt32Array([offset, offset + 1, offset + 2, offset, offset + 2, offset + 3]))
		road_batches.append({"points": points, "indices": indices, "colors": PackedColorArray([CREAM if pass_index == 0 else ASPHALT])})

func _draw_road() -> void:
	prepare_road_batches()
	var n = geometry.points.size()
	# Identical triangles and pass order, but two submissions instead of four per station.
	for batch in road_batches:
		RenderingServer.canvas_item_add_triangle_array(get_canvas_item(), batch.indices, batch.points, batch.colors)
	# Thin perimeter antialiasing only, never seams along internal triangle edges.
	for side in [-1, 1]:
		var edge = PackedVector2Array()
		for i in range(n): edge.append(geometry.points[i] + geometry.normals[i] * (geometry.widths[i] * 0.5 + 2.2) * side)
		edge.append(edge[0]); draw_polyline(edge, Color("eae5ce"), 0.65, true)
	for i in range(12):
		var sample = geometry.sample(-i * geometry.grid_spacing)
		var p = sample.p + sample.n * (-2 if i % 2 == 0 else 2)
		var tangent = Vector2(sample.n.y, -sample.n.x)
		draw_polyline(PackedVector2Array([p - sample.n - tangent * 4, p - sample.n, p + sample.n, p + sample.n - tangent * 4]), Color("dedfc9"), 0.5, true)
	var start = geometry.sample(0)
	var t = Vector2(start.n.y, -start.n.x)
	var count = maxi(4, int(start.w / 1.5))
	for i in range(count):
		for j in range(2):
			var p = start.p + start.n * (-start.w / 2 + start.w * i / count) + t * (j - 1) * 1.4
			draw_colored_polygon(PackedVector2Array([p, p + start.n * start.w / count, p + start.n * start.w / count + t * 1.4, p + t * 1.4]), CREAM if (i + j) % 2 else Color("354c40"))

func _draw_pits() -> void:
	if geometry.pit_points.size() < 2: return
	draw_polyline(geometry.pit_points, Color("e4d7b7"), 9, true)
	draw_polyline(geometry.pit_points, Color("8c9989"), 6, true)
	for i in range(6):
		var sample = geometry.pit_sample(geometry.pit_length * (0.30 + i * 0.055))
		var p = sample.p + sample.n * 12
		# Authored pit alignment, not invented decorative routing.
		draw_set_transform(p, sample.n.angle() - PI * 0.5)
		_building(Vector2(10, 9), Color("9eae93") if i != 3 else Color("c0a57a"), 2)
		draw_set_transform(Vector2.ZERO)

func _draw_feature(f: Dictionary) -> void:
	var kind = str(f.get("type", "curb"))
	var a = float(f.get("a", 0)); var span = fposmod(float(f.get("b", 0)) - a, 1.0)
	var count = clampi(int(ceil(span * geometry.length / 4)), 2, 1800)
	for i in range(count):
		var s = geometry.sample((a + span * i / count) * geometry.length, true)
		var t = geometry.sample((a + span * (i + 1) / count) * geometry.length, true)
		if kind in ["bridge", "tunnel"]:
			# Readable top-down treatment: deck edge/portal stripes, never hide the road/dots.
			for side in [-1, 1]: draw_line(s.p + s.n * (s.w * 0.55 + 2) * side, t.p + t.n * (t.w * 0.55 + 2) * side, Color("7c897c") if kind == "bridge" else Color("657964"), 3, true)
			if i in [0, count - 1]: draw_line(s.p - s.n * s.w * 0.65, s.p + s.n * s.w * 0.65, Color("e4d8b9"), 2.5, true)
		else:
			for side in [-1, 1]:
				if f.get("side", "both") == "left" and side == -1 or f.get("side", "both") == "right" and side == 1: continue
				var w = float(f.get("width", 1))
				var color = (Color("b98670") if i % 2 == 0 else CREAM) if kind == "curb" else (Color("aab299") if kind == "barrier" else Color("d9caa6"))
				draw_line(s.p + s.n * (s.w * 0.5 + w * 0.5) * side, t.p + t.n * (t.w * 0.5 + w * 0.5) * side, color, maxf(0.6, w), true)
