class_name RaceMechanicProfiles
extends RefCounted
## One explicit composition root for supported rule profiles and their save readers.
## Edit this catalog for NEW sessions. Running sessions cannot hot-swap rule providers.
const ORDER: Array[String] = ["strategy", "weather", "recovery", "practice"]

static func build(profile: String) -> Array[RaceMechanic]:
	var providers: Array[RaceMechanic] = []
	var through = ORDER.find(profile)
	if through < 0:
		return providers
	for identity in ORDER.slice(0, through + 1):
		match identity:
			"strategy": providers.append(StrategyMechanic.new())
			"weather": providers.append(WeatherMechanic.new())
			"recovery": providers.append(RecoveryMechanic.new())
			"practice": providers.append(PracticeMechanic.new())
	return providers
