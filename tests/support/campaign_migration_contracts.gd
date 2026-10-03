extends RefCounted
## Upgrade recorded legacy obligations losslessly; never fabricate their history.


static func run(check: Callable) -> void:
	invalid_start_values(check)
	var state = CampaignCommandContracts.state()
	check.call(
		state.command("advance_slots", {"slots": 16}), "Migration authority has a dated slot"
	)
	var economy = CampaignEconomy.create(state.campaign_id, state.organization_id, 5000)
	for category in ["payroll", "facility", "development"]:
		var added = CampaignEconomy.add_commitment(
			economy,
			{
				"id": "legacy." + category,
				"account_id": state.organization_id,
				"source_id": "source." + category,
				"amount_minor": -100,
				"due_slot": 32,
				"category": category
			},
			0
		)
		check.call(added.ok, "Legacy fixture binds an explicit " + category + " obligation")
		if not added.ok:
			return
		economy = added.economy
	var envelope = legacy_envelope(state, economy)
	var before = RaceStateValue.fingerprint(envelope)
	var upgraded = CampaignCheckpoint.upgrade(envelope)
	check.call(not upgraded.is_empty(), "Version-two campaign upgrades existing obligations")
	if upgraded.is_empty():
		return
	check.call(upgraded.economy == economy, "Migration preserves cash, obligations and dated terms")
	check.call(
		upgraded.personnel.legacy_payroll_ids == ["legacy.payroll"],
		"Payroll indexes recorded obligation"
	)
	check.call(
		upgraded.operations.legacy_facility_commitment_ids == ["legacy.facility"],
		"Facility migration indexes its existing cash source"
	)
	check.call(
		upgraded.engineering.legacy_development_commitment_ids == ["legacy.development"],
		"Engineering migration indexes its existing cash source"
	)
	for projection in [upgraded.personnel, upgraded.operations, upgraded.engineering]:
		check.call(
			int(projection.authority_from_slot) == 16,
			"Migrated authority starts at explicit recorded slot"
		)
	for rows in [
		upgraded.personnel.people,
		upgraded.personnel.contracts,
		upgraded.operations.resources,
		upgraded.operations.work_orders,
		upgraded.engineering.projects,
		upgraded.engineering.parts
	]:
		check.call(
			rows.is_empty(),
			"Migration does not invent personnel, facilities, work or physical parts"
		)
	check.call(
		RaceStateValue.fingerprint(envelope) == before, "Legacy upgrade preserves caller envelope"
	)
	var repeated = CampaignCheckpoint.upgrade(upgraded)
	check.call(repeated == upgraded, "Current checkpoint upgrade is idempotent")
	repeated.economy.accounts[state.organization_id].cash_minor = -999
	check.call(upgraded.economy == economy, "Repeated upgrade returns a detached nested value")
	legacy_economy(check, state)


static func legacy_economy(check: Callable, state: CampaignState) -> void:
	var economy = {
		"kind": CampaignEconomy.KIND,
		"version": CampaignEconomy.LEGACY_VERSION,
		"campaign_id": state.campaign_id,
		"accounts":
		{state.organization_id: {"opening_minor": 5000, "cash_minor": 5000, "postings": {}}},
		"events": {}
	}
	economy.digest = RaceStateValue.fingerprint(economy)
	var envelope = legacy_envelope(state, economy)
	var before = RaceStateValue.fingerprint(envelope)
	var upgraded = CampaignCheckpoint.upgrade(envelope)
	check.call(
		not upgraded.is_empty(), "Legacy economy migrates inside the older campaign envelope"
	)
	if upgraded.is_empty():
		return
	check.call(
		int(upgraded.economy.version) == CampaignEconomy.VERSION,
		"Older economy gains current schema"
	)
	check.call(
		upgraded.economy.accounts == economy.accounts, "Empty legacy ledger retains exact balances"
	)
	check.call(
		upgraded.economy.commitments.is_empty(),
		"Legacy ledger migration invents no binding obligations"
	)
	check.call(
		int(upgraded.economy.authority_from_slot) == 16,
		"Economy authority begins at recorded campaign slot"
	)
	check.call(
		RaceStateValue.fingerprint(envelope) == before,
		"Legacy ledger normalization preserves caller value"
	)


static func legacy_envelope(state: CampaignState, economy: Dictionary) -> Dictionary:
	var envelope = {
		"kind": CampaignCheckpoint.KIND,
		"version": CampaignCheckpoint.CONSEQUENCE_VERSION,
		"campaign_id": state.campaign_id,
		"state": state.snapshot(),
		"settlements": CampaignWeekendSettlement.empty_ledger(),
		"active_manifest": {},
		"competition": CampaignCompetition.empty(state.campaign_id),
		"economy": economy,
		"inventory": CampaignInventory.empty(state.campaign_id)
	}
	envelope.digest = RaceStateValue.fingerprint(envelope)
	return envelope


static func invalid_start_values(check: Callable) -> void:
	for malformed in [null, true, 7, "date", [], {}]:
		var input = {
			"campaign_id": "campaign.invalid-start",
			"organization_id": "team.invalid-start",
			"principal_id": "person.invalid-start",
			"start": malformed
		}
		var before = RaceStateValue.fingerprint(input)
		check.call(
			CampaignState.create(input) == null,
			"Malformed dated start rejects without engine error"
		)
		check.call(
			RaceStateValue.fingerprint(input) == before,
			"Invalid campaign start preserves author input"
		)
