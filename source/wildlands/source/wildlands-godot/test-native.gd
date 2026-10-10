extends SceneTree
## Run inside a generated project: actual native shell and subprocess, no fake engine.
const AppearanceChecks = preload("res://test-native-appearance.gd")
const VALID_STORY_PATH := "user://native-import-valid.story.json"
const DUPLICATE_STORY_PATH := "user://native-import-duplicate.story.json"
var shell: Control
var stage := 0
var began := Time.get_ticks_msec()
var actor_id := ""
var observed: Dictionary = {}
var saved_story: Dictionary = {}
var saved_story_text := ""
var away_batches := 0
var world_zoom_before_room := 0.0
var world_yaw_before_room := 0.0
var duplicate_import_checked := false
var duplicate_import_request := -1


func _initialize() -> void:
	shell = load("res://main.tscn").instantiate()
	root.add_child(shell)
	shell.bridge.response.connect(_on_response)
	shell.bridge.rejected.connect(_on_rejected)


func _process(_delta: float) -> bool:
	# Full authored catalogs plus exact text restoration take about 27s locally.
	if Time.get_ticks_msec() - began > 40000:
		_fail("Native runtime verification timed out at stage %d." % stage)
	return false


func _fail(message: String) -> void:
	push_error(message)
	quit(1)


func _check(condition: bool, message: String) -> bool:
	if not condition:
		_fail(message)
	return condition


func _on_rejected(message: String) -> void:
	if (
		stage != 50
		or shell.bridge.last_response_id != duplicate_import_request
		or not message.contains("Duplicate JSON property")
	):
		_fail(message)
		return
	stage = 51
	shell.bridge.request("story")


func _story_file(path: String, text: String) -> bool:
	var file := FileAccess.open(path, FileAccess.WRITE)
	if not _check(file != null, "Cannot write native story-import fixture."):
		return false
	file.store_string(text)
	file.close()
	return true


func _on_response(method: String, result: Variant) -> void:
	match stage:
		0, 1, 2, 3, 4:
			await _bootstrap_response(method, result)
		5, 50, 51, 52:
			await _restore_response(method, result)
		6, 7:
			await _appearance_response(method, result)
		8, 9:
			await _floor_observation_response(method, result)
		10, 11, 12:
			await _floor_order_response(method, result)
		13, 14, 15:
			_quest_offer_response(method, result)
		16, 17:
			await _quest_departure_response(method, result)


func _bootstrap_response(method: String, result: Variant) -> void:
	match [method, stage]:
		["inspect", 0]:
			stage = 1
			await process_frame
			if not _check(
				(
					result.snapshot.actors.size() > 0
					and shell.world.actors.size() == result.snapshot.actors.size()
				),
				"Native actor reconstruction differs from the authoritative snapshot."
			):
				return
			if not _check(
				shell.world.static_root.get_child_count() > 300,
				"Canonical terrain and resources were not instantiated."
			):
				return
			actor_id = str(result.snapshot.actors[0].id)
			observed.actors = shell.world.actors.size()
			observed.staticNodes = shell.world.static_root.get_child_count()
			observed.inspectionBytes = JSON.stringify(result).to_utf8_buffer().size()
			shell.bridge.request("start")
			shell.bridge.request("step", {"count": 10})
		["step", 1]:
			if not _check(
				is_equal_approx(float(result.view.snapshot.simTime), 1.0),
				"Explicit native clock failed to advance exactly ten fixed steps."
			):
				return
			stage = 2
			shell.bridge.request(
				"command", {"command": {"id": "care", "actorId": actor_id, "args": ["bond"]}}
			)
		["command", 2]:
			if not _check(result.ok, "Native command was rejected: " + JSON.stringify(result)):
				return
			stage = 3
			shell.bridge.request("story.export")
		["story.export", 3]:
			if not _save_story_text(result):
				return
			stage = 4
			shell.file_action = "load"
			shell._file_selected(VALID_STORY_PATH)
		["session.openStory", 4]:
			if not _check(
				is_equal_approx(float(result.snapshot.simTime), 1.0),
				"Native story restoration changed simulation time."
			):
				return
			stage = 5
			shell.bridge.request("story")


func _save_story_text(result: Variant) -> bool:
	if not _check(result is String, "Story export must return engine-owned JSON text."):
		return false
	saved_story_text = result
	saved_story = JSON.parse_string(saved_story_text)
	shell.story_to_save = saved_story_text
	shell.file_action = "save"
	shell._file_selected(VALID_STORY_PATH)
	return _check(
		FileAccess.get_file_as_string(VALID_STORY_PATH) == saved_story_text,
		"Native Save story changed the engine's exact JSON text."
	)


