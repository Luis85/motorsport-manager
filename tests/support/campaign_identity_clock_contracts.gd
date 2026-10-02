class_name CampaignIdentityClockContracts
extends RefCounted

static func run(check: Callable) -> void:
	check.call(CampaignIdentity.valid("organization.obsidian-works") and CampaignIdentity.valid("person.01"), "Campaign identities accept bounded inert stable keys")
	check.call(not CampaignIdentity.valid("") and not CampaignIdentity.valid("../campaign") and not CampaignIdentity.valid("person name"), "Campaign identities reject paths, whitespace and empty values")
	var leap = CampaignClock.create({"year": 1952, "month": 2, "day": 28, "slot": 95})
	check.call(leap != null and leap.advance(1) and leap.day_key() == "1952-02-29" and leap.slot_of_day == 0, "Campaign clock crosses into leap day in one fifteen-minute step")
	check.call(leap.advance(96) and leap.day_key() == "1952-03-01" and leap.slot_of_day == 0, "Campaign clock advances complete days without wall-clock input")
	check.call(CampaignClock.create({"year": 1951, "month": 2, "day": 29, "slot": 0}) == null, "Campaign clock rejects invalid civil dates")
	var batch = CampaignClock.create({"year": 1950, "month": 1, "day": 1, "slot": 37})
	var stepped = CampaignClock.create({"year": 1950, "month": 1, "day": 1, "slot": 37})
	batch.advance(211)
	for index in range(211): stepped.advance(1)
	check.call(batch.snapshot() == stepped.snapshot(), "Campaign clock produces the same date from one batch or equal individual slots")
	var restored = CampaignClock.restore(batch.snapshot())
	check.call(restored != null and restored.snapshot() == batch.snapshot(), "Campaign clock snapshot restores exactly")
