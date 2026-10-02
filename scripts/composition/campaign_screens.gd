class_name CampaignScreens
extends RefCounted
## Campaign composition extracted from the native shell. This collaborator owns
## screen orchestration only; campaign authorities and persistence stay unchanged.
var host: Control

var content:
	get: return host.content

func _init(owner: Control) -> void:
	host = owner

func clear_screen(name: String) -> void:
	host.clear_screen(name)

func show_menu() -> void:
	host.show_menu()

func show_weekend(layout: String = "") -> void:
	host.show_weekend(layout)

func show_campaign() -> void:
	clear_screen("campaign")
	if App.campaign_checkpoint.is_empty():
		if App.has_saved_campaign():
			var load_error = App.load_campaign()
			if not load_error.is_empty():
				_show_campaign_error("Campaign could not be loaded: " + load_error)
				return
		else:
			var create_error = _create_starter_campaign()
			if not create_error.is_empty():
				_show_campaign_error(create_error)
				return
	var restored = CampaignCheckpoint.restore(App.campaign_checkpoint)
	if not restored.ok:
		_show_campaign_error(restored.error)
		return
	if not restored.active_manifest.is_empty():
		if App.weekend == null:
			var weekend_error = App.load_weekend()
			if not weekend_error.is_empty():
				_show_campaign_error("The campaign is frozen at departure but its weekend checkpoint is unavailable: " + weekend_error)
				return
		show_weekend("minimal")
		return
	var projection = CampaignDirectorQuery.overview(App.campaign_checkpoint)
	if not projection.ok:
		_show_campaign_error(projection.error)
		return
	var scroll = ScrollContainer.new()
	scroll.name = "CampaignScroll"
	scroll.horizontal_scroll_mode = ScrollContainer.SCROLL_MODE_DISABLED
	scroll.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	scroll.size_flags_vertical = Control.SIZE_EXPAND_FILL
	var desk = CampaignDirectorDesk.new()
	desk.name = "CampaignDirectorDesk"
	desk.configure(projection, float(App.settings.get("pitwall_text_scale", 1.0)),
		bool(App.settings.get("campaign_guide_hidden", false)))
	desk.menu_requested.connect(show_menu)
	desk.advance_requested.connect(_advance_campaign)
	desk.start_event_requested.connect(_start_campaign_event)
	desk.guide_visibility_requested.connect(func(hidden):
		App.settings.campaign_guide_hidden = hidden
		var error = App.save_settings()
		if not error.is_empty(): UI.notify(host, "Could not save guide preference", error)
		show_campaign())
	scroll.add_child(desk)
	content.add_child(scroll)

func _create_starter_campaign() -> String:
	if App.content_catalog == null:
		return "Team Principal Campaign requires a valid content catalog."
	var campaign = App.content_catalog.default_campaign()
	if campaign == null:
		return "Team Principal Campaign requires exactly one validated default campaign profile."
	var circuits = _resolved_campaign_circuits(campaign)
	if circuits.is_empty(): return "Team Principal Campaign has no valid authored circuit calendar."
	var campaign_record = campaign.to_record()
	var opening_circuit_id: String = campaign_record.calendar[0].circuit_id
	var record = _campaign_seed_record(circuits[opening_circuit_id], campaign)
	if record == null: return "Starter race entry could not be created from the authored campaign weekend."
	var checkpoint = CampaignStarter.create(record, campaign_record, circuits)
	if checkpoint.is_empty(): return "Starter campaign could not form a valid authoritative checkpoint."
	App.campaign_checkpoint = checkpoint
	return App.save_campaign()

func _resolved_campaign_circuits(campaign: CampaignDefinition) -> Dictionary:
	var result = {}
	for event in campaign.to_record().calendar:
		var definition = App.content_catalog.circuit(event.circuit_id)
		if definition == null: return {}
		result[event.circuit_id] = definition.document()
	return result

func _campaign_seed_record(track: Dictionary, campaign: CampaignDefinition) -> RaceRecord:
	var launch = WeekendLaunch.new(App.content_catalog)
	if not launch.stage_preset(campaign.weekend_id, track): return null
	var probe = PracticeRaceSim.new(launch.visual_track(), launch.session_options())
	if not probe.last_error.is_empty(): return null
	var profiles: Array = []
	for _car in probe.cars: profiles.append(RacePerformanceProfile.baseline())
	var options = launch.session_options()
	options["performance_profiles"] = profiles
	var simulation = PracticeRaceSim.new(launch.visual_track(), options)
	if not simulation.last_error.is_empty(): return null
	var record = RaceRecord.new(); record.attach(simulation)
	return record

