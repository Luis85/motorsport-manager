extends "res://tests/support/minimal_ui_layout_contracts.gd"


func polish_interactions() -> void:
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	app.settings.pitwall_text_scale = 1.3
	model = race_fixture()
	await reset()
	var item = view.items_by_id[6]
	var identity = item.get_instance_id()
	var card = view.driver_cards[6]
	var card_identity = card.get_instance_id()
	# Use the actual tower hit region, not the driver tabs, for this selection.
	var point = view.tower.global_position + view.tower.get_item_area_rect(item).get_center()
	for down in [true, false]:
		var event = InputEventMouseButton.new()
		event.button_index = MOUSE_BUTTON_LEFT
		event.position = point
		event.global_position = point
		event.pressed = down
		Input.parse_input_event(event)
		await settle(2)
	check(
		(
			view.selected_id == 6
			and view.driver_cards[6].last_selected
			and not view.driver_cards[3].last_selected
		),
		"Timing click synchronizes pitwall, map selection and both cards"
	)
	var before = model.commands.size()
	model.cars[6].distance = model.cars[0].distance + 150
	view.refresh()
	await settle()
	check(
		view.rank_rows[0] == item and item.get_instance_id() == identity and view.selected_id == 6,
		"A position change moves the same named item without changing the selected driver"
	)
	check(model.commands.size() == before, "Timing reordering does not issue a command")
	check(
		view.driver_cards[6].status_label.text.begins_with("P1"),
		"Card rank updates from the same timing projection"
	)
	await click(view.push_button)
	check(
		model.cars[6].pace == 2 and model.cars[3].pace == 1,
		"Command after a tower reorder still targets the chosen driver"
	)
	# A pressed pointer pins the rows until release, avoiding moving hit targets.
	point = view.tower.global_position + view.tower.get_item_area_rect(item).get_center()
	var press = InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = true
	press.position = point
	Input.parse_input_event(press)
	await settle(2)
	model.cars[6].distance = 1.0
	view.refresh()
	check(view.rank_rows[0] == item, "Held timing pointer cannot have its row moved under it")
	press = InputEventMouseButton.new()
	press.button_index = MOUSE_BUTTON_LEFT
	press.pressed = false
	press.position = point
	Input.parse_input_event(press)
	await settle(2)
	view.refresh()
	check(
		view.rank_rows.back() == item and view.selected_id == 6,
		"Release catches up the ranking without retargeting"
	)
	# Native popup pins driver/phase. Selection elsewhere closes it, never applies it.
	view.engine_control.grab_focus()
	await key(KEY_ENTER)
	check(view.engine_control.get_popup().visible, "Engine popup opens for selected driver")
	var engine = model.cars[3].engine
	view.select_driver(3)
	await settle()
	check(
		not view.engine_control.get_popup().visible and model.cars[3].engine == engine,
		"Driver switch cancels open engine choice without redirecting it"
	)
	view.engine_control.grab_focus()
	await key(KEY_ENTER)
	model.phase = "results"
	view.refresh()
	await settle()
	check(
		not view.engine_control.get_popup().visible and view.engine_control.disabled,
		"A terminal phase closes the stale engine menu"
	)
	model.phase = "race"
	view.refresh()
	var fitted = TyreInventory.find(model.cars[6], model.cars[6].set_id)
	fitted.wheels.FL.life = 18.0
	WheelTyres.publish(fitted)
	model.cars[6].tyre = fitted.life
	model.cars[6].fuel = 2.1
	model.cars[6].damage = 14.5
	view.refresh()
	await settle()
	check(
		card.metrics.tyre.value.text.contains("18%") and card.metrics.tyre.note.text.contains("FL"),
		"Live wheel data changes only the matching card"
	)
	check(
		(
			card.metrics.fuel.value.text == "2.1 laps"
			and card.metrics.health.note.text == "Damage 15%"
		),
		"Fuel and damage are live simulation data, not placeholders"
	)
	check(
		not view.driver_cards[3].metrics.tyre.value.text.contains("18%"),
		"Teammate card data remains independent"
	)
	var state = JSON.stringify(model.snapshot())
	await click(card)
	check(
		state == JSON.stringify(model.snapshot()),
		"Bottom card is read only: clicking it cannot select, command or pause"
	)
	var count = card.assignments
	for j in range(20):
		view.refresh()
	check(
		state == JSON.stringify(model.snapshot()) and count == card.assignments,
		"Unchanged cards reuse styles and text without simulation mutation"
	)
	await capture(
		"polish-driver-condition",
		"Synthetic low-tread, fuel and damage fixture; values read from the real car/set records"
	)
	# Same native instance, not just reconstructed profile fixtures.
	root.size = Vector2i(1100, 720)
	root.content_scale_size = root.size
	await settle(12)
	view.refresh()
	await settle(6)
	check(
		inside(view.driver_row) and inside(view.pitwall) and inside(view.canvas),
		"Live window resize retains cards, actions and circuit"
	)
	check(
		(
			card.get_instance_id() == card_identity
			and view.items_by_id[6].get_instance_id() == identity
		),
		"Resize does not rebuild driver cards or timing items"
	)
	check(
		view.tower.get_item_area_rect(view.rank_rows.back()).end.y <= view.tower.size.y,
		"Full field remains visible after live resize"
	)
	await capture(
		"polish-live-resize",
		"Same production screen resized with enlarged text, selected driver and damaged tyre retained"
	)


