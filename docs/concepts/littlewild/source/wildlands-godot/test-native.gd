extends SceneTree
## Run inside a generated project: actual native shell and subprocess, no fake engine.
var shell: Control
var stage := 0
var began := Time.get_ticks_msec()
var actor_id := ""
var observed: Dictionary = {}
var saved_story: Dictionary = {}

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
		var capture := OS.get_environment("WILDLANDS_CAPTURE_NATIVE")
		if not capture.is_empty():
			await RenderingServer.frame_post_draw
			var error := root.get_texture().get_image().save_png(capture)
			if not _check(error == OK, "Cannot save actual native viewport screenshot: " + error_string(error)):
				return
			observed.screenshot = capture
		print("WILDLANDS_NATIVE_PASS " + JSON.stringify(observed))
		shell.queue_free()
		await process_frame
		await process_frame
		quit(0)
