extends RefCounted
## Asset-authored appearance and rig motion over detached actor observations.

func create(factory: Object, actor: Dictionary, definitions: Array) -> Node3D:
	var asset_id := str(actor.get("archetype", "sproutling"))
	for definition in definitions:
		if str(definition.id) == str(actor.get("archetype", "")):
			asset_id = str(definition.get("visualAsset", asset_id))
	var asset: Dictionary = factory.definitions.get("actor:" + asset_id, {})
	var behavior: Dictionary = asset.get("behaviors", {})
	var appearance: Dictionary = behavior.get("appearances", {}).get(str(actor.get("personality", "")), {})
	var model := str(appearance.get("model", "world"))
	var root: Node3D = factory.create("actor", asset_id, model, appearance.get("materials", {}))
	root.scale = factory.vector(appearance.get("scale", [1, 1, 1]))
	root.set_meta("appearance_scale", root.scale)
	root.set_meta("appearance_model", model)
	root.set_meta("label_height", float(appearance.get("labelHeight", 1.3)))
	root.set_meta("asset", asset)
	var nodes: Dictionary = {}
	for ref in asset.get("rig", {}):
		var value: Variant = asset.rig[ref]
		var ids: Array = value if value is Array else [value]
		var found: Array = []
		for id in ids:
			var node := root.find_child(str(id), true, false) as Node3D
			if node != null:
				found.append(node)
				node.set_meta("base_position", node.position)
				node.set_meta("base_rotation", node.rotation)
				node.set_meta("base_scale", node.scale)
		nodes[ref] = found
	root.set_meta("rig", nodes)
	var attachments := 0
	for slot in ["head", "body", "back", "feet", "tool", "charm"]:
		var item_id := str(actor.get("equipment", {}).get(slot, ""))
		var item: Dictionary = factory.definitions.get("item:" + item_id, {})
		if not item.get("models", {}).has("equipped"):
			continue
		var socket: Variant = behavior.get("sockets", {}).get(slot, "")
		var sockets: Array = socket if socket is Array else [socket]
		for id in sockets:
			var parent := root.find_child(str(id), true, false) as Node3D
			if parent != null:
				var equipment: Node3D = factory.create("item", item_id, "equipped")
				equipment.set_meta("equipment_slot", slot)
				parent.add_child(equipment)
				attachments += 1
				if slot == "body":
					_visibility(root, "bib", false)
	root.set_meta("equipment_attachment_count", attachments)
	root.set_meta("gait", 0.0)
	root.set_meta("cargo_id", "")
	for ref in ["care", "snack", "cup", "carry"]:
		_visibility(root, ref, false)
	return root

func _rig(root: Node3D, ref: String) -> Array:
	return root.get_meta("rig", {}).get(ref, [])

func _visibility(root: Node3D, ref: String, visible: bool) -> void:
	for node in _rig(root, ref):
		node.visible = visible

func mood(root: Node3D, actor: Dictionary) -> String:
	var rule: Dictionary = root.get_meta("asset", {}).get("behaviors", {}).get("expression", {})
	var needs: Dictionary = actor.get("needs", {})
	if actor.get("task", {}) is Dictionary and actor.get("task", {}).get("kind") == "rest":
		return "rest"
	if float(actor.get("feelings", {}).get("anger", 0)) >= float(rule.get("angerAt", 45)):
		return "angry"
	if float(needs.get("energy", 100)) < float(rule.get("tiredEnergyBelow", 30)):
		return "tired"
	if float(needs.get("food", 100)) < float(rule.get("concernFoodBelow", 25)) or float(needs.get("water", 100)) < float(rule.get("concernWaterBelow", 25)):
		return "concerned"
	return "happy" if float(needs.get("joy", 60)) > float(rule.get("happyJoyAbove", 72)) else "content"

