class_name ScenarioScreens
extends RefCounted
## Retained developer scenario galleries; not part of the minimal player menu.


static func add_collection_intro(
	host: Node, family: String, fallback_title: String, fallback_description: String, size: int = 30
) -> void:
	var collection = ScenarioCatalog.collection(family)
	host.content.add_child(UI.label(str(collection.get("title", fallback_title)), size))
	host.content.add_child(UI.paragraph(str(collection.get("description", fallback_description))))


static func show_strategy_scenarios(host: Node) -> void:
	host.clear_screen("strategy_scenarios")
	add_collection_intro(host, "dry", "Strategy scenarios", "Scenario collection unavailable.")
	var entries = GridContainer.new()
	entries.columns = 2
	entries.size_flags_vertical = Control.SIZE_EXPAND_FILL
	host.content.add_child(entries)
	for recipe in ScenarioCatalog.read("dry"):
		if not WeekendScenarios.valid(recipe):
			continue
		var panel = UI.panel()
		panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		panel.size_flags_vertical = Control.SIZE_EXPAND_FILL
		entries.add_child(panel)
		var body = UI.vbox(panel)
		body.add_child(UI.label(recipe.title, 20, UI.ACCENT))
		body.add_child(UI.paragraph(recipe.objective + "\n" + recipe.hint))
		var spacer = Control.new()
		spacer.size_flags_vertical = Control.SIZE_EXPAND_FILL
		body.add_child(spacer)
		body.add_child(
			UI.button(
				"Open %d-lap scenario · seed %d" % [recipe.laps, recipe.seed],
				func():
					var start = func():
						var candidate = WeekendScenarios.build(recipe, App.library)
						if candidate == null:
							UI.notify(
								host,
								"Scenario unavailable",
								"The scenario, track or initial plan is invalid."
							)
							return
						App.weekend = candidate
						App.weekend.speed = App.settings.speed
						host.show_weekend()
					if App.requires_entry_confirmation():
						var confirm = ConfirmationDialog.new()
						confirm.title = "Replace the active weekend?"
						confirm.dialog_text = "A scenario starts a new weekend. Export the current evidence before replacing it."
						host.add_child(confirm)
						confirm.confirmed.connect(
							func():
								confirm.queue_free()
								start.call()
						)
						confirm.canceled.connect(confirm.queue_free)
						confirm.popup_centered()
					else:
						start.call(),
				true
			)
		)


static func show_weather_scenarios(host: Node) -> void:
	host.clear_screen("weather_scenarios")
	add_collection_intro(host, "weather", "Weather scenarios", "Scenario collection unavailable.")
	var entries = GridContainer.new()
	entries.columns = 2
	entries.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	host.content.add_child(entries)
	for recipe in ScenarioCatalog.read("weather"):
		if not WeatherScenarios.valid(recipe):
			continue
		var panel = UI.panel()
		panel.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		entries.add_child(panel)
		var body = UI.vbox(panel)
		body.add_child(UI.label(recipe.title, 20, UI.ACCENT))
		body.add_child(UI.paragraph(recipe.objective + "\n" + recipe.hint))
		body.add_child(
			UI.button(
				"Open %d laps · %s · seed %d" % [recipe.laps, recipe.weather_mode, recipe.seed],
				func():
					var start = func():
						var candidate = WeatherScenarios.build(recipe, App.library)
						if candidate == null:
							UI.notify(
								host,
								"Scenario unavailable",
								"The weather scenario or track is invalid."
							)
							return
						App.weekend = candidate
						App.weekend.speed = App.settings.speed
						host.show_weekend()
					if App.weekend != null and App.weekend.phase not in ["briefing", "results"]:
						var confirm = ConfirmationDialog.new()
						confirm.title = "Replace active weekend?"
						confirm.dialog_text = "This creates a new weekend. Export existing evidence before replacing it."
						host.add_child(confirm)
						confirm.confirmed.connect(
							func():
								confirm.queue_free()
								start.call()
						)
						confirm.canceled.connect(confirm.queue_free)
						confirm.popup_centered()
					else:
						start.call(),
				true
			)
		)


static func show_recovery_scenarios(host: Node) -> void:
	host.clear_screen("recovery_scenarios")
	add_collection_intro(host, "recovery", "Recovery scenarios", "Scenario collection unavailable.")
	var scroll = ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	host.content.add_child(scroll)
	var entries = UI.vbox(scroll, true)
	for recipe in ScenarioCatalog.read("recovery"):
		if not RecoveryScenarios.valid(recipe):
			continue
		var panel = UI.panel()
		entries.add_child(panel)
		var body = UI.vbox(panel)
		body.add_child(UI.label(recipe.title, 20, UI.ACCENT))
		body.add_child(UI.paragraph(recipe.objective + "\n" + recipe.hint))
		body.add_child(
			UI.button(
				"Open %d laps · seed %d" % [recipe.laps, recipe.seed],
				func():
					var start = func():
						var candidate = RecoveryScenarios.build(recipe, App.library)
						if candidate == null:
							UI.notify(
								host,
								"Scenario unavailable",
								"The recovery scenario or track is invalid."
							)
							return
						App.weekend = candidate
						App.weekend.speed = App.settings.speed
						host.show_weekend()
					if App.weekend != null and App.weekend.phase not in ["briefing", "results"]:
						var confirm = ConfirmationDialog.new()
						confirm.title = "Replace active weekend?"
						confirm.dialog_text = "This starts a new weekend. Export current evidence before replacing it."
						host.add_child(confirm)
						confirm.confirmed.connect(
							func():
								confirm.queue_free()
								start.call()
						)
						confirm.canceled.connect(confirm.queue_free)
						confirm.popup_centered()
					else:
						start.call(),
				true
			)
		)


