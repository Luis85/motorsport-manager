class_name CampaignStateContracts
extends RefCounted
## Campaign contracts executed by the registered weekend_launch_tests suite.


static func run(check: Callable) -> void:
	CampaignIdentityClockContracts.run(check)
	CampaignCommandContracts.run(check)
	CampaignStorageContracts.run(check)
	preload("res://tests/support/campaign_migration_contracts.gd").run(check)
	preload("res://tests/support/campaign_projection_validation_contracts.gd").run(check)
	CampaignSeasonContracts.run(check)
	CampaignCompetitionIdentityContracts.run(check)
	CampaignCompetitionTransactionContracts.run(check)
	CampaignFinanceContracts.run(check)
	CampaignFinanceTimelineContracts.run(check)
	CampaignPersonnelContracts.run(check)
	CampaignPersonnelLifecycleContracts.run(check)
	CampaignOperationsContracts.run(check)
	CampaignEngineeringContracts.run(check)
	CampaignReadinessContracts.run(check)
	CampaignCommercialContracts.run(check)
	CampaignDelegationContracts.run(check)
	CampaignRivalContracts.run(check)
	CampaignDirectorContracts.run(check)
	CampaignPeopleDepthContracts.run(check)
	CampaignSeasonProgressionContracts.run(check)
	CampaignOperationalDepthContracts.run(check)
	CampaignGroupContracts.run(check)
	CampaignCorrectionContracts.run(check)
	CampaignWeekendFinanceContracts.run(check)
	CampaignWeekendTransactionContracts.run(check)