func _restore_response(method: String, result: Variant) -> void:
	match [method, stage]:
		["session.openStory", 50]:
			_fail("The native file callback accepted duplicate story keys.")
			return
		["story", 51]:
			if not _check(
				result == saved_story,
				"Rejected duplicate-key native import changed the complete authoritative story."
			):
				return
			DirAccess.remove_absolute(DUPLICATE_STORY_PATH)
			duplicate_import_checked = true
			observed.duplicateKeyFileRejected = true
			observed.rejectedFileStoryUnchanged = true
			stage = 5
			await _on_response(method, result)
		["story", 5]:
			if not _check(
				result == saved_story, "Native subprocess story continuation was not lossless."
			):
				return
			if not duplicate_import_checked:
				stage = 52
				shell.bridge.request("story.export")
				return
			_restore_timeline()
		["story.export", 52]:
			if not _check(
				result == saved_story_text,
				"Native save/load changed exact authored numbers or their fingerprints."
			):
				return
			observed.exactStoryTextRestore = true
			_prepare_duplicate_import()


func _restore_timeline() -> void:
	var actor: Node3D = shell.world.actors[actor_id]
	shell.world.apply_timeline(
		{
			"poses":
			[
				{
					"target": {"category": "creatures", "id": actor_id},
					"values": {"opacity": 0, "rotation": 2}
				}
			],
			"camera": {"zoom": 2}
		}
	)
	if not _check(not actor.visible, "Native timeline opacity sample was not applied."):
		return
	shell.world.clear_timeline()
	if not _check(actor.visible, "Stopping the native timeline left the actor hidden."):
		return
	# A stale asynchronous sample after stop must not reinstate the cutscene.
	shell.playback_generation = 2
	shell.sample_generation = 1
	shell._response(
		"storytelling.sample",
		{"poses": [{"target": {"category": "creatures", "id": actor_id}, "values": {"opacity": 0}}]}
	)
	if not _check(actor.visible, "A stale timeline response modified the restored native view."):
		return
	observed.simTime = 1.0
	observed.commandAccepted = true
	observed.losslessStoryRestore = true
	observed.timelineRestore = true
	stage = 6
	var project: Dictionary = JSON.parse_string(
		FileAccess.get_file_as_string("res://wildlands.project.json")
	)
	shell.bridge.request("session.create", {"pack": project.pack, "sceneId": "charted-home"})


func _prepare_duplicate_import() -> void:
	DirAccess.remove_absolute(VALID_STORY_PATH)
	observed.validStoryFileRestore = true
	if not _check(
		saved_story.has("version"), "Native story fixture lacks its authoritative version."
	):
		return
	var text := saved_story_text
	if not _story_file(DUPLICATE_STORY_PATH, '{"version":999,' + text.substr(1)):
		return
	stage = 50
	shell.file_action = "load"
	shell._file_selected(DUPLICATE_STORY_PATH)
	duplicate_import_request = shell.bridge.sequence
	return
	# A completed visual-only timeline restores the canonical actor transform.


func _appearance_response(method: String, result: Variant) -> void:
	match [method, stage]:
		["session.create", 6]:
			await AppearanceChecks.inspect(self, result)
		["story", 7]:
			saved_story = result
			stage = 8
			world_zoom_before_room = shell.world.zoom
			world_yaw_before_room = shell.world.yaw
			shell.floors.open("b2")


func _floor_observation_response(method: String, result: Variant) -> void:
	match [method, stage]:
		["query", 8]:
			if result is Dictionary and result.get("buildingId") == "b2":
				stage = 9
				await process_frame
				if not _check(
					shell.floors.room.floors.size() == 2 and shell.world.room_floor == "ground",
					"The native floor inspector did not open the actual two-floor workbench."
				):
					return
				shell.floors.floors.select(1)
				shell.floors.floors.item_selected.emit(1)
				if not _check(
					shell.world.room_floor == "upper",
					"Native floor selection did not change the observed floor."
				):
					return
				observed.inspectedFloors = 2
				shell.guide.picker.select(6)
				shell.guide._select(6)
				var stale_room: Dictionary = shell.floors.room.duplicate(true)
				shell.floors.pending_request = 999999
				shell.floors.querying = true
				if not _check(
					(
						not shell.floors.consume(stale_room, 999998)
						and shell.floors.pending_request == 999999
					),
					"A stale interior response consumed the current request."
				):
					return
				shell.floors._rejected(999999, "native retry check")
				if not _check(not shell.floors.querying, "A rejected floor query blocked retry."):
					return
				shell.floors.feedback.text = ""
				var capture := OS.get_environment("WILDLANDS_CAPTURE_NATIVE")
				if not capture.is_empty():
					await _capture(capture.get_basename() + "-floors.png")
				shell.bridge.request("story")
		["story", 9]:
			if not _check(
				result == saved_story,
				"Observing floors or guidance changed authoritative state or advanced the clock."
			):
				return
			stage = 10
			shell.floors.visit.pressed.emit()


