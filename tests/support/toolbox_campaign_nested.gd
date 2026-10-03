extends RefCounted
## Malformed nested documents reject before container methods; both SDK surfaces stay alive.


static func run(harness, toolbox: GameToolbox) -> void:
	if not harness.accepted(
		toolbox.campaigns.create("nested", "core.campaign.team-principal"),
		"Create the malformed nested-document authority"
	):
		toolbox.close()
		return
	var initial: Dictionary = toolbox.campaigns.snapshot("nested").result
	var owner: String = initial.checkpoint.personnel.people.keys()[0]
	var cases = [
		["personnel.register_person", "eligible_roles"],
		["people.register_candidate", "eligible_roles"],
		["people.register_candidate", "attributes"],
		["people.register_candidate", "preferences"],
		["engineering.create_project", "profile_delta"],
		["delegation.create_mandate", "allowed_categories"],
		["delegation.create_mandate", "protected_ids"],
		["commercial.sign_agreement", "guaranteed_payments"],
		["commercial.sign_agreement", "appearances"],
		["commercial.sign_agreement", "bonus_terms"],
		["rival.register_team", "person_ids"],
		["rival.register_team", "car_ids"],
		["rival.register_team", "policy"],
		["group.initialize", "capabilities"]
	]
	var index = 0
	for row in cases:
		for scalar in [1, null]:
			var payload = {"input": {"id": "nested.invalid", "owner_person_id": owner}}
			payload.input[row[1]] = scalar
			if row[0] == "group.initialize":
				payload = {"parent_cash_minor": 0, "era": {"capabilities": scalar}}
			var label = str(row[0]) + " scalar " + str(row[1]) + " " + str(scalar)
			harness.rejected(
				toolbox.campaigns.command("nested", row[0], payload), label, "DOMAIN_REJECTED"
			)
			harness.same(
				toolbox.campaigns.snapshot("nested").result, initial, label + " SDK atomic"
			)
			var request = {
				"protocol": GameToolbox.PROTOCOL,
				"version": GameToolbox.VERSION,
				"request_id": "nested." + str(index),
				"operation": "campaign.command",
				"session": "nested",
				"arguments": {"action": row[0], "payload": payload}
			}
			var decoded = ContentJson.parse(JSON.stringify(request, "", false, true), true)
			harness.check(decoded.ok, label + " strict transport document")
			harness.rejected(toolbox.execute(decoded.data), label + " JSON", "DOMAIN_REJECTED")
			harness.same(
				toolbox.campaigns.snapshot("nested").result, initial, label + " JSON atomic"
			)
			index += 1
	for scalar in [1, null, "invalid"]:
		var malformed: Dictionary = initial.checkpoint.duplicate(true)
		var season: Dictionary = malformed.competition.seasons.values()[0]
		season.entries[season.entries.keys()[0]] = scalar
		harness.rejected(
			toolbox.campaigns.restore("nested", malformed),
			"Scalar season entry restore",
			"DOMAIN_REJECTED"
		)
		harness.same(
			toolbox.campaigns.snapshot("nested").result, initial, "Rejected entry restore SDK"
		)
		var request = {
			"protocol": GameToolbox.PROTOCOL,
			"version": 1,
			"request_id": "restore." + str(index),
			"operation": "campaign.restore",
			"session": "nested",
			"arguments": {"snapshot": malformed}
		}
		var decoded = ContentJson.parse(JSON.stringify(request, "", false, true), true)
		harness.check(decoded.ok, "Malformed entry remains structurally valid JSON")
		harness.rejected(
			toolbox.execute(decoded.data), "Scalar entry restore JSON", "DOMAIN_REJECTED"
		)
		harness.same(
			toolbox.campaigns.snapshot("nested").result, initial, "Rejected entry restore JSON"
		)
		index += 1
	engineering_profile_contracts(harness)
	toolbox.close()


static func engineering_profile_contracts(harness) -> void:
	var project = CampaignEngineeringProject.build(
		{
			"id": "nested.project",
			"title": "Nested profile",
			"domain": "power_delivery",
			"target_car_id": "nested.car",
			"profile_delta": {"top": 0},
			"material_cost_minor": 1
		},
		0
	)
	harness.check(not project.is_empty(), "Original valid engineering project fixture")
	var design = CampaignEngineeringDesign.build(project, 0, "nested.order")
	harness.check(not design.is_empty(), "Original validated design fixture")
	for record in [project, design]:
		var original: Dictionary = record.duplicate(true)
		for scalar in [1, null]:
			var malformed: Dictionary = record.duplicate(true)
			malformed.profile_delta = scalar
			var error = (
				CampaignEngineeringProject.validate(malformed)
				if record == project
				else CampaignEngineeringDesign.validate(malformed)
			)
			harness.check(
				not error.is_empty(), "Malformed engineering profile rejects without cast errors"
			)
			harness.same(record, original, "Engineering validation retains its source record")
