extends "res://tests/support/toolbox_test_fixture.gd"
## Complete campaign checkpoints publish through the original dated transaction owners.
const Nested = preload("res://tests/support/toolbox_campaign_nested.gd")
const Journey = preload("res://tests/support/toolbox_weekend_journey.gd")
var weekends: DeveloperWeekends
var campaigns: DeveloperCampaigns
var resumed_toolbox: GameToolbox


func run() -> void:
	if not prepare():
		finish("toolbox-campaign-tests")
		return
	var files = player_files()
	weekends = DeveloperWeekends.new(catalog)
	campaigns = DeveloperCampaigns.new(catalog, weekends)
	Nested.run(self, GameToolbox.new(catalog))
	create_and_read_contracts()
	dated_transaction_contracts()
	depart_and_return_contracts()
	protocol_parity()
	campaigns.close_all()
	weekends.close_all()
	if resumed_toolbox != null:
		resumed_toolbox.close()
	same(player_files(), files, "Campaign developer transactions never write player saves")
	finish("toolbox-campaign-tests")


func checkpoint(session: String = "career") -> Dictionary:
	var response = campaigns.snapshot(session)
	if not accepted(response, "Export complete campaign " + session):
		return {}
	check(
		CampaignCheckpoint.validate(response.result.checkpoint).is_empty(),
		"Export is a valid complete checkpoint"
	)
	return response.result.checkpoint


func create_and_read_contracts() -> void:
	var created = campaigns.create("career", "core.campaign.team-principal")
	if not accepted(created, "Create a frozen authored campaign"):
		return
	var reference = CampaignWeekendWorkflow.create(catalog, "core.campaign.team-principal")
	check(reference.ok, "Original application workflow creates the same authored career")
	same(checkpoint(), reference.checkpoint, "SDK and original campaign creation")
	var initial = checkpoint()
	for view in [
		"overview",
		"readiness",
		"finance",
		"personnel",
		"operations",
		"engineering",
		"competition",
		"management",
		"rivals",
		"commercial",
		"delegation"
	]:
		var response = campaigns.query("career", view)
		if accepted(response, "Detached campaign view " + view):
			response.result.clear()
	same(checkpoint(), initial, "Campaign queries preserve dated authority and all resources")
	var exported = checkpoint()
	exported.management.clear()
	same(checkpoint(), initial, "Campaign checkpoint exports are detached")
	for invalid in [{}, {"state": "scalar"}, {"kind": "unknown", "version": 1}]:
		rejected(campaigns.restore("career", invalid), "Malformed campaign restore")
		same(checkpoint(), initial, "Rejected restore is atomic")
	rejected(
		campaigns.command("career", "advance_slots", {"slots": 100}),
		"Raw campaign clock bypass",
		"UNKNOWN_COMMAND"
	)
	rejected(
		campaigns.command("career", "finance.add_commitment", {"input": "scalar"}),
		"Malformed planning input"
	)
	rejected(campaigns.query("career", "_sessions"), "Private campaign query")
	rejected(
		campaigns.command(
			"career",
			"finance.set_reserve_policy",
			{"account_id": initial.state.organization_id, "minimum_cash_minor": 9007199254740993}
		),
		"Planning integer exceeds the documented domain bound",
		"INVALID_ARGUMENT"
	)
	same(checkpoint(), initial, "Rejected planning and queries preserve campaign")


func dated_transaction_contracts() -> void:
	var initial = checkpoint()
	var account_id: String = initial.state.organization_id
	var payload = {"account_id": account_id, "minimum_cash_minor": 50000}
	var expected = CampaignFinanceTransaction.set_reserve_policy(initial, account_id, 50000)
	var changed = campaigns.command("career", "finance.set_reserve_policy", payload)
	if accepted(changed, "Plan an explicit reserve policy"):
		check(expected.ok, "Original finance owner accepts the identical plan")
		same(
			checkpoint(),
			expected.checkpoint,
			"Planning publishes the production complete checkpoint"
		)
		payload.minimum_cash_minor = -1
		same(checkpoint(), expected.checkpoint, "Planning owns its detached inputs")
	var before_advance = checkpoint()
	var original = CampaignDirectorTransaction.advance_to_next_event(before_advance)
	var advanced = campaigns.advance("career")
	if not accepted(advanced, "Advance to the actual next departure date"):
		return
	check(original.ok, "Original campaign director advances the identical dated authority")
	same(checkpoint(), original.checkpoint, "Dated progression settles due obligations atomically")
	check(
		(
			checkpoint().state.clock.elapsed_slots
			== CampaignStarter.next_event_context(checkpoint()).departure_slot
		),
		"Campaign progression stops at the registered departure date, including already-ready starts"
	)


