class_name CampaignStateContracts
extends RefCounted
## Campaign contracts executed by the registered weekend_launch_tests suite.

static func run(check: Callable) -> void:
	CampaignIdentityClockContracts.run(check)
	CampaignCommandContracts.run(check)
	CampaignStorageContracts.run(check)
	CampaignSeasonContracts.run(check)
	CampaignCompetitionIdentityContracts.run(check)
	CampaignCompetitionTransactionContracts.run(check)
	CampaignFinanceContracts.run(check)
	CampaignFinanceTimelineContracts.run(check)
	CampaignPersonnelContracts.run(check)
	CampaignPersonnelLifecycleContracts.run(check)
	CampaignOperationsContracts.run(check)
	CampaignWeekendFinanceContracts.run(check)
	CampaignWeekendTransactionContracts.run(check)
