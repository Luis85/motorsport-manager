extends "res://tests/weekend_flow_ui_tests.gd"
## Whole-shell layout fixtures and actual settings/navigation input.
## The retained minimal_weekend_ui_tests remains the physical sporting journey.


func luminance(color: Color) -> float:
	var linear = color.srgb_to_linear()
	return linear.r * 0.2126 + linear.g * 0.7152 + linear.b * 0.0722


func theme_contracts() -> void:
	for background in [
		GameTheme.BG, GameTheme.PANEL, GameTheme.RAISED, GameTheme.HOVER, GameTheme.SELECTED
	]:
		for foreground in [
			GameTheme.TEXT, GameTheme.MUTED, GameTheme.ACCENT, GameTheme.WARNING, GameTheme.DANGER
		]:
			var contrast = (luminance(foreground) + 0.05) / (luminance(background) + 0.05)
			check(contrast >= 4.5, "Ordinary semantic text token contrast is at least 4.5:1")
	check(
		(luminance(GameTheme.ACCENT) + 0.05) / (luminance(GameTheme.ON_ACCENT) + 0.05) >= 4.5,
		"Primary action has contrasting ink"
	)
	for compound in ["S", "M", "H", "I", "W"]:
		var fill = RaceStrategyChart.compound_color("car-" + compound + "1")
		var ink = GameTheme.ink_on(fill)
		var light = maxf(luminance(fill), luminance(ink))
		var dark = minf(luminance(fill), luminance(ink))
		check(
			(light + 0.05) / (dark + 0.05) >= 4.5,
			"Tyre chart labels contrast with their real semantic fill"
		)
	for scale in PitwallDesign.TEXT_SCALES:
		var theme = MinimalRaceStyle.theme(scale)
		check(
			theme.get_color("font_color", "Button") == UI.INK, "Shared default and race button text"
		)
		check(
			theme.get_stylebox("focus", "Button").bg_color.a == 0,
			"Focus never obscures action state"
		)
		check(
			theme.get_color("title_button_color", "Tree") == UI.INK,
			"Classification header follows the same theme"
		)


func complete_button(button: Button, description: String) -> void:
	check(button != null and inside(button), description + " stays on screen")
	if button == null:
		return
	var available = button.size.x - button.get_theme_stylebox("normal").get_minimum_size().x
	var font = button.get_theme_font("font")
	for line in button.text.split("\n"):
		check(
			(
				(
					font
					. get_string_size(
						line, HORIZONTAL_ALIGNMENT_LEFT, -1, button.get_theme_font_size("font_size")
					)
					. x
				)
				<= available + 1
			),
			description + " keeps its complete label"
		)


func find_confirmation(parent: Node) -> ConfirmationDialog:
	for child in parent.get_children():
		if child is ConfirmationDialog and child.visible:
			return child
	return null


func internal_inputs(parent: Node) -> Array:
	var result: Array = []
	for child in parent.get_children(true):
		if child is LineEdit:
			result.append(child)
		result.append_array(internal_inputs(child))
	return result


