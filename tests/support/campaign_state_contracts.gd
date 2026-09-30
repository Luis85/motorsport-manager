class_name CampaignStateContracts
extends RefCounted
## Campaign contracts executed by the registered weekend_launch_tests suite.

static func run(check: Callable) -> void:
	CampaignIdentityClockContracts.run(check)
	CampaignCommandContracts.run(check)
	CampaignStorageContracts.run(check)
	CampaignSeasonContracts.run(check)
	CampaignCompetitionTransactionContracts.run(check)
	CampaignWeekendTransactionContracts.run(check)