func pose(factory: Object, root: Node3D, actor: Dictionary, sim_time: float, time: float, moving: bool, working: bool, animate: bool, distance: float) -> void:
	var parameters: Dictionary = root.get_meta("asset", {}).get("behaviors", {}).get("animation", {})
	var feeling := mood(root, actor)
	root.set_meta("expression", feeling)
	var rest := feeling == "rest"
	var tired := feeling == "tired"
	var angry := feeling == "angry"
	var walking := animate and moving
	var work := animate and working
	var gait: float = float(root.get_meta("gait", 0.0)) + (minf(distance, 0.45) * 14 if walking else 0)
	root.set_meta("gait", gait)
	var seed: float = maxi(1, str(actor.get("id", "c1")).trim_prefix("c").to_int()) * 1.71
	for ref in root.get_meta("rig", {}):
		for node in _rig(root, ref):
			node.position = node.get_meta("base_position")
			node.rotation = node.get_meta("base_rotation")
			node.scale = node.get_meta("base_scale")
	for body in _rig(root, "body"):
		body.position.y += absf(sin(gait)) * float(parameters.get("bodyBob", 0)) if walking else 0
	for head in _rig(root, "head"):
		head.rotation.x += 0.19 if rest else 0.10 if tired else 0.09 if work else 0
		if animate and not walking and not work:
			head.rotation.y += sin(time * 0.53 + seed) * float(parameters.get("idleHeadYaw", 0))
			head.rotation.z += sin(time * 0.41 + seed) * float(parameters.get("idleHeadRoll", 0))
	for torso in _rig(root, "torso"):
		torso.scale.y += sin(time * 2 + seed) * float(parameters.get("breath", 0)) if animate and not rest else 0
	var ears := _rig(root, "ears")
	for index in range(ears.size()):
		ears[index].rotation.z += (1 if index else -1) * (-0.17 if angry else 0.21 if tired or rest else 0)
		ears[index].rotation.z += sin(time * 1.7 + seed + index) * float(parameters.get("earSway", 0)) if animate else 0
	var blink := animate and sin(time * 0.83 + seed) > float(parameters.get("blinkThreshold", 0.996))
	for eye in _rig(root, "eyes"):
		eye.scale.y *= 0.10 if rest or blink else 0.60 if tired else 1.0
	var brows := _rig(root, "brows")
	for index in range(brows.size()):
		brows[index].rotation.z = (1 if index else -1) * (0.30 if angry else -0.23 if feeling == "concerned" else -0.13 if tired else -0.04)
	for mouth in _rig(root, "mouth"):
		var children: Array = mouth.get_children()
		for index in range(children.size()):
			children[index].rotation.z = (1 if index else -1) * (0.40 if feeling == "happy" else -0.25 if angry or tired else 0.15)
	for tail in _rig(root, "tail"):
		tail.rotation.y += sin(time * (4 if walking else 1.9) + seed) * float(parameters.get("tailSway", 0)) if animate else 0
	var feet := _rig(root, "feet")
	var sockets: Array = root.get_meta("asset", {}).get("behaviors", {}).get("sockets", {}).get("feet", [])
	for index in range(feet.size()):
		feet[index].position.y += maxf(0, sin(gait + index * PI)) * float(parameters.get("footLift", 0)) if walking else 0
		feet[index].position.z += sin(gait + index * PI) * float(parameters.get("footStride", 0)) if walking else 0
		if index < sockets.size():
			var socket := root.find_child(str(sockets[index]), true, false) as Node3D
			if socket != null:
				socket.position = feet[index].position
	var arms := _rig(root, "arms")
	for index in range(arms.size()):
		arms[index].rotation.x = float(parameters.get("workArmBase", 0)) + sin(time * 5.6 + index) * float(parameters.get("workArmSwing", 0)) if work else sin(gait + index * PI) * float(parameters.get("walkArmSwing", 0)) if walking else 0
	_cargo(factory, root, actor, moving, rest)
	var care: Variant = actor.get("careVisual")
	var elapsed: float = sim_time - float(care.get("time", -1000)) if care is Dictionary else 1000.0
	var kind := str(care.get("kind", "")) if care is Dictionary and elapsed >= 0 and elapsed < 2 else ""
	var feeding := kind in ["feed", "water"] and not moving
	_visibility(root, "care", feeding)
	_visibility(root, "snack", kind == "feed")
	_visibility(root, "cup", kind == "water")
	if feeding:
		for arm in arms:
			arm.rotation.x = -1.15
		_visibility(root, "carry", false)
		_tool(root, false)
		for head in _rig(root, "head"):
			head.rotation.x = 0.12 + (sin(elapsed * 6) * 0.035 if animate else 0)
	elif kind in ["bond", "praise", "soothe"] and not moving and animate and not arms.is_empty():
		arms[0].rotation.x = -0.8
		arms[0].rotation.z = -0.16 + sin(elapsed * 6) * 0.12

func _tool(root: Node3D, visible: bool) -> void:
	var socket_id := str(root.get_meta("asset", {}).get("behaviors", {}).get("sockets", {}).get("tool", ""))
	var socket := root.find_child(socket_id, true, false) as Node3D
	if socket != null:
		socket.visible = visible

func _cargo(factory: Object, root: Node3D, actor: Dictionary, moving: bool, rest: bool) -> void:
	var task: Dictionary = actor.get("task", {}) if actor.get("task") is Dictionary else {}
	var inventory: Dictionary = actor.get("inventory", {})
	var main := str(task.get("resource", task.get("item", task.get("res", ""))))
	if float(inventory.get(main, 0)) <= 0 or not factory.definitions.get("item:" + main, {}).get("models", {}).has("carry"):
		main = ""
		var largest := 0.0
		for id in inventory:
			if float(inventory[id]) > largest and factory.definitions.get("item:" + str(id), {}).get("models", {}).has("carry"):
				main = str(id)
				largest = float(inventory[id])
	var carry := _rig(root, "carry")
	if not carry.is_empty() and str(root.get_meta("cargo_id", "")) != main:
		for child in carry[0].get_children():
			child.free()
		if not main.is_empty():
			carry[0].add_child(factory.create("item", main, "carry"))
		root.set_meta("cargo_id", main)
	var hauling := not main.is_empty() and (moving or str(task.get("kind", "")) in ["deposit", "withdraw", "stockbuilding", "collectbuilding", "market-deliver", "market-pickup"]) and not rest
	_visibility(root, "carry", hauling)
	_tool(root, not hauling)
	if hauling:
		for arm in _rig(root, "arms"):
			arm.rotation.x = -0.85

func onsite(state: Dictionary, actor: Dictionary) -> bool:
	var quest: Variant = actor.get("activeQuest")
	if not quest is Dictionary:
		return true
	var workflow: Dictionary = state.get("scenarioWorkflow", {})
	for deal in workflow.get("deals", []):
		if deal.get("questId") != quest.get("questId") or not deal.get("venueBuildingId"):
			continue
		for role in workflow.get("roles", []):
			if role.get("id") == deal.get("salesRole") and role.get("actorId") == actor.get("id"):
				return true
	return false
