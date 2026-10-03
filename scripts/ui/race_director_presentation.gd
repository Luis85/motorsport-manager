class_name RaceDirectorPresentation
extends RefCounted
## Read-only presentation and control composition for its owning view.


static func _ready(view) -> void:
	view.director = view.view_session.director
	view.director.moment_reached.connect(func(_moment): view.refresh())
	view.director_navigation = UI.hbox(view)
	view.move_child(view.director_navigation, view.navigation.get_index() + 1)
	view.live_button = DirectorStyle.button("Pit wall", view.close_detail, true)
	view.director_navigation.add_child(view.live_button)
	view.director_navigation.add_child(
		DirectorStyle.button("Race plan", func(): view.director_plan(view.own_selection()))
	)
	view.director_navigation.add_child(DirectorStyle.button("Garage", func(): view.open_topic(4)))
	view.director_navigation.add_child(DirectorStyle.button("Review", view.open_session_workspace))
	var space = Control.new()
	space.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	view.director_navigation.add_child(space)
	view.history_button = DirectorStyle.button("Check-ins", view.show_moments)
	view.director_navigation.add_child(view.history_button)
	view.tools_button = DirectorStyle.button("All tools · Ctrl+K", view.show_navigator)
	view.director_navigation.add_child(view.tools_button)
	view.director_strip = DirectorStyle.panel(10)
	view.add_child(view.director_strip)
	view.move_child(view.director_strip, view.director_navigation.get_index() + 1)
	var strip_row = UI.hbox(view.director_strip)
	var story = UI.vbox(strip_row, true)
	story.add_theme_constant_override("separation", 3)
	view.chapter_label = DirectorStyle.label("RACE DIRECTOR", 11, DirectorStyle.ACCENT)
	story.add_child(view.chapter_label)
	view.moment_title = DirectorStyle.label("", 20)
	view.moment_title.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	story.add_child(view.moment_title)
	view.moment_detail = DirectorStyle.paragraph()
	view.moment_detail.max_lines_visible = 2
	view.moment_detail.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	story.add_child(view.moment_detail)
	var pace_box = UI.vbox(strip_row)
	view.run_button = DirectorStyle.button("Next moment · 8×", view.toggle_watch, true)
	pace_box.add_child(view.run_button)
	view.run_button.custom_minimum_size.x = 188
	view.run_button.tooltip_text = (
		"Explicitly run at 8x until a watched change or three lap-distances (at most 180 "
		+ "simulated seconds). Then pause and restore your speed. No jump, pit call or "
		+ "future knowledge. Manual speed cancels the watch."
	)
	var caption = DirectorStyle.label("Real racing. Bounded check-in.", 11, DirectorStyle.MUTED)
	pace_box.add_child(caption)
	view.director_cards = UI.hbox(view)
	view.move_child(view.director_cards, view.decision_bar.get_index() + 1)
	for id in view.sim.player_ids():
		var card = DirectorCarCard.new()
		card.driver_id = id
		view.director_cards.add_child(card)
		view.driver_cards[id] = card
		card.call_requested.connect(view.open_call)
		card.plan_requested.connect(view.director_plan)
		card.follow_requested.connect(
			func(driver_id):
				view.select_driver(driver_id)
				view.set_follow(true),
		)
	view.call_room = RaceCallRoom.new()
	view.call_room.configure(view.sim)
	view.add_child(view.call_room)
	view.move_child(view.call_room, view.race_workspace.get_index() + 1)
	view.call_room.hide()
	view.call_room.close_requested.connect(view.close_detail)
	view.call_room.command_requested.connect(view._call_command)
	view.call_room.watch_requested.connect(view.watch_call)
	view.call_room.details_requested.connect(view.director_plan)
	view.director_feed = DirectorStyle.label("", 12, DirectorStyle.MUTED)
	view.director_feed.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	view.director_feed.text_overrun_behavior = TextServer.OVERRUN_TRIM_ELLIPSIS
	view.map_controls.add_child(view.director_feed)
	view.director_footer = DirectorStyle.label("", 11, DirectorStyle.MUTED)
	view.add_child(view.director_footer)
	view.weekend_menu.get_popup().add_separator()
	view.weekend_menu.get_popup().add_item("Switch pit-wall layout", 30)
	view.weekend_menu.get_popup().id_pressed.connect(
		func(id):
			if id == 30:
				view.set_director_enabled(not view.director_enabled)
				var error = view.presentation_services.set_layout(
					"director" if view.director_enabled else "engineering"
				)
				if not error.is_empty():
					view.feedback("Layout changed for this view; preference not saved: " + error),
	)
	for node in [
		view.director_navigation,
		view.director_strip,
		view.director_cards,
		view.call_room,
		view.director_footer,
		view.director_feed
	]:
		PitwallDesign.scale_controls(node, view.text_scale)
	# Separate saved tutorial progress: the original engineering walkthrough stays intact.
	view.engineering_guide = view.guide.steps.duplicate(true)
	view.director_guide = view.engineering_guide.duplicate(true)
	view.director_guide.insert(
		0,
		{
			"title": "Watch, decide, follow the consequence",
			"body":
			(
				"Next moment is an explicit 8x watch, not a jump: it pauses at an observed "
				+ "change or a bounded check-in. Pause & decide freezes a named driver's "
				+ "situation. Choose a call, confirm, then follow its execution. Race plan and All "
				+ "tools keep the full engineering controls available."
			),
			"target": func(): return view.director_strip,
			"reveal": func(): view.close_detail()
		}
	)
	view.director_guide[1].target = func(): return view.director_cards
	view.director_guide[2].body = (
		"The header always keeps pause, speed and the next stage approval available. "
		+ "Ordinary navigation never pauses. Pause & decide is explicitly different: it "
		+ "pauses before showing a driver's snapshot. Next moment temporarily uses 8x, "
		+ "then pauses and restores your prior speed. A manual speed choice ends that "
		+ "watch."
	)
	view.director_ready = true
	view.set_director_enabled(view.director_enabled)
	view.refresh()


static func show_moments(view) -> void:
	var lines: Array[String] = [
		(
			"OBSERVED CHECK-INS · current view only. This is not the complete race "
			+ "journal.\nNo stops, outcomes or benefits are invented. A check-in never chooses "
			+ "a car command."
		)
	]
	if view.director.history_dropped > 0:
		(
			lines
			. append(
				(
					(
						"Latest 24 check-ins retained; %d older entries are no longer in this view. Full "
						+ "race evidence remains separate."
					)
					% view.director.history_dropped
				)
			)
		)
	for i in range(view.director.history.size() - 1, -1, -1):
		var moment = view.director.history[i]
		lines.append("%.1fs · %s\n%s" % [moment.time, moment.title, moment.detail])
	if view.director.history.is_empty():
		lines.append(
			(
				"No check-ins yet. Start an active session, then choose Next moment to watch "
				+ "real racing."
			)
		)
	view.show_reading("Race Director / check-ins", "\n\n".join(lines), view.history_button)
