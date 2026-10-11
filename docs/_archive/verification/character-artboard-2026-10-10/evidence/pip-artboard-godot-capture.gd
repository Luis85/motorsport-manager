extends SceneTree


func _initialize():
	call_deferred("capture")


func capture():
	var viewport = SubViewport.new()
	viewport.size = Vector2i(960, 1100)
	viewport.own_world_3d = true
	viewport.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	viewport.msaa_3d = Viewport.MSAA_4X
	root.add_child(viewport)
	var environment = WorldEnvironment.new()
	environment.environment = Environment.new()
	environment.environment.background_mode = Environment.BG_COLOR
	environment.environment.background_color = Color("eee9db")
	environment.environment.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR
	environment.environment.ambient_light_color = Color("fff7e7")
	environment.environment.ambient_light_energy = 0.3
	environment.environment.tonemap_mode = Environment.TONE_MAPPER_ACES
	environment.environment.tonemap_exposure = 0.55
	viewport.add_child(environment)
	var sun = DirectionalLight3D.new()
	sun.rotation = Vector3(-0.85, -0.6, 0)
	sun.light_color = Color("fff0d7")
	sun.light_energy = 0.65
	sun.shadow_enabled = true
	viewport.add_child(sun)
	var fill = OmniLight3D.new()
	fill.position = Vector3(2, 2, 3)
	fill.light_color = Color("e4f0ff")
	fill.light_energy = 0.12
	fill.omni_range = 8
	viewport.add_child(fill)
	var camera = Camera3D.new()
	camera.projection = Camera3D.PROJECTION_ORTHOGONAL
	camera.size = 1.35
	viewport.add_child(camera)
	camera.position = Vector3(0.12, 0.65, 5)
	camera.look_at(Vector3(0, 0.5, 0))
	var factory = load("res://native/assets.gd").new()
	var asset = JSON.parse_string(FileAccess.get_file_as_string("res://visual.json"))
	factory.install([asset])
	var actor = factory.create(asset.category, asset.id, "world-round")
	viewport.add_child(actor)
	for frame in range(5):
		await process_frame
	await RenderingServer.frame_post_draw
	var picture = viewport.get_texture().get_image()
	assert(picture.get_width() == 960)
	var output = "res://capture.png"
	assert(picture.save_png(output) == OK)
	print("NATIVE_STUDIO_CAPTURE_PASS " + output)
	quit(0)
