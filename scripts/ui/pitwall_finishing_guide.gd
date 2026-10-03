class_name PitwallFinishingGuide
extends RefCounted


## Final guide customization for the composed Advanced pitwall. Guide copy and
## reveal targets are presentation concerns and do not own race authority.
static func configure(host) -> void:
	host.guide.placement_region = _placement_region.bind(host)
	host.guide.steps[0].target = func(): return host.car_cards[host.sim.player_ids()[0]].name_label
	host.guide.steps[0].reveal = func(): host.close_detail()
	host.guide.steps[1].title = "Keep time under your control"
	host.guide.steps[1].body = (
		"The fixed header identifies this event, session, observed flag and weather. "
		+ "Pause and speed are separate from the next session approval. Opening a guide, "
		+ "reviewing a car or inspecting a chart never changes either. Space pauses; 1–5 "
		+ "selects speed from non-editing controls."
	)
	host.guide.steps[1].target = func(): return host.session_header
	host.guide.steps[1].reveal = func(): host.close_detail()
	host.guide.steps[3].body = (
		"Plan stages a driver-owned starting set and zero to three stop windows. "
		+ "Fitted-to-draft changes and validation stay visible. Approve delegates timing "
		+ "within those accepted windows; it does not fit tyres or create an immediate "
		+ "physical Box order. Rejected drafts keep the current plan."
	)
	host.guide.steps.append(
		{
			"title": "Stage five setup trade-offs",
			"body":
			(
				"Setup has wing, balance, suspension, cooling and brake bias. Sliders and "
				+ "numeric fields edit the same per-driver draft. Each axis shows fitted → draft; "
				+ "estimates hold current tyres and surface constant. Apply is explicit and legal "
				+ "only in the garage or preparation. Live brake bias is a separate race command."
			),
			"target": func(): return host.racecraft,
			"reveal": func(): host.open_topic(4)
		}
	)
	host.guide.steps.append(
		{
			"title": "Fitted is not planned",
			"body":
			(
				"Tyres shows the fitted finite set, its limiting wheel and the planned "
				+ "replacement. A puncture takes precedence over an average percentage. Selection "
				+ "does not renew or fit a set; release, formation and physical service use the "
				+ "existing ownership and inventory rules."
			),
			"target": func(): return host.tyre_readout,
			"reveal": _reveal_guide_0.bind(host)
		}
	)
	host.guide.steps.append(
		{
			"title": "Review each issue, then confirm",
			"body":
			(
				"The stable two-driver queue counts every unacknowledged issue. Choose an issue "
				+ "inside the drawer to review its evidence and exact driver. Confirmation sends "
				+ "only the reviewed action; accepted, executing and completed are different. "
				+ "Refresh stale evidence explicitly. Nothing pauses automatically."
			),
			"target": func(): return host.decision_drawer,
			"reveal": func(): host.open_decision(host.sim.player_ids()[0])
		}
	)
	host.guide.steps.append(
		{
			"title": "Read recorded evidence",
			"body":
			(
				"Telemetry offers four recorded channels, a time range and your teammate's "
				+ "compatible samples. Solid circles and dashed squares retain missing values as "
				+ "gaps. Arrow keys inspect samples; inspection never issues a command. Full view "
				+ "opens the same controls in a larger workspace."
			),
			"target": func(): return host.telemetry_inspector,
			"reveal": func(): host.open_topic(1)
		}
	)
	host.guide.steps.append(
		{
			"title": "Two cars, one physical box",
			"body":
			(
				"Team / Pit box shows actual approach, entry, queue, service and exit. "
				+ "Cancellation ends at entry. The whole-car service timer is not pit-lane time or "
				+ "per-wheel progress. Team / Plans inspects accepted windows and existing bounded "
				+ "overrides; it does not schedule new commands."
			),
			"target": func(): return host.team_panel.service_view,
			"reveal": _reveal_guide_1.bind(host)
		}
	)
	host.guide.steps.append(
		{
			"title": "Keep the result and the experiment separate",
			"body":
			(
				"Session results retain measured classifications, laps, fitted stints and "
				+ "decision evidence. Original result acceptance remains explicit in Debrief. "
				+ "Replays and sandbox experiments cannot overwrite or settle the original. Export "
				+ "and notebook routes retain that provenance."
			),
			"target": func(): return host.results_workspace,
			"reveal": func(): host.open_results_workspace()
		}
	)
	host.guide.steps.append(
		{
			"title": "Expand the task, not the draft",
			"body":
			(
				"Full view expands the current analysis task, retaining the same controls, "
				+ "per-driver drafts and explicit action footer. Both drivers remain reachable "
				+ "above it. Back to pit wall restores the original inspector; neither transition "
				+ "changes playback speed or orders."
			),
			"target": func(): return host.analysis_workspace.heading,
			"reveal": _reveal_analysis_guide.bind(host)
		}
	)


static func _reveal_guide_0(host: Control) -> void:
	host.open_topic(3)
	host.show_tyres(0)


static func _reveal_guide_1(host: Control) -> void:
	host.open_topic(8)
	host.team_panel.show_topic(2)


static func _placement_region(host: Control) -> Rect2:
	if (
		is_instance_valid(host.full_workspace)
		and host.full_workspace is RacePracticeWorkspace
		and host.full_workspace.visible
	):
		return host.full_workspace.panels[host.sim.player_ids()[0]].scroll.get_global_rect()
	if is_instance_valid(host.full_workspace) and host.full_workspace.visible:
		return Rect2(
			host.full_workspace.global_position + Vector2(0, 96),
			Vector2(host.size.x * 0.45, maxf(230, host.full_workspace.size.y - 165))
		)
	var observation = host.canvas.get_global_rect()
	if observation.size.y < 230.0 * host.text_scale:
		var top = host.race_workspace.get_global_rect().position.y
		observation.size.y += observation.position.y - top
		observation.position.y = top
	return observation


static func _reveal_analysis_guide(host: Control) -> void:
	host.open_topic(1)
	host.open_analysis_workspace()
