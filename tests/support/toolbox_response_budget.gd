extends RefCounted
## Real bounded execution retains receipts and reports mutation before an oversized response.


static func run(harness) -> void:
	var cap = 4096
	var toolbox = GameToolbox.new(
		harness.catalog, {"source_revision": "r".repeat(256), "source_digest": "d".repeat(256)}, cap
	)
	harness.check(
		(
			toolbox.metadata().source_revision.is_empty()
			and toolbox.metadata().source_digest.is_empty()
		),
		"Overlong caller labels remain bounded unknown source identity"
	)
	harness.accepted(toolbox.weekends.create("budget", harness.configuration()), "Budget weekend")
	harness.accepted(
		toolbox.campaigns.create("budget", "core.campaign.team-principal"), "Budget campaign"
	)
	var original: Dictionary = toolbox.campaigns.snapshot("budget").result.checkpoint
	var account: String = original.state.organization_id
	var expected = CampaignFinanceTransaction.set_reserve_policy(original, account, 50000)
	harness.check(expected.ok, "Original owner accepts the budgeted finance transaction")
	var before: Dictionary = toolbox.weekends.snapshot("budget").result
	var requests = [
		_request("prefix", "weekend.query", {"view": "state"}),
		_request(
			"overflow",
			"campaign.command",
			{
				"action": "finance.set_reserve_policy",
				"payload": {"account_id": account, "minimum_cash_minor": 50000}
			}
		),
		_request("later", "weekend.command", {"action": "pause"})
	]
	var response: Dictionary = toolbox.execute(
		_request("batch", "toolbox.batch", {"requests": requests, "stop_on_error": false}, "")
	)
	harness.accepted(response, "Oversized batch keeps bounded explicit receipts")
	var receipts: Array = response.result.responses
	harness.check(
		response.result.stopped and not response.result.atomic and receipts.size() == 3,
		"Response budget stops the non-atomic batch with every request accounted for"
	)
	harness.accepted(receipts[0], "Prior receipt survives response overflow")
	harness.same(
		receipts[0].result, toolbox.weekends.query("budget").result, "Accepted prefix state"
	)
	harness.rejected(receipts[1], "Current oversized receipt", "RESPONSE_LIMIT")
	harness.check(
		(
			receipts[1].request_id == "overflow"
			and receipts[1].error.details.executed
			and receipts[1].error.details.limit_bytes == cap
			and receipts[1].error.details.required_bytes > cap
		),
		"Oversized receipt is correlated and truthfully reports execution and byte bound"
	)
	harness.rejected(receipts[2], "Unexecuted later request", "SKIPPED")
	harness.check(
		receipts[2].request_id == "later" and not receipts[2].error.details.executed,
		"Later skipped receipt explicitly reports no execution"
	)
	harness.same(
		toolbox.campaigns.snapshot("budget").result.checkpoint,
		expected.checkpoint,
		"Finance mutation happened exactly once before its oversized receipt"
	)
	harness.same(toolbox.weekends.snapshot("budget").result, before, "Skipped pause never executes")
	harness.check(
		JSON.stringify(response, "", false, true).to_utf8_buffer().size() <= cap,
		"Whole correlated batch envelope fits the configured native byte bound"
	)
	var oversized: Dictionary = toolbox.execute(_request("single", "weekend.snapshot", {}))
	harness.rejected(oversized, "Single oversized snapshot receipt", "RESPONSE_LIMIT")
	harness.check(oversized.error.details.executed, "Single snapshot truthfully reports execution")
	harness.same(
		toolbox.weekends.snapshot("budget").result, before, "Rejected snapshot is read-only"
	)
	var created = toolbox.execute(
		_request(
			"create", "campaign.create", {"campaign_id": "core.campaign.team-principal"}, "new"
		)
	)
	harness.rejected(created, "Oversized create receipt", "RESPONSE_LIMIT")
	harness.check(created.error.details.executed, "Oversized create truthfully reports execution")
	harness.accepted(toolbox.campaigns.snapshot("new"), "Oversized create retains owned authority")
	var preflight: Array = []
	for index in range(128):
		preflight.append(
			_request(
				"preflight." + str(index),
				"campaign.command",
				{
					"action": "finance.set_reserve_policy",
					"payload": {"account_id": account, "minimum_cash_minor": 100000}
				}
			)
		)
	var reserved = toolbox.execute(
		_request("reserved", "toolbox.batch", {"requests": preflight}, "")
	)
	harness.rejected(reserved, "Unrepresentable receipt reservation", "RESPONSE_LIMIT")
	harness.check(
		not reserved.error.details.executed, "Batch reservation rejects before any child executes"
	)
	harness.same(
		toolbox.campaigns.snapshot("budget").result.checkpoint,
		expected.checkpoint,
		"Unrepresentable batch reservation cannot execute finance mutations"
	)
	toolbox.close()


static func _request(
	identity: String, operation: String, arguments: Dictionary, session: String = "budget"
) -> Dictionary:
	return {
		"protocol": GameToolbox.PROTOCOL,
		"version": 1,
		"request_id": identity,
		"operation": operation,
		"session": session,
		"arguments": arguments
	}