func instruments_interactions() -> void:
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	app.settings.pitwall_text_scale = 1.0
	model = race_fixture()
	await reset()
	var card = view.driver_cards[3]
	var other_card = view.driver_cards[6]
	var base = card.last_data.stress.value
	var other_value = other_card.last_data.stress.value
	await click(view.push_button)
	check(
		card.last_data.stress.value > base and other_card.last_data.stress.value == other_value,
		"Existing Push updates only the named driver's stress estimate"
	)
	check(
		card.metrics.stress.value.text.begins_with("~") and "EST." in visible_copy(card),
		"Stress estimate is visibly qualified, not only in a tooltip"
	)
	check(
		(
			card.metrics.stress.note.text.contains("Push")
			or card.metrics.stress.note.text.contains("Traffic")
		),
		"Wide stress readout shows its leading current demand"
	)
	await click(view.calm_button)
	check(
		card.last_data.stress.value < base and view.calm_button.button_pressed,
		"Existing Calm lowers the same driver estimate and retains selected state"
	)
	var current = MinimalDriverReadout.capture(model, 3)
	check(
		(
			card.engine_label.text == current.engine_temp
			and card.orders_label.text == "Calm · Standard"
		),
		"Driver card reflects actual engine temperature and current orders"
	)
	var fitted = TyreInventory.find(model.cars[3], model.cars[3].set_id)
	for wheel in fitted.wheels.values():
		wheel.punctured = true
	model.cars[3].damage = 35
	model.cars[3].engine_temperature = 125
	model.cars[3].fuel = 0.2
	model.cars[3].pace = 2
	view.refresh()
	await settle(8)
	check(
		card.last_data.stress.band == "High" and card.metrics.stress.note.text.contains("High"),
		"High demand has a text band as well as a colored segmented meter"
	)
	check(
		(
			card.metrics.tyre.note.text == "4 punctures"
			and card.meters.tyre.wheels.size() == 4
			and card.meters.tyre.wheels.all(func(w): return w.punctured)
		),
		"Four-wheel warnings remain actual per-wheel data, not average condition"
	)
	check(
		card.engine_label.text == "Engine 125°C" and card.last_data.engine_hot,
		"Engine heat warning uses actual measured heat independently of driver stress"
	)
	check(
		card.last_data.fuel_issue and card.metrics.health.note.text == "Damage 35%",
		"Fuel deficit and mechanical damage retain their own separate readouts"
	)
	var nodes = card.get_child_count()
	var before = JSON.stringify(model.snapshot())
	for i in range(100):
		view.refresh()
	check(
		before == JSON.stringify(model.snapshot()) and nodes == card.get_child_count(),
		"Instrument updates neither mutate simulation nor accumulate child nodes"
	)
	await capture(
		"instruments-stress",
		(
			"Synthetic high-demand and four-puncture boundary; native UI reads the "
			+ "actual fixture state; not a calibrated psychological simulation"
		)
	)
	root.size = Vector2i(1100, 720)
	root.content_scale_size = root.size
	app.settings.pitwall_text_scale = 1.3
	await reset()
	card = view.driver_cards[3]
	for metric in card.metrics.values():
		check(
			(
				inside(metric.title)
				and text_fits(metric.title)
				and inside(metric.value)
				and text_fits(metric.value)
				and inside(metric.note)
				and text_fits(metric.note)
			),
			"Compact high-demand instrument value and warning fit: " + metric.value.text
		)
	for node in [
		card.context_label,
		card.orders_label,
		card.engine_label,
		card.speed_label,
		view.state_label,
		view.name_label,
		view.send_button,
		view.box_button
	]:
		check(inside(node) and text_fits(node), "Compact pitwall/card context fits: " + node.text)
	check(
		view.tower.get_item_area_rect(view.rank_rows.back()).end.y <= view.tower.size.y,
		"All timing rows still fit alongside enriched compact cards"
	)
	await capture(
		"instruments-compact", "Synthetic combined warning fixture at 1100x720 and 130% text"
	)
	model.cars[3].dnf = true
	model.cars[3].retire_reason = "Out of fuel"
	view.refresh()
	await settle()
	check(
		card.metrics.stress.value.text == "—" and card.metrics.stress.note.text == "Not driving",
		"Retirement clears active stress rather than leaving an alarming stale value"
	)
	check(
		(
			"Out of fuel" in card.context_label.text
			and view.push_button.disabled
			and view.box_button.disabled
		),
		"Retirement retains its real cause and disables actions"
	)
	await click(view.driver_buttons[6])
	await click(view.push_button)
	check(
		(
			model.cars[6].pace == 2
			and model.cars[3].pace == 2
			and card.metrics.stress.value.text == "—"
		),
		"Switching away from a retired driver cannot transfer their stale state"
	)


