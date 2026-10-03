class_name TrackEdit
extends RefCounted


## Transactional authoring operations. Rejected operations return no modified document.
static func indices(d: Dictionary, kind: String, selected: Array) -> Array[int]:
	var result: Array[int] = []
	var items: Array = d.nodes if kind == "road" else d.objects
	for value in selected:
		if value is int and value >= 0 and value < items.size() and value not in result:
			result.append(value)
	result.sort()
	return result


static func pivot(d: Dictionary, kind: String, selected: Array) -> Vector2:
	var items: Array = d.nodes if kind == "road" else d.objects
	var ids = indices(d, kind, selected)
	var sum = Vector2.ZERO
	for index in ids:
		sum += TrackDocument.point(items[index])
	return sum / maxf(1, ids.size())


static func transform(
	d: Dictionary,
	kind: String,
	selected: Array,
	delta: Vector2,
	degrees: float = 0.0,
	factor: float = 1.0
) -> Dictionary:
	var ids = indices(d, kind, selected)
	if ids.is_empty():
		return failure("Select at least one item first.")
	if (
		not is_finite(degrees)
		or not is_finite(factor)
		or factor <= 0
		or factor > 100
		or not delta.is_finite()
	):
		return failure("Invalid transform.")
	var copy = d.duplicate(true)
	var items: Array = copy.nodes if kind == "road" else copy.objects
	var origin = pivot(d, kind, ids)
	for index in ids:
		var item = items[index]
		var p = (
			origin
			+ (TrackDocument.point(item) - origin).rotated(deg_to_rad(degrees)) * factor
			+ delta
		)
		if absf(p.x) > 100000 or absf(p.y) > 100000:
			return failure("Transform would exceed the authoring bounds.")
		item.x = p.x
		item.y = p.y
		if kind == "road":
			for key in ["in", "out"]:
				var handle = TrackDocument.handle(item, key).rotated(deg_to_rad(degrees)) * factor
				if absf(handle.x) > 10000 or absf(handle.y) > 10000:
					return failure("Transform would exceed handle bounds.")
				item[key] = {"x": handle.x, "y": handle.y}
		else:
			var scale = item.get("scale", 1.0) * factor
			if scale < 0.2 or scale > 8:
				return failure("Scenery scale must remain between 0.2× and 8×.")
			item.scale = scale
			item.rotation = fposmod(item.get("rotation", 0.0) + degrees + 180, 360) - 180
	return {"ok": true, "document": copy, "selection": ids}


static func arrange(
	d: Dictionary, kind: String, selected: Array, axis: String, distribute: bool = false
) -> Dictionary:
	var ids = indices(d, kind, selected)
	if axis not in ["x", "y"] or ids.size() < (3 if distribute else 2):
		return failure("Select two items to align or three to distribute.")
	var copy = d.duplicate(true)
	var items: Array = copy.nodes if kind == "road" else copy.objects
	ids.sort_custom(func(a, b): return items[a][axis] < items[b][axis])
	var low: float = items[ids[0]][axis]
	var high: float = items[ids.back()][axis]
	for i in range(ids.size()):
		items[ids[i]][axis] = (
			lerpf(low, high, float(i) / (ids.size() - 1)) if distribute else (low + high) * 0.5
		)
	return {"ok": true, "document": copy, "selection": ids}


static func duplicate_scenery(d: Dictionary, selected: Array) -> Dictionary:
	var ids = indices(d, "scenery", selected)
	if ids.is_empty() or d.objects.size() + ids.size() > 2000:
		return failure("Select scenery; the document supports up to 2,000 objects.")
	var copy = d.duplicate(true)
	var added: Array[int] = []
	var groups = {}
	for index in ids:
		var item: Dictionary = d.objects[index].duplicate(true)
		item.x += 15
		item.y -= 15
		if absf(item.x) > 100000 or absf(item.y) > 100000:
			return failure("Duplicate would exceed authoring bounds.")
		item.erase("id")
		if not str(item.get("group", "")).is_empty():
			var old = item.group
			if not groups.has(old):
				groups[old] = fresh_group(copy, groups.size())
			item.group = groups[old]
		added.append(copy.objects.size())
		copy.objects.append(item)
	return {"ok": true, "document": copy, "selection": added}


static func fresh_group(d: Dictionary, offset: int = 0) -> String:
	var id = d.objects.size() + offset
	var used: Array = d.objects.map(func(item): return str(item.get("group", "")))
	while "group-%d" % id in used:
		id += 1
	return "group-%d" % id


static func group(d: Dictionary, selected: Array, remove: bool = false) -> Dictionary:
	var ids = indices(d, "scenery", selected)
	if ids.size() < (1 if remove else 2):
		return failure("Select at least two scenery objects to group.")
	var copy = d.duplicate(true)
	var name = fresh_group(copy)
	for index in ids:
		if remove:
			copy.objects[index].erase("group")
		else:
			copy.objects[index].group = name
	return {"ok": true, "document": copy, "selection": ids}


static func failure(message: String) -> Dictionary:
	return {"ok": false, "error": message}


## Exact position-only moves preserve handles, rotation and unrelated records.
## Validate all targets before returning a detached changed document.
static func move_positions(d: Dictionary, kind: String, positions: Dictionary) -> Dictionary:
	if kind not in ["road", "scenery", "pits"] or positions.is_empty():
		return failure("Select at least one movable item.")
	if kind == "pits" and d.pits.is_empty():
		return failure("No pit lane is available.")
	var source: Array = (
		d.nodes if kind == "road" else (d.objects if kind == "scenery" else d.pits[0].nodes)
	)
	for index in positions:
		if not index is int or index < 0 or index >= source.size():
			return failure("A move target no longer exists.")
		var p = positions[index]
		if not p is Vector2 or not p.is_finite() or absf(p.x) > 100000 or absf(p.y) > 100000:
			return failure("Move would exceed the authoring bounds.")
	var copy = d.duplicate(true)
	var items: Array = (
		copy.nodes
		if kind == "road"
		else (copy.objects if kind == "scenery" else copy.pits[0].nodes)
	)
	for index in positions:
		items[index].x = positions[index].x
		items[index].y = positions[index].y
	return {"ok": true, "document": copy}


static func move_handle(d: Dictionary, index: int, key: String, position: Vector2) -> Dictionary:
	if index < 0 or index >= d.nodes.size() or key not in ["in", "out"] or not position.is_finite():
		return failure("A handle target is invalid.")
	var relative = position - TrackDocument.point(d.nodes[index])
	if absf(relative.x) > 10000 or absf(relative.y) > 10000:
		return failure("Move would exceed handle bounds.")
	var copy = d.duplicate(true)
	TrackDocument.set_handle(copy.nodes[index], key, relative)
	return {"ok": true, "document": copy}


static func move_reference(d: Dictionary, delta: Vector2) -> Dictionary:
	if not d.has("reference") or not delta.is_finite():
		return failure("No movable reference is available.")
	var position = TrackDocument.point(d.reference) + delta
	if absf(position.x) > 100000 or absf(position.y) > 100000:
		return failure("Move would exceed the authoring bounds.")
	var copy = d.duplicate(true)
	copy.reference.x = position.x
	copy.reference.y = position.y
	return {"ok": true, "document": copy}
