extends "res://tests/minimal_ui_tests.gd"
## Actual native controls with long compound IDs, variable stock and narrow setup bounds.
class Store:
	extends WeekendEntryStore
	func save_record(record: RaceRecord) -> String:
		return RaceRecord.validate(record.seal())

func run() -> void:
	root.size = Vector2i(1440, 900); root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate(); root.add_child(game)
	app = root.get_node("App"); await settle()
	var loaded = ContentPackLoader.new().load_packs(["res://content/packs/core", "res://content/examples/club-racing"])
	check(loaded.ok, "Native tyre fixture uses the production validator")
	if not loaded.ok: finish_content(); return
	var document = app.library[7].duplicate(true); document.grid.count = 14
	var launch = WeekendLaunch.new(loaded.catalog)
	check(launch.stage(document, {"laps": 4, "scenario": "dry", "intensity": "calm",
		"roster_id": "local.club.roster.privateer", "tyre_allocation_id": "local.club.tyre_allocation.endurance", "setup_id": "local.club.setup.club"}), "Native content launch stages")
	var committed = launch.commit(launch.capture().revision, Store.new())
	check(committed.ok, "Native content launch commits")
	if not committed.ok: finish_content(); return
	committed.record.detach()
	model = committed.simulation
	app.settings.pitwall_layout = "minimal"
	for size in [Vector2i(1440, 900), Vector2i(1100, 720)]:
		root.size = size; root.content_scale_size = size; app.settings.pitwall_text_scale = 1.3
		await reset()
		for id in [12, 13]:
			var card = view.driver_cards[id]
			check(card.metrics.tyre.title.text.contains("CE"), "Authored compound short label: " + str(id))
			check(inside(card.metrics.tyre.title) and text_fits(card.metrics.tyre.title), "Compound heading fits at enlarged text: " + str(size))
			check(inside(card.metrics.tyre.note) and text_fits(card.metrics.tyre.note), "Compound status fits: " + str(size))
		check(view.driver_cards.size() == 2 and inside(view.box_button), "Minimal pitwall stays minimal with more content")
		var before = RaceRecord.fingerprint(model.snapshot())
		for iteration in range(8): view.refresh()
		check(before == RaceRecord.fingerprint(model.snapshot()), "Reading new content never changes simulation")
		await capture("content-tyre-minimal-" + str(size.x), "Real entry with six compounds, ten sets per driver and authored setup; paused practice, not a fabricated finish")
	root.size = Vector2i(1440, 900); root.content_scale_size = root.size
	app.settings.pitwall_text_scale = 1.0; app.settings.pitwall_layout = "engineering"
	# Setup is legal in the real briefing/preparation flow, not a synthetic widget fixture.
	check(model.command("practice_end"), "Close unused practice through a real command")
	if model.paused: check(model.command("pause"), "Explicitly resume the paused practice to complete its closure")
	for index in range(30000):
		if model.phase != "practice": break
		model.step()
	check(model.command("practice_finish"), "Briefing permits setup editing")
	await reset()
	view.select_driver(12); view.refresh(); await settle()
	check(view.compound.item_count == 6 and view.compound_ids.has("local.club.tyre.endurance"), "Diagnostic selector contains every authored compound")
	var index = view.compound_ids.find("local.club.tyre.endurance")
	check(view.compound.get_item_text(index) == "CE · Club Endurance", "Dropdown uses display metadata, not opaque IDs")
	view.open_topic(4); await settle(8)
	var panel: RacecraftPanel = view.racecraft
	panel.refresh()
	check(panel.fields.wing.min_value == 2 and panel.fields.wing.max_value == 7, "Full setup form uses profile bounds")
	check(view.setup.min_value == 2 and view.setup.max_value == 7, "Compact setup form shares profile bounds")
	var fitted = model.cars[12].car_setup.duplicate()
	panel.fields.wing.value = 4; panel.refresh_status(); await settle()
	check(model.cars[12].car_setup == fitted and panel.draft_effects.text.contains("DRAFT EFFECTS"), "Unapplied profile-aware comparison leaves fitted values alone")
	check(not panel.apply_button.disabled, "Changed legal draft enables Apply")
	panel.apply_button.pressed.emit(); view.refresh(); panel.refresh(); await settle()
	check(model.cars[12].car_setup.wing == 4 and model.cars[13].car_setup.wing == 3, "Apply targets only the actual selected driver")
	check(panel.draft_effects.text.contains("CURRENT TYRE/SURFACE HELD CONSTANT"), "Setup comparison retains its explanation")
	check(view.sim.tyre_info("local.club.tyre.endurance").color == "dfc777", "Authored color survives query projection")
	var styles = RaceChartQuery.set_styles(model)
	check(styles[model.cars[12].set_id].label == "CE1", "Charts resolve set labels without splitting identifiers")
	check(RaceStrategyChart.compound_color(model.cars[12].set_id, styles) == Color("dfc777"), "Charts use authored compound colors")
	await capture("content-tyre-setup", "Real staged setup controls and finite compound definitions; no synthetic race outcome")
	finish_content()

func finish_content() -> void:
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures,
		"captures": captures, "screenshots": captures.size()}
	Storage.write_json("res://reports/content-tyre-ui-tests.json", report)
	print("CONTENT_TYRE_UI_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