func _campaign_track(track_hash: String) -> Dictionary:
	var frozen = CampaignStarter.circuits(App.campaign_checkpoint)
	for document in frozen.values():
		if RaceStateValue.fingerprint(document) == track_hash:
			return document.duplicate(true)
	# Explicit compatibility path for pre-authored campaign saves.
	App.load_library()
	var authored_vehicle = CampaignStarter.vehicle_definition(App.campaign_checkpoint)
	var vehicle_definition = VehicleDefinition.from_record(authored_vehicle) if not authored_vehicle.is_empty() else null
	var vehicle_id = CampaignStarter.vehicle(App.campaign_checkpoint)
	for document in App.library:
		var geometry = TrackGeometry.new(document, vehicle_id, false, vehicle_definition)
		if RaceRecord.fingerprint(geometry.document) == track_hash:
			return document
	return {}

func _advance_campaign() -> void:
	var changed = CampaignDirectorTransaction.advance_to_next_event(App.campaign_checkpoint)
	if not changed.ok:
		UI.notify(host, "Campaign cannot advance", changed.error)
		return
	App.campaign_checkpoint = changed.checkpoint
	var error = App.save_campaign()
	if not error.is_empty():
		UI.notify(host, "Campaign could not be saved", error)
		return
	show_campaign()

func _start_campaign_event() -> void:
	var projection = CampaignDirectorQuery.overview(App.campaign_checkpoint)
	if not projection.ok or projection.next_event.is_empty():
		UI.notify(host, "Departure unavailable", projection.get("error", "There is no scheduled event."))
		return
	if int(projection.next_event.departure_slot) != int(projection.slot):
		UI.notify(host, "Departure unavailable", "Advance the campaign to the registered departure slot first.")
		return
	var document = _campaign_track(projection.next_event.track_hash)
	if document.is_empty():
		UI.notify(host, "Departure unavailable", "The frozen campaign circuit is unavailable or does not match the scheduled event.")
		return
	var mappings = CampaignStarter.mappings(App.campaign_checkpoint)
	var profiles = CampaignEngineeringQuery.race_profiles(App.campaign_checkpoint, mappings)
	if not profiles.ok:
		UI.notify(host, "Departure unavailable", profiles.error)
		return
	var options = CampaignStarter.race_options(App.campaign_checkpoint)
	options["performance_profiles"] = profiles.profiles
	var authored_vehicle = CampaignStarter.vehicle_definition(App.campaign_checkpoint)
	var vehicle_definition = VehicleDefinition.from_record(authored_vehicle) if not authored_vehicle.is_empty() else null
	var geometry = TrackGeometry.new(document, CampaignStarter.vehicle(App.campaign_checkpoint), false, vehicle_definition)
	var simulation = PracticeRaceSim.new(geometry, options)
	if not simulation.last_error.is_empty():
		UI.notify(host, "Departure unavailable", simulation.last_error)
		return
	var record = RaceRecord.new(); record.attach(simulation)
	var departed = CampaignDepartureTransaction.depart(App.campaign_checkpoint,
		CampaignStarter.next_event_context(App.campaign_checkpoint), record, mappings,
		CampaignStarter.event_assignments(App.campaign_checkpoint), CampaignStarter.event_cost_minor(App.campaign_checkpoint))
	if not departed.ok:
		UI.notify(host, "Departure blocked", departed.error)
		return
	App.campaign_checkpoint = departed.checkpoint
	var campaign_error = App.save_campaign()
	if not campaign_error.is_empty():
		UI.notify(host, "Campaign could not be saved", campaign_error)
		return
	App.weekend = simulation; App.recording = record
	var weekend_error = App.save_weekend()
	if not weekend_error.is_empty():
		UI.notify(host, "Weekend could not be saved", weekend_error)
		return
	show_weekend("minimal")

func _settle_campaign_weekend() -> bool:
	if App.campaign_checkpoint.is_empty() or App.recording == null:
		return false
	var restored = CampaignCheckpoint.restore(App.campaign_checkpoint)
	if not restored.ok or restored.active_manifest.is_empty():
		return false
	var factual = WeekendResult.build(App.recording)
	if factual.is_empty():
		UI.notify(host, "Campaign settlement blocked", "The completed weekend could not produce factual result evidence.")
		return false
	var policy = CampaignStarter.weekend_policy(App.campaign_checkpoint)
	if policy.is_empty():
		UI.notify(host, "Campaign settlement blocked", "The campaign could not resolve its frozen weekend policy.")
		return false
	var staged = CampaignWeekendTransaction.stage(
		App.campaign_checkpoint, restored.active_manifest, factual, policy)
	if not staged.ok:
		UI.notify(host, "Campaign settlement blocked", staged.error)
		return false
	var follow = CampaignDirectorTransaction.after_weekend(staged.checkpoint)
	if not follow.ok:
		UI.notify(host, "Campaign follow-up blocked", follow.error)
		return false
	App.campaign_checkpoint = follow.checkpoint
	var error = App.save_campaign()
	if not error.is_empty():
		UI.notify(host, "Campaign could not be saved", error)
		return false
	App.clear_weekend_checkpoint()
	show_campaign()
	return true

func _show_campaign_error(message: String) -> void:
	content.add_child(UI.label("Campaign needs attention", 28))
	content.add_child(UI.paragraph(message))
	var back = UI.button("Main menu", show_menu, true); content.add_child(back)
	PitwallDesign.focus_later(back)

