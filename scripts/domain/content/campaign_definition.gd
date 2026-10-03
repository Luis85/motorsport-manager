class_name CampaignDefinition
extends RefCounted
## Authorable Team Principal campaign profile. Algorithms and safety bounds remain
## code-owned; identities, starting resources, calendar, staff, facilities and tuning are data.
const MAX_MONEY_MINOR = 1000000000
const MAX_DAYS = 3660
var id: String:
	get:
		return _record.id
var weekend_id: String:
	get:
		return _record.weekend_id
var is_default: bool:
	get:
		return bool(_record.default)

var _record: Dictionary = {}


static func fields() -> Dictionary:
	var contract = ContentSchema.object(
		{
			"duration_days": ContentSchema.integer(1, MAX_DAYS),
			"pay_interval_days": ContentSchema.integer(1, 366),
			"renewal_window_days": ContentSchema.integer(1, MAX_DAYS),
			"pay_minor": ContentSchema.integer(1, MAX_MONEY_MINOR),
			"allocation_bps": ContentSchema.integer(1, 10000)
		}
	)
	var rival = ContentSchema.object(
		{
			"roster_team_id": ContentSchema.identity(),
			"entrant_id": ContentSchema.identity(),
			"team_id": ContentSchema.identity(),
			"archetype": {"enum": CampaignRivals.ARCHETYPES},
			"cash_minor": ContentSchema.integer(0, MAX_MONEY_MINOR),
			"reserve_minor": ContentSchema.integer(0, MAX_MONEY_MINOR),
			"capability_bps": ContentSchema.integer(5000, CampaignRivals.MAX_CAPABILITY_BPS),
			"review_interval_days": ContentSchema.integer(1, 366)
		}
	)
	return {
		"default": {"type": "boolean"},
		"weekend_id": ContentSchema.identity(),
		"career":
		ContentSchema.object(
			{
				"campaign_id": ContentSchema.identity(),
				"organization_id": ContentSchema.identity(),
				"principal_id": ContentSchema.identity(),
				"start":
				ContentSchema.object(
					{
						"year": ContentSchema.integer(1900, 2200),
						"month": ContentSchema.integer(1, 12),
						"day": ContentSchema.integer(1, 31),
						"slot": ContentSchema.integer(0, CampaignClock.SLOTS_PER_DAY - 1)
					}
				),
				"energy_capacity": ContentSchema.integer(1, 24),
				"opening_cash_minor": ContentSchema.integer(0, MAX_MONEY_MINOR),
				"reserve_minor": ContentSchema.integer(0, MAX_MONEY_MINOR)
			}
		),
		"series":
		ContentSchema.object(
			{
				"series_id": ContentSchema.identity(),
				"season_id": ContentSchema.identity(),
				"name": ContentSchema.text(80),
				"cars_per_entrant":
				ContentSchema.integer(1, CampaignSeriesRules.MAX_CARS_PER_ENTRANT),
				"points_by_position":
				ContentSchema.array(
					ContentSchema.integer(0, CampaignSeriesRules.MAX_POINTS),
					CampaignWeekendReceipt.MAX_ENTRANTS,
					1
				)
			}
		),
		"calendar":
		ContentSchema.array(
			ContentSchema.object(
				{
					"campaign_event_id": ContentSchema.identity(),
					"circuit_id": ContentSchema.identity(),
					"round": ContentSchema.integer(1, CampaignSeriesRules.MAX_EVENTS),
					"departure_day": ContentSchema.integer(0, MAX_DAYS),
					"return_day": ContentSchema.integer(1, MAX_DAYS),
					"event_revision": ContentSchema.integer(1, 1000000)
				}
			),
			CampaignSeriesRules.MAX_EVENTS,
			1
		),
		"player":
		ContentSchema.object(
			{
				"roster_team_id": ContentSchema.identity(),
				"entrant_id": ContentSchema.identity(),
				"team_id": ContentSchema.identity(),
				"driver_role_id": {"enum": CampaignRoleAssignment.ROLES},
				"driver_contract": contract,
				"operations_lead":
				ContentSchema.object(
					{
						"person_id": ContentSchema.identity(),
						"display_name": ContentSchema.text(80),
						"role_id": {"enum": CampaignRoleAssignment.ROLES},
						"contract": contract
					}
				)
			}
		),
		"facilities":
		ContentSchema.array(
			ContentSchema.object(
				{
					"id": ContentSchema.identity(),
					"display_name": ContentSchema.text(80),
					"family": {"enum": CampaignCapacityResource.FAMILIES},
					"capacity_units": ContentSchema.integer(1, CampaignCapacityResource.MAX_UNITS),
					"available_days": ContentSchema.integer(1, MAX_DAYS)
				}
			),
			32,
			1
		),
		"rivals": ContentSchema.array(rival, CampaignSeriesRules.MAX_ENTRANTS - 1, 1),
		"rival_policy": CampaignRivalPolicy.fields(),
		"people_policy": CampaignPeoplePolicy.fields(),
		"supply_policy": CampaignSupplyPolicy.fields(),
		"event_finance":
		ContentSchema.object(
			{
				"departure_cost_minor": ContentSchema.integer(0, MAX_MONEY_MINOR),
				"participation_minor": ContentSchema.integer(0, MAX_MONEY_MINOR),
				"position_bonus_minor":
				ContentSchema.array(
					ContentSchema.integer(0, MAX_MONEY_MINOR),
					CampaignWeekendReceipt.MAX_ENTRANTS,
					1
				)
			}
		)
	}