func depart_and_return_contracts() -> void:
	var ready = checkpoint()
	accepted(weekends.create("occupied", configuration()), "Reserve a separate weekend identity")
	rejected(campaigns.depart("career", "occupied"), "Occupied weekend departure", "SESSION_EXISTS")
	same(checkpoint(), ready, "Failed weekend adoption does not publish a partial manifest")
	var departed = campaigns.depart("career", "campaign-weekend")
	if not accepted(departed, "Depart with one actual owned recording"):
		return
	var active = checkpoint()
	check(not active.active_manifest.is_empty(), "Departure publishes the exact campaign manifest")
	check(
		weekends.query("campaign-weekend").result.phase == "briefing",
		"Campaign departure requires explicit sporting approval"
	)
	rejected(
		campaigns.advance("career"), "Dated progression during an active weekend", "DOMAIN_REJECTED"
	)
	rejected(
		campaigns.command(
			"career",
			"finance.set_reserve_policy",
			{"account_id": active.state.organization_id, "minimum_cash_minor": 40000}
		),
		"Planning during an active weekend",
		"DOMAIN_REJECTED"
	)
	rejected(
		campaigns.settle("career", "campaign-weekend"),
		"Unfinished factual settlement",
		"DOMAIN_REJECTED"
	)
	same(checkpoint(), active, "Rejected active operations leave all campaign projections intact")
	if not Journey.start_qualifying(weekends, "campaign-weekend", check):
		return
	if not restore_active_career():
		return
	if not Journey.finish(weekends, "campaign-weekend", check):
		return
	var record = weekends.owned_record("campaign-weekend")
	var facts = WeekendResult.build(record)
	check(not facts.is_empty(), "Physical SDK journey produces an immutable factual weekend result")
	var weekend_before = weekends.snapshot("campaign-weekend").result
	var expected = CampaignWeekendWorkflow.settle(active, record)
	check(expected.ok, "Original workflow settles the identical factual record")
	var settled = campaigns.settle("career", "campaign-weekend")
	if not accepted(settled, "Publish factual campaign return as one complete transaction"):
		return
	same(
		checkpoint(),
		expected.checkpoint,
		"SDK return matches original time, standings, cash and resources"
	)
	check(
		checkpoint().active_manifest.is_empty(),
		"Settlement clears only the completed active manifest"
	)
	same(
		weekends.snapshot("campaign-weekend").result,
		weekend_before,
		"Campaign consequences cannot rewrite the finished race"
	)
	var after = checkpoint()
	rejected(
		campaigns.settle("career", "campaign-weekend"), "Repeated factual return", "DOMAIN_REJECTED"
	)
	same(checkpoint(), after, "Repeated settlement cannot duplicate cash, awards or receipts")
	var progressed = CampaignDirectorTransaction.advance_to_next_event(after)
	accepted(campaigns.advance("career"), "Advance the settled career to its next dated event")
	same(
		checkpoint(),
		progressed.checkpoint,
		"Second-event obligations and date match the original owner"
	)
	check(
		checkpoint().state.clock.elapsed_slots > after.state.clock.elapsed_slots,
		"Campaign slots progress independently of finished race time"
	)
	after = checkpoint()
	accepted(campaigns.restore("restored", after), "Restore a supported full campaign checkpoint")
	same(checkpoint("restored"), after, "Valid campaign restore is lossless")
	accepted(campaigns.close("restored"), "Close restored campaign")
	accepted(campaigns.close("restored"), "Repeated campaign close is idempotent")
	rejected(campaigns.restore("restored", after), "Closed campaign restore", "SESSION_CLOSED")
	rejected(
		campaigns.create("restored", "core.campaign.team-principal"),
		"Closed campaign ID reuse",
		"SESSION_EXISTS"
	)


