class_name CampaignFinanceBalanceContracts
extends RefCounted
const DAY = CampaignClock.SLOTS_PER_DAY


static func run(check: Callable) -> void:
	_metadata(check)
	var loaded = ContentPackLoader.new().load_packs([ContentPackLoader.BUILTIN_ROOT])
	check.call(loaded.ok, "Finance balance fixture loads production content")
	if not loaded.ok:
		return
	var source: Dictionary = loaded.catalog.default_campaign().to_record()
	source.erase("tuning")
	var before = RaceStateValue.fingerprint(source)
	var legacy = CampaignDefinition.from_record(source)
	check.call(
		legacy != null and RaceStateValue.fingerprint(legacy.to_record()) == before,
		"Omitted finance tuning preserves the exact legacy definition and hash"
	)
	if legacy == null:
		return
	check.call(
		CampaignFinanceBalance.for_definition(source).is_read_only(),
		"Legacy finance defaults are immutable observations"
	)
	var checkpoint = _fixture(loaded.catalog, source)
	check.call(not checkpoint.is_empty(), "Legacy authored career freezes its complete content")
	if checkpoint.is_empty():
		return
	var old_bridge = CampaignDistressTransaction.bridge_financing(checkpoint, 5)
	check.call(
		(
			old_bridge.ok
			and old_bridge.checkpoint.economy.commitments["bridge.repayment.0"].amount_minor == -6
			and old_bridge.checkpoint.economy.commitments["bridge.repayment.0"].due_slot == 30 * DAY
		),
		"Legacy bridge retains float rounding and thirty-day contractual maturity"
	)
	source["tuning"] = {
		"finance": {"distress_forecast_days": 3, "bridge_maturity_days": 7, "bridge_fee_bps": 2500}
	}
	var changed = _fixture(loaded.catalog, source)
	check.call(not changed.is_empty(), "A complete authored finance policy creates a new career")
	if changed.is_empty():
		return
	var bridge = CampaignDistressTransaction.bridge_financing(changed, 10)
	check.call(
		(
			bridge.ok
			and bridge.checkpoint.economy.commitments["bridge.repayment.0"].amount_minor == -13
			and bridge.checkpoint.economy.commitments["bridge.repayment.0"].due_slot == 7 * DAY
		),
		"Authored fee rounds integer minor units and maturity freezes in the agreement"
	)
	var changed_hash = RaceStateValue.fingerprint(changed)
	source.tuning.finance.bridge_fee_bps = 0
	source.tuning.finance.bridge_maturity_days = 1
	var repeat = CampaignDistressTransaction.bridge_financing(changed, 10)
	check.call(
		(
			repeat.ok
			and repeat.checkpoint == bridge.checkpoint
			and RaceStateValue.fingerprint(changed) == changed_hash
		),
		"Later source edits leave existing frozen career decisions and input unchanged"
	)
	if bridge.ok:
		var agreement = bridge.checkpoint.economy.commitments["bridge.repayment.0"].duplicate(true)
		var evaluated = CampaignDistressTransaction.evaluate(bridge.checkpoint)
		check.call(
			(
				evaluated.ok
				and evaluated.checkpoint.economy.commitments["bridge.repayment.0"] == agreement
			),
			"Distress evaluation cannot rewrite an outstanding loan's amount or due slot"
		)
	var rejected = CampaignDistressTransaction.bridge_financing(changed, CampaignEconomy.MAX_MINOR)
	check.call(
		(
			not rejected.ok
			and rejected.checkpoint == changed
			and RaceStateValue.fingerprint(changed) == changed_hash
		),
		"Out-of-bounds bridge amount rejects atomically"
	)
	var bounded = CampaignDistressTransaction.bridge_financing(
		changed, CampaignEconomy.MAX_MINOR / 2
	)
	check.call(
		bounded.ok and CampaignEconomy.validate(bounded.checkpoint.economy).is_empty(),
		"Largest supported authored bridge remains inside integer economy bounds"
	)
	if bridge.ok:
		rejected = CampaignDistressTransaction.bridge_financing(bridge.checkpoint, 20)
		check.call(
			not rejected.ok and rejected.checkpoint == bridge.checkpoint,
			"Duplicate bridge source rejects without publishing a partial cash receipt"
		)
	_forecast(checkpoint, changed, check)
	_invalid(source, check)


