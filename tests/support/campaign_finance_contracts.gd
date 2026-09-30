class_name CampaignFinanceContracts
extends RefCounted
## TM-04 deterministic cash, commitments, due dates, reserve and forecast contracts.
const WEEK = 7 * CampaignClock.SLOTS_PER_DAY
const ACCOUNT = "organization.finance"

static func run(check: Callable) -> void:
	var economy = CampaignEconomy.create("career.finance", ACCOUNT, 150000, 0)
	check.call(not economy.is_empty(), "Commitment-aware economy starts from integer opening cash")
	for item in _eight_week_fixture():
		var changed = CampaignEconomy.add_commitment(economy, {
			"id": item[0],
			"account_id": ACCOUNT,
			"source_id": item[1],
			"due_slot": int(item[2]) * WEEK,
			"amount_minor": item[3],
			"category": item[4]
		}, 0)
		check.call(changed.ok, "Worked cash-flow fixture accepts dated commitment " + str(item[0]))
		if not changed.ok:
			return
		economy = changed.economy
	var due = CampaignEconomy.settle_due(economy, 8 * WEEK)
	check.call(due.ok and due.settled_count == 15,
		"Eight-week fixture settles each contracted receipt and payment exactly once")
	if not due.ok:
		return
	economy = due.economy
	check.call(economy.accounts[ACCOUNT].cash_minor == 82000,
		"Worked fixture reconciles 150000 opening plus 112000 receipts minus 180000 payments to 82000")
	var repeat = CampaignEconomy.settle_due(economy, 8 * WEEK)
	check.call(repeat.ok and repeat.settled_count == 0 \
		and RaceStateValue.fingerprint(repeat.economy) == RaceStateValue.fingerprint(economy),
		"Repeating a dated settlement boundary is an exact no-op")
	var policy = CampaignEconomy.set_reserve_policy(economy, ACCOUNT, 60000, 8 * WEEK)
	check.call(policy.ok, "A minimum-cash reserve policy is persisted separately from cash")
	if not policy.ok:
		return
	economy = policy.economy
	var before_forecast = RaceStateValue.fingerprint(economy)
	var forecast = CampaignCashForecast.build(economy, ACCOUNT, 8 * WEEK, 9 * WEEK, [{
		"id": "assumption.sponsor-option",
		"account_id": ACCOUNT,
		"source_id": "offer.sponsor-option",
		"slot": 9 * WEEK,
		"amount_minor": 50000,
		"category": "sponsor",
		"scenario": "optimistic"
	}])
	check.call(forecast.ok, "A detached forecast accepts explicit scenario assumptions")
	if not forecast.ok:
		return
	var scenarios: Dictionary = forecast.forecast.scenarios
	check.call(scenarios.committed.ending_cash_minor == 54000 \
		and scenarios.committed.minimum_cash_minor == 54000 \
		and scenarios.committed.minimum_slot == 9 * WEEK,
		"Week-nine commitments expose the 54000 minimum cash before they settle")
	check.call(scenarios.committed.reserve_gap_minor == 6000 and scenarios.committed.breaches_reserve,
		"The 60000 policy exposes a 6000 reserve shortfall without inventing insolvency")
	check.call(scenarios.conservative.ending_cash_minor == 54000 \
		and scenarios.optimistic.ending_cash_minor == 104000,
		"Unsigned optimistic income never enters committed or conservative cash")
	check.call(RaceStateValue.fingerprint(economy) == before_forecast,
		"Opening or refreshing a forecast does not mutate cash, commitments or policy")
	var bad_assumption = CampaignCashForecast.build(economy, ACCOUNT, 8 * WEEK, 9 * WEEK, [{
		"id": "assumption.invalid",
		"account_id": ACCOUNT,
		"source_id": "offer.invalid",
		"slot": 9 * WEEK,
		"amount_minor": 1000,
		"category": "sponsor",
		"scenario": "guaranteed"
	}])
	check.call(not bad_assumption.ok and RaceStateValue.fingerprint(economy) == before_forecast,
		"Unsupported forecast certainty is rejected without changing authoritative finance")
	var duplicate = CampaignEconomy.add_commitment(economy, {
		"id": "cash.week9.payment",
		"account_id": ACCOUNT,
		"source_id": "duplicate.source",
		"due_slot": 10 * WEEK,
		"amount_minor": -100,
		"category": "other"
	}, 8 * WEEK)
	check.call(not duplicate.ok and RaceStateValue.fingerprint(duplicate.economy) == before_forecast,
		"Duplicate commitment identity leaves the economy unchanged")
	var cancellation = CampaignEconomy.cancel_commitment(economy, "cash.week9.payment", 8 * WEEK)
	check.call(cancellation.ok and cancellation.economy.commitments["cash.week9.payment"].status == "cancelled",
		"An open future commitment can be cancelled with dated evidence")
	var cancelled_forecast = CampaignCashForecast.build(
		cancellation.economy, ACCOUNT, 8 * WEEK, 9 * WEEK)
	check.call(cancelled_forecast.ok \
		and cancelled_forecast.forecast.scenarios.committed.ending_cash_minor == 82000,
		"Cancelled obligations no longer reduce the committed forecast")
	var tampered = economy.duplicate(true)
	tampered.commitments["cash.week9.payment"].amount_minor = -27000
	_reseal(tampered)
	check.call(not CampaignEconomy.validate(tampered).is_empty(),
		"Recomputed outer integrity cannot conceal changed binding commitment terms")
	_legacy_migration_contract(check)
	_application_contract(check, economy)