func shell_profiles() -> void:
	for scale in PitwallDesign.TEXT_SCALES:
		for viewport in [Vector2i(1440, 900), Vector2i(1280, 800), Vector2i(1100, 720)]:
			root.size = viewport
			root.content_scale_size = viewport
			app.settings.pitwall_text_scale = scale
			var tag = "%d-%d" % [viewport.x, roundi(scale * 100)]
			game.show_menu()
			await settle(8)
			var menu = game.content.get_child(0)
			complete_button(menu.primary_button, "Menu primary / " + tag)
			complete_button(menu.continue_button, "Continue / " + tag)
			complete_button(find_button(menu, "Settings"), "Settings destination / " + tag)
			check(
				(
					root.gui_get_focus_owner()
					== (
						menu.primary_button
						if menu.continue_button.disabled
						else menu.continue_button
					)
				),
				"Menu has a useful initial focus"
			)
			check(
				(
					menu.primary_button.get_theme_font_size("font_size")
					== roundi(GameTheme.BODY_SIZE * scale)
				),
				"Menu honors the selected text scale"
			)
			check(
				inside(menu.preview) and menu.preview.size.x >= 300 and menu.preview.size.y >= 300,
				"Menu illustration keeps usable space"
			)
			await capture("coherence-menu-" + tag, "Shipping menu layout fixture; no new session")
			await click(menu.primary_button)
			check(game.screen_name == "grand_prix_setup", "Native menu action enters configuration")
			complete_button(
				find_button(game.content, "Review weekend"), "Configuration primary / " + tag
			)
			complete_button(find_button(game.content, "Back"), "Configuration back / " + tag)
			check(
				inside(game.library_canvas) and game.library_canvas.size.y >= 300,
				"Configuration leaves room for the circuit"
			)
			await capture("coherence-setup-" + tag, "Configuration with actual library data")
			game.show_settings()
			await settle(8)
			var settings = game.content.get_child(0)
			complete_button(settings.back_button, "Settings fixed back / " + tag)
			complete_button(settings.save_button, "Settings fixed save / " + tag)
			check(
				settings.sample.get_theme_font_size("font_size") == roundi(14 * scale),
				"Settings preview honors text scale"
			)
			check(
				settings.scroll.horizontal_scroll_mode == ScrollContainer.SCROLL_MODE_DISABLED,
				"Settings use only vertical reading scroll"
			)
			check(
				settings.columns.columns == (2 if settings.size.x >= 1200 else 1),
				"Settings columns adapt to available width"
			)
			await capture(
				"coherence-settings-" + tag, "Saved preferences; scroll body and fixed actions"
			)
			game.show_editor(app.library[7])
			await settle(8)
			var editor = game.editor
			complete_button(editor.test_button, "Editor primary / " + tag)
			complete_button(editor.undo_button, "Editor undo / " + tag)
			check(
				(
					inside(editor.canvas)
					and editor.canvas.size.x >= 300
					and editor.canvas.size.y >= 300
				),
				"Editor preserves a useful drawing area"
			)
			check(
				(
					editor.tool_picker.get_theme_font_size("font_size")
					== roundi(GameTheme.BODY_SIZE * scale)
				),
				"Editor toolbar honors selected text scale"
			)
			editor.inspector.current_tab = 1
			editor.refresh_inspector()
			await settle(6)
			check(
				(
					editor.name_field.get_theme_font_size("font_size")
					== roundi(GameTheme.BODY_SIZE * scale)
				),
				"Rebuilt inspector scales once, not cumulatively"
			)
			check(
				not editor.dirty,
				"Viewing inspector and changing typography does not edit the document"
			)
			await capture(
				"coherence-editor-" + tag, "Actual editor document; no geometry modification"
			)


func window_key(window: Window, code: Key) -> void:
	# Popups own a viewport; root injection does not target an embedded popup.
	for down in [true, false]:
		var event = InputEventKey.new()
		event.keycode = code
		event.pressed = down
		event.window_id = window.get_window_id()
		Input.parse_input_event(event)
		await settle(3)


func live_settings_resize() -> void:
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	app.settings.pitwall_text_scale = 1.3
	game.show_settings()
	await settle(8)
	var settings = game.content.get_child(0)
	for viewport in [Vector2i(1100, 720), Vector2i(1440, 900)]:
		root.size = viewport
		root.content_scale_size = viewport
		await settle(8)
		check(
			settings == game.content.get_child(0),
			"Resize preserves the same settings draft and controls"
		)
		check(
			settings.columns.columns == (1 if viewport.x == 1100 else 2),
			"Live settings resize reflows columns"
		)
		complete_button(settings.save_button, "Live-resized settings save")
		check(inside(settings.scroll), "Live-resized settings content stays in the viewport")