func restore_active_career() -> bool:
	var exported = campaigns.snapshot("career").result
	var before = weekends.snapshot("campaign-weekend").result
	var recording = weekends.recording("campaign-weekend").result
	check(
		exported.active_weekend.session == "campaign-weekend",
		"Active campaign export retains the actual process-local weekend identity"
	)
	check(
		exported.active_weekend.recording.record.event_id == recording.event_id,
		"Active export preserves the factual recording identity named by the manifest"
	)
	rejected(
		campaigns.restore("career", exported.checkpoint),
		"Raw active checkpoint without record",
		"INCOMPLETE_SNAPSHOT"
	)
	for key in ["recording", "checkpoint"]:
		var broken = exported.duplicate(true)
		if key == "recording":
			broken.active_weekend.recording = {}
		else:
			broken.checkpoint = {}
		rejected(campaigns.restore("career", broken), "Malformed active restore")
		same(
			campaigns.snapshot("career").result,
			exported,
			"Failed active restore preserves the entire campaign authority"
		)
		same(
			weekends.snapshot("campaign-weekend").result,
			before,
			"Failed active restore preserves the exact weekend authority"
		)
	var conflict = GameToolbox.new(catalog)
	accepted(
		conflict.weekends.create("campaign-weekend", configuration()),
		"Reserve a conflicting restore handle"
	)
	var occupied = conflict.weekends.snapshot("campaign-weekend").result
	rejected(
		conflict.campaigns.restore("conflict", exported),
		"Conflicting active restore handle",
		"SESSION_EXISTS"
	)
	same(
		conflict.weekends.snapshot("campaign-weekend").result,
		occupied,
		"Restore conflict preserves existing weekend authority"
	)
	conflict.close()
	resumed_toolbox = GameToolbox.new(catalog)
	var response = resumed_toolbox.execute(
		json_round_trip(
			{
				"protocol": "motorsport-manager-toolbox",
				"version": 1,
				"request_id": "resume-active",
				"operation": "campaign.restore",
				"session": "career",
				"arguments": {"snapshot": exported}
			}
		)
	)
	if not accepted(response, "Fresh toolbox restores the complete active campaign over JSON"):
		return false
	same(
		resumed_toolbox.campaigns.snapshot("career").result.checkpoint,
		exported.checkpoint,
		"Fresh active restore keeps the frozen campaign manifest"
	)
	same(
		resumed_toolbox.weekends.snapshot("campaign-weekend").result,
		before,
		"Mid-session active restore retains all RNG and sporting values"
	)
	var restored_record = resumed_toolbox.weekends.recording("campaign-weekend").result
	for key in [
		"event_id", "initial", "endpoint", "inputs", "steps", "marks", "parent", "manifest"
	]:
		same(
			restored_record[key],
			recording[key],
			"Mid-session production record continuation: " + key
		)
	var old_source = weekends.owned_record("campaign-weekend").source
	campaigns.close_all()
	weekends.close_all()
	check(
		old_source.get_ref() == null, "Discarding original tool owners releases the old active race"
	)
	campaigns = resumed_toolbox.campaigns
	weekends = resumed_toolbox.weekends
	return true


func protocol_parity() -> void:
	var toolbox = GameToolbox.new(catalog)
	var native = campaigns.create("protocol-career", "core.campaign.team-principal")
	var wire = dispatch(toolbox, "campaign.create", {"campaign_id": "core.campaign.team-principal"})
	if (
		not accepted(native, "Direct SDK parity career")
		or not accepted(wire, "Protocol parity career")
	):
		toolbox.close()
		return
	same(wire.result, native.result, "Native and JSON campaign creation")
	for view in ["overview", "finance", "personnel", "competition"]:
		same(
			dispatch(toolbox, "campaign.query", {"view": view}).result,
			campaigns.query("protocol-career", view).result,
			"Native and JSON campaign query: " + view
		)
	native = campaigns.advance("protocol-career")
	wire = dispatch(toolbox, "campaign.advance")
	same(wire.result, native.result, "Native and JSON dated progression")
	var before = campaigns.snapshot("protocol-career").result
	rejected(
		dispatch(toolbox, "campaign.restore", {"snapshot": {}}),
		"Protocol malformed campaign restore"
	)
	same(
		dispatch(toolbox, "campaign.snapshot").result,
		before,
		"Protocol failed restore retains authority"
	)
	toolbox.close()


func dispatch(toolbox: GameToolbox, operation: String, arguments: Dictionary = {}) -> Dictionary:
	var request = {
		"protocol": "motorsport-manager-toolbox",
		"version": 1,
		"request_id": "campaign-test",
		"operation": operation,
		"session": "protocol-career",
		"arguments": arguments
	}
	return json_round_trip(toolbox.execute(json_round_trip(request)))