static func _legacy_migration_contract(check: Callable) -> void:
	var legacy = {
		"kind": CampaignEconomy.KIND,
		"version": CampaignEconomy.LEGACY_VERSION,
		"campaign_id": "career.legacy-finance",
		"accounts": {
			"organization.legacy": {
				"opening_minor": 1000,
				"cash_minor": 1000,
				"postings": {}
			}
		},
		"events": {}
	}
	_reseal(legacy)
	var upgraded = CampaignEconomy.upgrade(legacy, 123)
	check.call(not upgraded.is_empty() and upgraded.version == CampaignEconomy.VERSION \
		and upgraded.authority_from_slot == 123 and upgraded.commitments.is_empty() \
		and upgraded.accounts["organization.legacy"].cash_minor == 1000,
		"Legacy factual cash migrates losslessly while commitment authority begins explicitly at migration")

static func _application_contract(check: Callable, economy: Dictionary) -> void:
	var state = CampaignState.create({
		"campaign_id": "career.finance",
		"organization_id": ACCOUNT,
		"principal_id": "person.finance",
		"start": {"year": 1950, "month": 1, "day": 1, "slot": 0}
	})
	state.command("advance_slots", {"slots": 8 * WEEK})
	var checkpoint = CampaignCheckpoint.build(state, {}, {}, {}, economy, {})
	check.call(not checkpoint.is_empty(), "Commitment-aware economy persists inside the complete campaign checkpoint")
	var before = RaceStateValue.fingerprint(checkpoint)
	var forecast = CampaignFinanceQuery.cash_forecast(checkpoint, ACCOUNT, 9 * WEEK)
	check.call(forecast.ok and forecast.forecast.scenarios.committed.minimum_cash_minor == 54000 \
		and RaceStateValue.fingerprint(checkpoint) == before,
		"Application forecast returns a detached minimum-cash projection")
	var early = CampaignFinanceTransaction.settle_due(checkpoint, 9 * WEEK)
	check.call(not early.ok and RaceStateValue.fingerprint(early.checkpoint) == before,
		"Application settlement cannot post beyond authoritative campaign time")
	var restored = CampaignCheckpoint.restore(checkpoint)
	restored.state.command("advance_slots", {"slots": WEEK})
	var advanced = CampaignCheckpoint.build(restored.state, restored.settlements,
		restored.active_manifest, restored.competition, restored.economy, restored.inventory)
	var settled = CampaignFinanceTransaction.settle_due(advanced, 9 * WEEK)
	check.call(settled.ok and settled.settled_count == 1 \
		and settled.checkpoint.economy.accounts[ACCOUNT].cash_minor == 54000,
		"Due settlement publishes one complete checkpoint at authoritative time")
	var files = CampaignStorageContracts.MemoryFiles.new()
	var storage = CampaignStorage.new("user://campaign-finance.json", files)
	check.call(storage.save_checkpoint(settled.checkpoint).is_empty(),
		"Campaign storage accepts commitments, reserve policy and settled postings")
	var loaded = storage.load()
	check.call(loaded.ok and loaded.economy.commitments["cash.week9.payment"].status == "settled" \
		and loaded.economy.reserve_policies[ACCOUNT].minimum_cash_minor == 60000,
		"Save and restore preserve future terms, policy and exact dated settlement")

static func _eight_week_fixture() -> Array:
	return [
		["cash.week1.receipt", "sponsor.advance", 1, 60000, "sponsor"],
		["cash.week1.payment", "week1.plan", 1, -32000, "development"],
		["cash.week2.receipt", "round1.income", 2, 11000, "participation"],
		["cash.week2.payment", "round1.costs", 2, -28000, "event_operations"],
		["cash.week3.payment", "test.program", 3, -16000, "development"],
		["cash.week4.receipt", "round2.income", 4, 13000, "participation"],
		["cash.week4.payment", "round2.costs", 4, -30000, "event_operations"],
		["cash.week5.payment", "week5.fixed", 5, -10000, "fixed_operations"],
		["cash.week6.receipt", "round3.income", 6, 15000, "participation"],
		["cash.week6.payment", "round3.facility", 6, -36000, "facility"],
		["cash.week7.payment", "week7.fixed", 7, -10000, "fixed_operations"],
		["cash.week8.receipt", "round4.income", 8, 13000, "participation"],
		["cash.week8.payment", "round4.costs", 8, -18000, "event_operations"],
		["cash.week9.payment", "facility.commission", 9, -28000, "facility"]
	]

static func _reseal(data: Dictionary) -> void:
	data.erase("digest")
	data["digest"] = RaceStateValue.fingerprint(data)