static func show_practice_scenarios(host: Node) -> void:
	host.clear_screen("practice_scenarios")
	add_collection_intro(host, "practice", "Practice scenarios", "Scenario collection unavailable.")
	for recipe in PracticeScenarios.catalog():
		var panel = UI.panel()
		host.content.add_child(panel)
		var body = UI.vbox(panel)
		body.add_child(UI.label(recipe.title, 20, UI.ACCENT))
		body.add_child(UI.paragraph(recipe.objective + "\n" + recipe.hint))
		body.add_child(
			UI.button(
				"Open briefing · seed %d" % recipe.seed,
				func():
					var start = func():
						var candidate = PracticeScenarios.build(recipe, App.library)
						if candidate == null:
							UI.notify(
								host,
								"Scenario unavailable",
								"The practice recipe or track is invalid."
							)
							return
						App.weekend = candidate
						App.weekend.speed = App.settings.speed
						host.show_weekend()
					if App.weekend != null and App.weekend.phase not in ["briefing", "results"]:
						var confirm = ConfirmationDialog.new()
						confirm.title = "Replace active weekend?"
						confirm.dialog_text = "This starts a new weekend. Export current evidence before replacing it."
						host.add_child(confirm)
						confirm.confirmed.connect(
							func():
								confirm.queue_free()
								start.call()
						)
						confirm.canceled.connect(confirm.queue_free)
						confirm.popup_centered()
					else:
						start.call(),
				true
			)
		)


static func show_rival_scenarios(host: Node) -> void:
	host.clear_screen("rival_scenarios")
	add_collection_intro(host, "rivals", "Rival scenarios", "Scenario collection unavailable.")
	for recipe in RivalScenarios.catalog():
		var panel = UI.panel()
		host.content.add_child(panel)
		var body = UI.vbox(panel)
		body.add_child(UI.label(recipe.title, 20, UI.ACCENT))
		body.add_child(UI.paragraph(recipe.objective + "\n" + recipe.hint))
		(
			body
			. add_child(
				(
					UI
					. paragraph(
						(
							(
								"All fitted M1 tyres start at %.0f%% tread; other stock unchanged. Dry · calm "
								+ "incidents · manual player pits · %d laps."
							)
							% [recipe.life, recipe.laps]
						)
					)
				)
			)
		)
		body.add_child(
			UI.button(
				"Open preparation · seed %d" % recipe.seed,
				func():
					var start = func():
						var candidate = RivalScenarios.build(recipe, App.library)
						if candidate == null:
							UI.notify(
								host,
								"Scenario unavailable",
								"The rival recipe or track is invalid."
							)
							return
						App.weekend = candidate
						App.weekend.speed = App.settings.speed
						host.show_weekend()
					if App.weekend != null and App.weekend.phase not in ["briefing", "results"]:
						var confirm = ConfirmationDialog.new()
						confirm.title = "Replace active weekend?"
						confirm.dialog_text = "This starts a new weekend. Export current evidence before replacing it."
						host.add_child(confirm)
						confirm.confirmed.connect(
							func():
								confirm.queue_free()
								start.call()
						)
						confirm.canceled.connect(confirm.queue_free)
						confirm.popup_centered()
					else:
						start.call(),
				true
			)
		)


static func show_duel_scenarios(host: Node) -> void:
	host.clear_screen("duel_scenarios")
	add_collection_intro(host, "duels", "Strategic duels", "Scenario collection unavailable.", 27)
	var scroll = ScrollContainer.new()
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	host.content.add_child(scroll)
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	var entries = UI.vbox(scroll)
	entries.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	for recipe in ScenarioCatalog.read("duels"):
		var card = UI.panel()
		entries.add_child(card)
		var body = UI.vbox(card)
		body.add_child(UI.label(recipe.title, 21, UI.ACCENT))
		body.add_child(UI.paragraph(recipe.objective + "\n" + recipe.hint))
		body.add_child(
			UI.paragraph(
				(
					"%s · %d laps · all fitted tyres %.0f%% · untimed grid · calm incidents"
					% [recipe.track.capitalize(), recipe.laps, recipe.life]
				)
			)
		)
		body.add_child(
			UI.button(
				"Open preparation · seed %d" % recipe.seed,
				func():
					var start = func():
						var candidate = ScenarioCatalog.build_duel(recipe, App.library)
						if candidate == null:
							UI.notify(
								host,
								"Scenario unavailable",
								"The shipped recipe or circuit did not validate."
							)
							return
						App.weekend = candidate
						App.weekend.speed = App.settings.speed
						host.show_weekend()
					if App.weekend != null and App.weekend.phase not in ["briefing", "results"]:
						var confirm = ConfirmationDialog.new()
						confirm.title = "Replace active weekend?"
						confirm.dialog_text = "This opens a new exercise. Save or export current evidence before replacing it."
						host.add_child(confirm)
						confirm.confirmed.connect(
							func():
								confirm.queue_free()
								start.call()
						)
						confirm.canceled.connect(confirm.queue_free)
						confirm.popup_centered()
					else:
						start.call(),
				true
			)
		)
