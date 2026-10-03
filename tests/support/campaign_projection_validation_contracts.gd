extends RefCounted
## Malformed nested JSON rows must reject without an engine exception or repair.
const CAMPAIGN = "campaign.validation"
const ORGANIZATION = "organization.validation"


static func run(check: Callable) -> void:
	for fixture in fixtures():
		var baseline: Dictionary = fixture.value
		var validator: Callable = fixture.validator
		check.call(validator.call(baseline).is_empty(), fixture.name + " baseline is valid")
		for path in fixture.paths:
			for invalid in [null, true, 7, "scalar", [], {}]:
				var broken = baseline.duplicate(true)
				var collection: Dictionary = broken
				for key in path:
					collection = collection[key]
				collection[ORGANIZATION] = invalid
				if broken.has("digest"):
					broken.erase("digest")
					broken.digest = RaceStateValue.fingerprint(broken)
				var before = RaceStateValue.fingerprint(broken)
				var label = fixture.name + "/" + "/".join(path) + "/" + str(invalid)
				check.call(not validator.call(broken).is_empty(), "Malformed row rejects: " + label)
				check.call(
					RaceStateValue.fingerprint(broken) == before,
					"Rejected validation preserves caller value: " + label
				)


static func fixtures() -> Array:
	var group = CampaignGroup.empty()
	# Leave room for the invalid prospect so capacity cannot mask its shape error.
	group.academy.capacity = 1
	return [
		{
			"name": "competition",
			"value": CampaignCompetition.empty(CAMPAIGN),
			"validator": CampaignCompetition.validate,
			"paths": [["series"], ["seasons"], ["events"]]
		},
		{
			"name": "economy",
			"value": CampaignEconomy.create(CAMPAIGN, ORGANIZATION, 1000),
			"validator": CampaignEconomy.validate,
			"paths": [["reserve_policies"], ["commitments"]]
		},
		{
			"name": "personnel",
			"value": CampaignPersonnel.empty(CAMPAIGN, ORGANIZATION),
			"validator": CampaignPersonnel.validate,
			"paths": [["people"], ["contracts"], ["assignments"], ["reservations"]]
		},
		{
			"name": "operations",
			"value": CampaignOperations.empty(CAMPAIGN, ORGANIZATION),
			"validator": CampaignOperations.validate,
			"paths": [["resources"], ["work_orders"], ["capacity_reservations"]]
		},
		{
			"name": "engineering",
			"value": CampaignEngineering.empty(CAMPAIGN, ORGANIZATION),
			"validator": CampaignEngineering.validate,
			"paths": [["projects"], ["designs"], ["parts"]]
		},
		{
			"name": "delegation",
			"value": CampaignDelegation.empty(),
			"validator": CampaignDelegation.validate,
			"paths": [["mandates"]]
		},
		{
			"name": "rivals",
			"value": CampaignRivals.empty(),
			"validator": CampaignRivals.validate,
			"paths": [["teams"]]
		},
		{
			"name": "group",
			"value": group,
			"validator": CampaignGroup.validate,
			"paths":
			[["business_orders"], ["academy", "prospects"], ["eras"], ["dynasty", "legacy_goals"]]
		},
		{
			"name": "people_development",
			"value": CampaignPeopleDevelopment.empty(),
			"validator": CampaignPeopleDevelopment.validate,
			"paths": [["candidates"], ["profiles"], ["plans"], ["promises"]]
		},
		{
			"name": "supply",
			"value": CampaignSupplyNetwork.empty(),
			"validator": CampaignSupplyNetwork.validate,
			"paths":
			[["suppliers"], ["orders"], ["materials"], ["project_evidence"], ["part_service"]]
		}
	]
