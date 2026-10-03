class_name DeveloperCampaignQueries
extends RefCounted
## Explicit detached campaign read models; querying never publishes a checkpoint.
const VIEWS = [
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
	"delegation",
	"cash_forecast",
	"project",
	"car_profile",
	"work_order",
	"capacity_options"
]


static func schema(view: String) -> Dictionary:
	match view:
		"cash_forecast":
			return DeveloperFacetValues.object(
				{
					"account_id": ContentSchema.text(96),
					"through_slot": ContentSchema.integer(0, 9007199254740991),
					"assumptions": {"type": "array", "maxItems": 256}
				},
				["account_id", "through_slot"]
			)
		"project", "car_profile", "work_order":
			var key = {"project": "project_id", "car_profile": "car_id", "work_order": "order_id"}[view]
			return DeveloperFacetValues.object({key: ContentSchema.text(96)}, [key])
		"capacity_options":
			return DeveloperFacetValues.object(
				{
					"family": {"enum": CampaignCapacityResource.FAMILIES},
					"start_slot": ContentSchema.integer(0, 9007199254740991),
					"end_slot": ContentSchema.integer(0, 9007199254740991),
					"units": ContentSchema.integer(1, CampaignCapacityResource.MAX_UNITS)
				},
				["family", "start_slot", "end_slot", "units"]
			)
	return DeveloperFacetValues.object()


static func describe() -> Array:
	var result: Array = []
	for view in VIEWS:
		result.append({"view": view, "parameters": schema(view)})
	return result


static func query(checkpoint: Dictionary, view: String, parameters: Dictionary) -> Dictionary:
	match view:
		"overview":
			return CampaignDirectorQuery.overview(checkpoint)
		"readiness":
			return CampaignWeekendWorkflow.readiness(checkpoint)
		"finance":
			return CampaignFinancialPositionQuery.snapshot(checkpoint)
		"personnel":
			return CampaignPersonnelQuery.roster(checkpoint)
		"operations", "engineering", "competition", "management":
			return checkpoint.get(view, {}).duplicate(true)
		"rivals":
			return CampaignRivalQuery.summary(checkpoint)
		"commercial":
			return CampaignCommercialQuery.portfolio(checkpoint)
		"delegation":
			return CampaignDelegationQuery.summary(checkpoint)
		"cash_forecast":
			return CampaignFinanceQuery.cash_forecast(
				checkpoint,
				parameters.account_id,
				int(parameters.through_slot),
				parameters.get("assumptions", [])
			)
		"project":
			return CampaignEngineeringQuery.project(checkpoint, parameters.project_id)
		"car_profile":
			return CampaignEngineeringQuery.profile_for_car(checkpoint, parameters.car_id)
		"work_order":
			return CampaignOperationsQuery.work_order(checkpoint, parameters.order_id)
		"capacity_options":
			return CampaignOperationsQuery.capacity_options(
				checkpoint,
				parameters.family,
				int(parameters.start_slot),
				int(parameters.end_slot),
				int(parameters.units)
			)
	return {"ok": false, "error": "Unknown campaign view."}