func _floor_order_response(method: String, result: Variant) -> void:
	match [method, stage]:
		["command", 10]:
			if not _check(result.ok, "Native companion floor visit was rejected."):
				return
			stage = 11
			shell.floors._choose_floor(0)
			for index in range(shell.floors.recipes.item_count):
				if str(shell.floors.recipes.get_item_metadata(index)) == "rope":
					shell.floors.recipes.select(index)
			shell.floors.production.pressed.emit()
		["command", 11]:
			if not _check(result.ok, "Native floor production order was rejected."):
				return
			stage = 12
			shell.bridge.request("query", {"name": "buildingInterior", "args": ["b2"]})
		["query", 12]:
			if result is Dictionary and result.get("buildingId") == "b2":
				stage = 13
				await process_frame
				var rope: Array = result.recipes.filter(
					func(recipe): return str(recipe.id) == "rope"
				)
				if not _check(
					not rope.is_empty() and int(rope[0].queued) == 3,
					"Native floor order did not update the canonical workbench queue."
				):
					return
				shell.floors.close()
				if not _check(
					(
						is_equal_approx(shell.world.zoom, world_zoom_before_room)
						and is_equal_approx(shell.world.yaw, world_yaw_before_room)
					),
					"Leaving the inspected floor did not restore the map camera."
				):
					return
				observed.floorObservationReadOnly = true
				observed.floorVisitAccepted = true
				observed.floorProductionQueued = true
				observed.correlatedFloorReplies = true
				var project: Dictionary = JSON.parse_string(
					FileAccess.get_file_as_string("res://wildlands.project.json")
				)
				shell.bridge.request(
					"session.create", {"pack": project.pack, "sceneId": "charted-home"}
				)


func _quest_offer_response(method: String, result: Variant) -> void:
	match [method, stage]:
		["session.create", 13]:
			stage = 14
			shell.bridge.request("start")
			shell.bridge.request("step", {"count": 1200})
		["step", 14]:
			var offers: Array = result.view.state.colony.board.offers.filter(
				func(offer): return str(offer.questId) == "meadow"
			)
			if not _check(
				not offers.is_empty(),
				"The actual bounded quest preparation produced no Meadow offer."
			):
				return
			stage = 15
			shell.bridge.request(
				"command",
				{"command": {"id": "accept-quest", "actorId": "c1", "args": [offers[0].id]}}
			)
		["command", 15]:
			if not _check(result.ok, "The actual Meadow quest command was rejected."):
				return
			stage = 16
			shell.bridge.request("step", {"count": 100})


func _quest_departure_response(method: String, result: Variant) -> void:
	match [method, stage]:
		["step", 16]:
			await process_frame
			var pip: Array = result.view.state.colony.creatures.filter(
				func(actor): return str(actor.id) == "c1"
			)
			if not pip.is_empty() and pip[0].activeQuest == null and away_batches < 6:
				away_batches += 1
				shell.bridge.request("step", {"count": 100})
				return
			if not _check(
				not pip.is_empty() and pip[0].activeQuest != null,
				"The accepted real quest did not depart after the bounded preparation."
			):
				return
			stage = 17
			if not _check(
				not shell.world.actors.has("c1") or not shell.world.actors["c1"].visible,
				"A genuinely away companion remained visible in the native glade."
			):
				return
			observed.actualAwayQuest = true
			observed.questPreparationSteps = 1300 + away_batches * 100
			var project: Dictionary = JSON.parse_string(
				FileAccess.get_file_as_string("res://wildlands.project.json")
			)
			shell.bridge.request(
				"session.create", {"pack": project.pack, "sceneId": "charted-home"}
			)
		["session.create", 17]:
			stage = 18
			await process_frame
			if not _check(
				is_equal_approx(shell.world.zoom, 29.0),
				"The fresh scene retained the previous room camera."
			):
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
