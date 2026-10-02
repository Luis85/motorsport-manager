class_name CampaignEngineeringQuery
extends RefCounted
## Detached engineering/readiness projections; never mutates project, race, cash or time.

static func project(checkpoint: Dictionary, project_id: String) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok or not restored.engineering.projects.has(project_id):
		return {}
	return restored.engineering.projects[project_id].duplicate(true)

static func profile_for_car(checkpoint: Dictionary, car_id: String) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return {}
	return CampaignEngineering.performance_profile(restored.engineering, car_id)

static func race_profiles(checkpoint: Dictionary, mappings: Array) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return {"ok": false, "error": restored.error, "profiles": []}
	if not mappings is Array or mappings.size() < 2 or mappings.size() > CampaignWeekendManifest.MAX_ENTRANTS:
		return {"ok": false, "error": "Race profile mapping is invalid.", "profiles": []}
	var profiles: Array = []
	profiles.resize(mappings.size())
	var seen = {}
	for mapping in mappings:
		if not mapping is Dictionary 				or not RaceCheckpoint.integral(mapping.get("race_id"), 0, mappings.size() - 1) 				or not CampaignIdentity.valid(mapping.get("car_id")) 				or seen.has(int(mapping.race_id)):
			return {"ok": false, "error": "Race profile mapping does not cover unique race identities.", "profiles": []}
		seen[int(mapping.race_id)] = true
		var profile = CampaignEngineering.performance_profile(restored.engineering, mapping.car_id)
		if profile.is_empty():
			return {"ok": false, "error": "Campaign car performance could not be projected.", "profiles": []}
		profiles[int(mapping.race_id)] = profile
	if seen.size() != mappings.size() or not RacePerformanceProfile.validate_set(profiles, mappings.size()).is_empty():
		return {"ok": false, "error": "Race performance projection is incomplete.", "profiles": []}
	return {"ok": true, "error": "", "profiles": profiles,
		"checkpoint_digest": restored.checkpoint.digest}
