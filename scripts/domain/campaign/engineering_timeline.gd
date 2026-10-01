class_name CampaignEngineeringTimeline
extends RefCounted
## Published engineering evidence cannot originate after authoritative campaign time.

static func validate(engineering: Dictionary, elapsed_slot: int) -> String:
	var error = CampaignEngineering.validate(engineering)
	if not error.is_empty(): return error
	if not RaceCheckpoint.integral(elapsed_slot, 0, CampaignClock.MAX_ELAPSED_SLOTS) 			or int(engineering.authority_from_slot) > elapsed_slot:
		return "Campaign engineering has an invalid authoritative time boundary."
	for project in engineering.projects.values():
		if int(project.created_slot) > elapsed_slot:
			return "Campaign engineering project was created after authoritative campaign time."
	for design in engineering.designs.values():
		if int(design.validated_slot) > elapsed_slot:
			return "Campaign design was validated after authoritative campaign time."
	for part in engineering.parts.values():
		if int(part.produced_slot) > elapsed_slot or int(part.installed_slot) > elapsed_slot:
			return "Campaign physical part evidence is dated after authoritative campaign time."
	return ""
