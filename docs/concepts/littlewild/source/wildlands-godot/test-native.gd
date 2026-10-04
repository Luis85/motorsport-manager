extends SceneTree
## Run inside a generated project: actual native shell and subprocess, no fake engine.
var shell: Control
var stage := 0
var began := Time.get_ticks_msec()
var actor_id := ""
var observed: Dictionary = {}
var saved_story: Dictionary = {}
var away_batches := 0
var world_zoom_before_room := 0.0
var world_yaw_before_room := 0.0

func _initialize() -> void:
	shell = load("res://main.tscn").instantiate()
	root.add_child(shell)
	shell.bridge.response.connect(_on_response)
	shell.bridge.rejected.connect(_fail)

func _process(_delta: float) -> bool:
	if Time.get_ticks_msec() - began > 20000:
		_fail("Native runtime verification timed out.")
	return false

func _fail(message: String) -> void:
	push_error(message)
	quit(1)

func _check(condition: bool, message: String) -> bool:
	if not condition:
		_fail(message)
	return condition

func _on_response(method: String, result: Variant) -> void:
	if method == "inspect" and stage == 0:
		stage = 1
		await process_frame
		if not _check(result.snapshot.actors.size() > 0 and shell.world.actors.size() == result.snapshot.actors.size(), "Native actor reconstruction differs from the authoritative snapshot."):
			return
		if not _check(shell.world.static_root.get_child_count() > 300, "Canonical terrain and resources were not instantiated."):
			return
		actor_id = str(result.snapshot.actors[0].id)
		observed.actors = shell.world.actors.size()
		observed.staticNodes = shell.world.static_root.get_child_count()
		observed.inspectionBytes = JSON.stringify(result).to_utf8_buffer().size()
		shell.bridge.request("start")
		shell.bridge.request("step", {"count": 10})
	elif method == "step" and stage == 1:
		if not _check(is_equal_approx(float(result.view.snapshot.simTime), 1.0), "Explicit native clock failed to advance exactly ten fixed steps."):
			return
		stage = 2
		shell.bridge.request("command", {"command": {"id": "care", "actorId": actor_id, "args": ["bond"]}})
	elif method == "command" and stage == 2:
		if not _check(result.ok, "Native command was rejected: " + JSON.stringify(result)):
			return
		stage = 3
		shell.bridge.request("story")
	elif method == "story" and stage == 3:
		saved_story = result
		stage = 4
		shell.bridge.request("session.openStory", {"story": saved_story})
	elif method == "session.openStory" and stage == 4:
		if not _check(is_equal_approx(float(result.snapshot.simTime), 1.0), "Native story restoration changed simulation time."):
			return
		stage = 5
		shell.bridge.request("story")
	elif method == "story" and stage == 5:
		if not _check(result == saved_story, "Native subprocess story continuation was not lossless."):
			return
		# A completed visual-only timeline restores the canonical actor transform.
		var actor: Node3D = shell.world.actors[actor_id]
		shell.world.apply_timeline({"poses": [{"target": {"category": "creatures", "id": actor_id}, "values": {"opacity": 0, "rotation": 2}}], "camera": {"zoom": 2}})
		if not _check(not actor.visible, "Native timeline opacity sample was not applied."):
			return
		shell.world.clear_timeline()
		if not _check(actor.visible, "Stopping the native timeline left the actor hidden."):
			return
		# A stale asynchronous sample after stop must not reinstate the cutscene.
		shell.playback_generation = 2
		shell.sample_generation = 1
		shell._response("storytelling.sample", {"poses": [{"target": {"category": "creatures", "id": actor_id}, "values": {"opacity": 0}}]})
		if not _check(actor.visible, "A stale timeline response modified the restored native view."):
			return
		observed.simTime = 1.0
		observed.commandAccepted = true
		observed.losslessStoryRestore = true
		observed.timelineRestore = true
		stage = 6
		var project: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://wildlands.project.json"))
		shell.bridge.request("session.create", {"pack": project.pack, "sceneId": "charted-home"})
	elif method == "session.create" and stage == 6:
		stage = 7
		await process_frame
		if not _check(shell.world.actors.size() == 3, "Charted Home did not reconstruct all three companions."):
			return
		var expected := {"c1": "world-round", "c2": "world-long", "c3": "world-pointed"}
		for id in expected:
			if not _check(shell.world.actors[id].get_meta("appearance_model") == expected[id], "Native personality appearance differs for " + id):
				return
		if not _check(int(shell.world.actors["c1"].get_meta("equipment_attachment_count")) == 7, "Pip's six equipment slots were not attached at all seven canonical sockets."):
			return
		if not _check(shell.guide.steps.size() == 11, "The authored Littlewild guide was not included."):
			return
		observed.chartedActors = 3
		observed.personalityVariants = true
		observed.equipmentAttachments = 7
		observed.guideSteps = 11
		var slots := {"head": ["item:trail_cap"], "body": ["item:rain_cape"], "back": ["item:field_satchel"], "feet": ["item:walking_boots", "item:walking_boots"], "tool": ["item:walking_staff"], "charm": ["item:friendship_charm"]}
		var actual: Dictionary = {}
		for node in shell.world.actors["c1"].find_children("*", "", true, false):
			if node.has_meta("equipment_slot"):
				var slot := str(node.get_meta("equipment_slot"))
				if not actual.has(slot):
					actual[slot] = []
				actual[slot].append(node.get_meta("asset_id"))
		if not _check(actual == slots, "Actual equipped item instances differ from all six canonical slots."):
			return
		for id in {"c1": "#caa273", "c2": "#a4ba99", "c3": "#e0cbb0"}:
			var torso: MeshInstance3D = shell.world.actors[id].get_meta("rig").torso[0]
			var expected_color := Color({"c1": "#caa273", "c2": "#a4ba99", "c3": "#e0cbb0"}[id])
			if not _check(torso.material_override.albedo_color == expected_color, "Native personality fur material differs for " + id):
				return
		shell.bridge.request("story")
	elif method == "story" and stage == 7:
		saved_story = result
		stage = 8
		world_zoom_before_room = shell.world.zoom
		world_yaw_before_room = shell.world.yaw
		shell.floors.open("b2")
	elif method == "query" and stage == 8 and result is Dictionary and result.get("buildingId") == "b2":
		stage = 9
		await process_frame
		if not _check(shell.floors.room.floors.size() == 2 and shell.world.room_floor == "ground", "The native floor inspector did not open the actual two-floor workbench."):
			return
		shell.floors.floors.select(1)
		shell.floors.floors.item_selected.emit(1)
		if not _check(shell.world.room_floor == "upper", "Native floor selection did not change the observed floor."):
			return
		observed.inspectedFloors = 2
		shell.guide.picker.select(6)
		shell.guide._select(6)
		var stale_room: Dictionary = shell.floors.room.duplicate(true)
		shell.floors.pending_request = 999999
		shell.floors.querying = true
		if not _check(not shell.floors.consume(stale_room, 999998) and shell.floors.pending_request == 999999, "A stale interior response consumed the current request."):
			return
		shell.floors._rejected(999999, "native retry check")
		if not _check(not shell.floors.querying, "A rejected floor query blocked retry."):
			return
		shell.floors.feedback.text = ""
		var capture := OS.get_environment("WILDLANDS_CAPTURE_NATIVE")
		if not capture.is_empty():
			await _capture(capture.get_basename() + "-floors.png")
		shell.bridge.request("story")
	elif method == "story" and stage == 9:
		if not _check(result == saved_story, "Observing floors or guidance changed authoritative state or advanced the clock."):
			return
		stage = 10
		shell.floors.visit.pressed.emit()
	elif method == "command" and stage == 10:
		if not _check(result.ok, "Native companion floor visit was rejected."):
			return
		stage = 11
		shell.floors._choose_floor(0)
		for index in range(shell.floors.recipes.item_count):
			if str(shell.floors.recipes.get_item_metadata(index)) == "rope":
				shell.floors.recipes.select(index)
		shell.floors.production.pressed.emit()
	elif method == "command" and stage == 11:
		if not _check(result.ok, "Native floor production order was rejected."):
			return
		stage = 12
		shell.bridge.request("query", {"name": "buildingInterior", "args": ["b2"]})
	elif method == "query" and stage == 12 and result is Dictionary and result.get("buildingId") == "b2":
		stage = 13
		await process_frame
		var rope: Array = result.recipes.filter(func(recipe): return str(recipe.id) == "rope")
		if not _check(not rope.is_empty() and int(rope[0].queued) == 3, "Native floor order did not update the canonical workbench queue."):
			return
		shell.floors.close()
		if not _check(is_equal_approx(shell.world.zoom, world_zoom_before_room) and is_equal_approx(shell.world.yaw, world_yaw_before_room), "Leaving the inspected floor did not restore the map camera."):
			return
		observed.floorObservationReadOnly = true
		observed.floorVisitAccepted = true
		observed.floorProductionQueued = true
		observed.correlatedFloorReplies = true
		var project: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://wildlands.project.json"))
		shell.bridge.request("session.create", {"pack": project.pack, "sceneId": "charted-home"})
	elif method == "session.create" and stage == 13:
		stage = 14
		shell.bridge.request("start")
		shell.bridge.request("step", {"count": 1200})
	elif method == "step" and stage == 14:
		var offers: Array = result.view.state.colony.board.offers.filter(func(offer): return str(offer.questId) == "meadow")
		if not _check(not offers.is_empty(), "The actual bounded quest preparation produced no Meadow offer."):
			return
		stage = 15
		shell.bridge.request("command", {"command": {"id": "accept-quest", "actorId": "c1", "args": [offers[0].id]}})
	elif method == "command" and stage == 15:
		if not _check(result.ok, "The actual Meadow quest command was rejected."):
			return
		stage = 16
		shell.bridge.request("step", {"count": 100})
	elif method == "step" and stage == 16:
		await process_frame
		var pip: Array = result.view.state.colony.creatures.filter(func(actor): return str(actor.id) == "c1")
		if not pip.is_empty() and pip[0].activeQuest == null and away_batches < 6:
			away_batches += 1
			shell.bridge.request("step", {"count": 100})
			return
		if not _check(not pip.is_empty() and pip[0].activeQuest != null, "The accepted real quest did not depart after the bounded preparation."):
			return
		stage = 17
		if not _check(not shell.world.actors.has("c1") or not shell.world.actors["c1"].visible, "A genuinely away companion remained visible in the native glade."):
			return
		observed.actualAwayQuest = true
		observed.questPreparationSteps = 1300 + away_batches * 100
		var project: Dictionary = JSON.parse_string(FileAccess.get_file_as_string("res://wildlands.project.json"))
		shell.bridge.request("session.create", {"pack": project.pack, "sceneId": "charted-home"})
	elif method == "session.create" and stage == 17:
		stage = 18
		await process_frame
		if not _check(is_equal_approx(shell.world.zoom, 29.0), "The fresh scene retained the previous room camera."):
			return
		observed.floorCameraRestored = true
		var capture := OS.get_environment("WILDLANDS_CAPTURE_NATIVE")
		if not capture.is_empty():
			await _capture(capture)
			observed.screenshot = capture
		print("WILDLANDS_NATIVE_PASS " + JSON.stringify(observed))
		shell.queue_free()
		await process_frame
		await process_frame
		quit(0)

func _capture(path: String) -> void:
	await RenderingServer.frame_post_draw
	var error := root.get_texture().get_image().save_png(path)
	_check(error == OK, "Cannot save actual native viewport screenshot: " + error_string(error))
