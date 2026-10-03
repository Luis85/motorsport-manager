class_name CampaignRivalQuery
extends RefCounted
## Detached rival summaries for the Director Desk/championship views.


static func summary(checkpoint: Dictionary) -> Dictionary:
	var restored = CampaignCheckpoint.restore(checkpoint)
	if not restored.ok:
		return {"ok": false, "error": restored.error, "teams": []}
	var rows: Array = []
	for team in restored.management.rivals.teams.values():
		rows.append(
			{
				"team_id": team.team_id,
				"entrant_id": team.entrant_id,
				"archetype": team.archetype,
				"cash_minor": int(team.cash_minor),
				"committed_minor": int(team.committed_minor),
				"capability_bps": int(team.capability_bps),
				"project": team.project,
				"next_review_slot": int(team.next_review_slot)
			}
		)
	rows.sort_custom(func(a, b): return a.team_id < b.team_id)
	return {
		"ok": true,
		"error": "",
		"teams": rows,
		"decision_cycles": restored.management.rivals.decision_cycles.duplicate(true),
		"source_digest": restored.management.digest
	}