func settings_journey() -> void:
	root.size = Vector2i(1100, 720)
	root.content_scale_size = root.size
	app.settings.pitwall_text_scale = 1.0
	game.show_settings()
	await settle(8)
	var settings = game.content.get_child(0)
	var before = app.settings.duplicate(true)
	settings.text_choice.grab_focus()
	await key(KEY_ENTER)
	var text_popup = settings.text_choice.get_popup()
	check(text_popup.visible, "Keyboard opens the native text-size popup")
	await window_key(text_popup, KEY_DOWN)
	await window_key(text_popup, KEY_DOWN)
	check(text_popup.get_focused_item() == 2, "Native arrow keys focus the enlarged-text option")
	await window_key(text_popup, KEY_ENTER)
	check(
		settings.draft.pitwall_text_scale == 1.3 and settings.has_changes(),
		"Native choice stages enlarged text"
	)
	if not settings.has_changes():
		return  # Preserve the primary failure; later draft tests need this precondition.
	check(app.settings == before, "Preview does not mutate saved/application settings")
	complete_button(settings.save_button, "Enlarged settings save")
	await click(settings.back_button)
	var dialog = find_confirmation(settings)
	check(dialog != null, "Back protects the unsaved draft")
	if dialog:
		check(dialog.get_cancel_button().has_focus(), "Discard confirmation defaults to Cancel")
		var same = UI.confirm(
			settings, "Duplicate", "Must not replace the original intent", "Discard", func(): pass
		)
		check(same == dialog, "Repeated activation does not stack destructive confirmations")
		await click_dialog(dialog.get_cancel_button())
	check(
		game.screen_name == "settings" and settings.has_changes(),
		"Cancel keeps the same unsaved draft"
	)
	check(settings.back_button.has_focus(), "Cancel returns focus to its invoker")
	settings.save_result("Injected storage failure")
	check(
		(
			settings.has_changes()
			and not settings.save_button.disabled
			and settings.notice.text.begins_with("Not saved:")
		),
		"A failed save keeps edits and exposes recovery"
	)
	await capture(
		"coherence-settings-error", "Injected persistence-result boundary, not a real disk fault"
	)
	await click(settings.save_button)
	check(
		not settings.has_changes() and app.settings.pitwall_text_scale == 1.3,
		"Actual Apply persists the chosen setting"
	)
	check(
		Storage.read_json("user://settings.json").data.pitwall_text_scale == 1.3,
		"Settings are read back from real storage"
	)
	settings.back_button.grab_focus()
	var picker = UI.file_dialog(settings, false, ["*.json ; Circuit file"], func(_path): pass)
	await settle(6)
	var fields = internal_inputs(picker)
	check(not fields.is_empty(), "Native file picker exposes its internal text inputs")
	for field in fields:
		check(
			field.has_meta("pitwall_base_font_size"),
			"Internal native input participates in scaling"
		)
		var expected = roundi(float(field.get_meta("pitwall_base_font_size", 14)) * 1.3)
		check(
			field.get_theme_font_size("font_size") == expected,
			"Internal native input scales exactly once"
		)
	check(
		picker.size.x <= root.size.x and picker.size.y <= root.size.y,
		"Scaled native picker fits the window"
	)
	await click_dialog(picker.get_cancel_button())
	check(settings.back_button.has_focus(), "File picker cancellation restores its invoker")
	await key(KEY_ESCAPE)
	check(game.screen_name == "main_menu", "Escape returns from clean settings")
	game.show_library()
	await settle()
	await key(KEY_ESCAPE)
	check(
		game.screen_name == "main_menu",
		"Escape returns from configuration without launching a session"
	)


func campaign_shell() -> void:
	root.size = Vector2i(1100, 720)
	root.content_scale_size = root.size
	app.settings.pitwall_text_scale = 1.3
	game.show_menu()
	await settle(8)
	var campaign_button = find_button(game.content, "TEAM PRINCIPAL CAMPAIGN")
	check(campaign_button != null, "Main menu exposes the Team Principal campaign")
	if campaign_button == null:
		return
	await click(campaign_button)
	await settle(12)
	var campaign_scroll = game.content.get_child(0)
	check(
		(
			game.screen_name == "campaign"
			and campaign_scroll is ScrollContainer
			and campaign_scroll.get_child_count() == 1
			and campaign_scroll.get_child(0) is CampaignDirectorDesk
		),
		"Campaign entry opens the native scrollable Director Desk"
	)
	if game.screen_name != "campaign" or not campaign_scroll is ScrollContainer:
		return
	var desk: CampaignDirectorDesk = campaign_scroll.get_child(0)
	check(
		campaign_scroll.horizontal_scroll_mode == ScrollContainer.SCROLL_MODE_DISABLED,
		"Compact campaign uses vertical reading scroll without horizontal navigation"
	)
	complete_button(desk.primary_action, "Campaign departure action / compact 130%")
	check(
		desk.primary_action.text == "Start next event",
		"Opening campaign stops at the explicit departure decision"
	)
	check(
		CampaignCheckpoint.validate(app.campaign_checkpoint).is_empty(),
		"Native Director Desk owns a valid persisted campaign"
	)
	await capture(
		"coherence-campaign-director-1100-130",
		"Native Team Principal Director Desk at 1100x720 and 130% text; no fabricated result"
	)
	await click(desk.primary_action)
	await settle(12)
	check(
		game.screen_name == "weekend" and not app.campaign_checkpoint.active_manifest.is_empty(),
		"Campaign departure reuses the shipping Minimal weekend and freezes one active manifest"
	)
	check(
		app.weekend != null and app.weekend.phase == "briefing",
		"Campaign departure does not skip practice, qualifying or race approvals"
	)


func run() -> void:
	root.size = Vector2i(1440, 900)
	root.content_scale_size = root.size
	game = load("res://scenes/main.tscn").instantiate()
	root.add_child(game)
	app = root.get_node("App")
	await settle()
	app.settings.pitwall_layout = "minimal"
	model = PracticeRaceSim.new(TrackGeometry.new(app.library[7]))
	model.paused = true
	theme_contracts()
	await shell_profiles()
	await live_settings_resize()
	await settings_journey()
	await campaign_shell()
	var report = {
		"passed": failures.is_empty(),
		"checks": checks,
		"failures": failures,
		"screenshots": captures.size(),
		"captures": captures
	}
	Storage.write_json("res://reports/game-flow-coherence-ui.json", report)
	print("GAME_FLOW_COHERENCE_UI ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