func strategy_comparison_interactions() -> void:
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	app.settings.pitwall_text_scale = 1.0
	model = race_fixture()
	model.phase = "race"
	model.paused = false
	model.speed = 8
	await reset()
	var before = JSON.stringify(model.snapshot(), "", false, true)
	var commands = model.commands.size()
	var rng = model.rng_state
	await click(view.strategy_button)
	check(
		view.strategy_popup.visible and not view.strategy_view.latest.is_empty(),
		"Strategy button opens one on-demand comparison for the selected managed driver"
	)
	check(
		(
			"Read-only snapshot" in view.strategy_view.status_label.text
			and view.strategy_view.latest.driver_id == view.selected_id
		),
		"Popup identifies its detached read-only scope"
	)
	check(
		(
			before == JSON.stringify(model.snapshot(), "", false, true)
			and commands == model.commands.size()
			and rng == model.rng_state
			and not model.paused
			and model.speed == 8
		),
		"Opening comparison issues no command, pause, speed change, time step or random draw"
	)
	var frozen = JSON.stringify(view.strategy_view.latest, "", false, true)
	model.cars[3].distance += model.track.length
	model.cars[3].previous_distance = model.cars[3].distance
	var changed = JSON.stringify(model.snapshot(), "", false, true)
	for i in range(20):
		view.refresh()
	check(
		JSON.stringify(view.strategy_view.latest, "", false, true) == frozen,
		"Ordinary 5 Hz presentation refresh never recomputes the open comparison"
	)
	await key(KEY_SPACE)
	await key(KEY_5)
	check(
		not model.paused and model.speed == 8,
		"Race shortcuts cannot pause or change speed behind the open comparison"
	)
	await click(view.strategy_view.refresh_button)
	check(
		JSON.stringify(view.strategy_view.latest, "", false, true) != frozen,
		"Only explicit Refresh estimate captures changed current conditions"
	)
	check(
		(
			changed == JSON.stringify(model.snapshot(), "", false, true)
			and commands == model.commands.size()
			and rng == model.rng_state
		),
		"Explicit estimate refresh is observational and consumes no gameplay randomness"
	)
	await capture(
		"minimal-strategy-comparison",
		"Synthetic running-race fixture; on-demand detached estimate, no command or future-weather claim"
	)
	await click(view.strategy_view.close_button)
	await settle(3)
	check(
		not view.strategy_popup.visible and view.strategy_button.has_focus(),
		"Close returns focus to the Strategy button"
	)
	root.size = Vector2i(1100, 720)
	root.content_scale_size = root.size
	app.settings.pitwall_text_scale = 1.3
	model = race_fixture()
	model.phase = "race"
	await reset()
	await click(view.strategy_button)
	check(
		(
			view.strategy_popup.size.x <= root.size.x - 32
			and view.strategy_popup.size.y <= root.size.y - 32
		),
		"Comparison stays inside the compact enlarged-text viewport"
	)
	check(
		text_fits(view.strategy_view.close_button) and text_fits(view.strategy_view.refresh_button),
		"Comparison actions retain complete labels at 130% text"
	)
	await capture(
		"minimal-strategy-comparison-compact",
		"Synthetic race fixture at 1100x720 and 130% text; current-condition estimate only"
	)


func run() -> void:
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	app = root.get_node("App")
	await settle()
	check(app.settings.pitwall_layout == "minimal", "Clean launch uses minimal layout")
	await profiles()
	await phase_layouts()
	await interactions()
	await polish_interactions()
	await instruments_interactions()
	await strategy_comparison_interactions()
	var report = {
		"passed": failures.is_empty(),
		"checks": checks,
		"failures": failures,
		"screenshots": captures.size(),
		"captures": captures
	}
	Storage.write_json("res://reports/minimal-ui.json", report)
	print("MINIMAL_UI ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