static func _forecast(legacy: Dictionary, authored: Dictionary, check: Callable) -> void:
	var input = {
		"id": "commitment.forecast-gap",
		"source_id": "contract.forecast-gap",
		"account_id": authored.state.organization_id,
		"due_slot": 5 * DAY,
		"amount_minor": -200000,
		"category": "other"
	}
	var short = CampaignFinanceTransaction.add_commitment(authored, input)
	var long = CampaignFinanceTransaction.add_commitment(legacy, input)
	check.call(short.ok and long.ok, "Forecast fixture creates the same binding future liability")
	if not short.ok or not long.ok:
		return
	var short_hash = RaceStateValue.fingerprint(short.checkpoint)
	var near = CampaignDistressTransaction.evaluate(short.checkpoint)
	var far = CampaignDistressTransaction.evaluate(long.checkpoint)
	check.call(
		(
			near.ok
			and far.ok
			and near.checkpoint.management.distress.stage == "normal"
			and far.checkpoint.management.distress.stage == "funding_gap"
		),
		"Authored three-day horizon excludes a five-day obligation seen by legacy thirty-day policy"
	)
	check.call(
		RaceStateValue.fingerprint(short.checkpoint) == short_hash,
		"Evaluating financial pressure preserves the caller checkpoint"
	)


static func _invalid(source: Dictionary, check: Callable) -> void:
	for change in [
		["bridge_fee_bps", -1],
		["bridge_fee_bps", 10001],
		["bridge_fee_bps", 10.5],
		["bridge_maturity_days", 0],
		["distress_forecast_days", 3661]
	]:
		var broken = source.duplicate(true)
		broken.tuning.finance[change[0]] = change[1]
		check.call(
			CampaignDefinition.from_record(broken) == null,
			"Invalid finance policy rejects " + str(change)
		)
	var incomplete = source.duplicate(true)
	incomplete.tuning.finance.erase("bridge_fee_bps")
	check.call(
		CampaignDefinition.from_record(incomplete) == null,
		"Partial authored finance policy rejects"
	)
	incomplete = source.duplicate(true)
	incomplete.tuning.finance.unsupported = 1
	check.call(
		CampaignDefinition.from_record(incomplete) == null, "Unknown finance tuning key rejects"
	)


static func _fixture(catalog: ContentCatalog, definition: Dictionary) -> Dictionary:
	var campaign = CampaignDefinition.from_record(definition)
	if campaign == null:
		return {}
	var track: Dictionary = (
		Storage.read_json(ContentPackLoader.BUILTIN_ROOT + "/circuits/hillside.json").data
	)
	var record = CampaignDirectorContracts._record(track, catalog, campaign)
	if record == null:
		return {}
	return CampaignStarter.create(
		record, definition, CampaignDirectorContracts._circuits(catalog, campaign)
	)


static func _metadata(check: Callable) -> void:
	var properties: Dictionary = CampaignFinanceBalance.fields().properties
	var unit_description = RegEx.new()
	unit_description.compile("^(days|basis points): .+")
	for key in CampaignFinanceBalance.LEGACY:
		var field: Dictionary = properties[key]
		var units = "basis points" if key == "bridge_fee_bps" else "days"
		check.call(
			(
				unit_description.search(str(field.get("description", ""))) != null
				and str(field.description).begins_with(units + ": ")
				and field.has("minimum")
				and field.has("maximum")
			),
			"Finance authoring metadata exposes the contractual unit and bounds: " + key
		)