static func tuning_fields() -> Dictionary:
	return ContentSchema.object({"finance": CampaignFinanceBalance.fields()})


static func from_record(record: Variant) -> CampaignDefinition:
	if (
		not record is Dictionary
		or not ContentValidation.check(record, ContentSchema.definition("campaign")).is_empty()
	):
		return null
	if not semantic_error(record).is_empty():
		return null
	var value = CampaignDefinition.new()
	value._record = RaceStateValue.read_only(record)
	return value


static func semantic_error(record: Dictionary) -> String:
	if CampaignClock.create(record.career.start) == null:
		return "Campaign start must be a valid civil date and slot."
	if record.player.entrant_id == record.player.team_id:
		return "Campaign player entrant and team identities must be distinct."
	for contract in [record.player.driver_contract, record.player.operations_lead.contract]:
		var contract_error = _contract_error(contract)
		if not contract_error.is_empty():
			return contract_error
	if int(record.career.reserve_minor) > int(record.career.opening_cash_minor):
		return "Campaign reserve cannot exceed opening cash."
	var points_error = _points_error(record)
	if not points_error.is_empty():
		return points_error
	var calendar_error = _calendar_error(record)
	if not calendar_error.is_empty():
		return calendar_error
	var rivals_error = _rivals_error(record)
	if not rivals_error.is_empty():
		return rivals_error
	var facilities = {}
	for facility in record.facilities:
		if facilities.has(facility.id):
			return "Campaign facility identities must be unique."
		facilities[facility.id] = true
	if not CampaignRivalPolicy.valid(record.rival_policy):
		return "Campaign rival policy is invalid."
	if not CampaignPeoplePolicy.valid(record.people_policy):
		return "Campaign people policy is invalid."
	if not CampaignSupplyPolicy.valid(record.supply_policy):
		return "Campaign supply policy is invalid."
	return ""


static func _contract_error(contract: Dictionary) -> String:
	var duration = int(contract.duration_days)
	var interval = int(contract.pay_interval_days)
	if duration % interval != 0:
		return "Campaign starter contracts must contain complete payroll intervals."
	if int(duration / interval) > CampaignEmploymentContract.MAX_INSTALLMENTS:
		return "Campaign starter contract has too many payroll installments."
	if int(contract.renewal_window_days) > duration:
		return "Campaign starter renewal window cannot exceed contract duration."
	return ""


func to_record() -> Dictionary:
	return _record.duplicate(true)


static func _calendar_error(record: Dictionary) -> String:
	var event_ids = {}
	var expected_round = 1
	var previous_departure = -1
	for event in record.calendar:
		if event_ids.has(event.campaign_event_id) or int(event.round) != expected_round:
			return "Campaign calendar identities and round order must be unique and sequential."
		if (
			int(event.departure_day) <= previous_departure
			or int(event.return_day) <= int(event.departure_day)
		):
			return "Campaign calendar dates must move forward and return after departure."
		event_ids[event.campaign_event_id] = true
		previous_departure = int(event.departure_day)
		expected_round += 1
	return ""


static func _rivals_error(record: Dictionary) -> String:
	var identities = {record.player.entrant_id: true, record.player.team_id: true}
	var roster_teams = {record.player.roster_team_id: true}
	for rival in record.rivals:
		if int(rival.reserve_minor) > int(rival.cash_minor):
			return "Campaign rival reserve cannot exceed its opening cash."
		if roster_teams.has(rival.roster_team_id):
			return "Campaign roster-team mappings must be unique."
		roster_teams[rival.roster_team_id] = true
		for key in ["entrant_id", "team_id"]:
			if identities.has(rival[key]):
				return "Campaign entrant and team identities must be unique."
			identities[rival[key]] = true
	return ""


static func _points_error(record: Dictionary) -> String:
	if record.series.points_by_position.size() != record.event_finance.position_bonus_minor.size():
		return "Campaign points and position-bonus tables must cover the same positions."
	var previous = CampaignSeriesRules.MAX_POINTS
	for points in record.series.points_by_position:
		if int(points) > previous:
			return "Campaign points must not increase for a lower position."
		previous = int(points)
	if int(record.series.points_by_position[0]) <= 0:
		return "Campaign must award points to the winner."
	return ""
