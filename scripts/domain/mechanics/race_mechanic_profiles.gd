class_name RaceMechanicProfiles
extends RefCounted
## One explicit composition root for supported rule profiles and their save readers.
## Edit this catalog for NEW sessions. Running sessions cannot hot-swap rule providers.
const ORDER: Array[String] = ["strategy", "weather", "recovery", "practice"]

static func build(profile: String, selection: MechanicProfileDefinition = null) -> Array[RaceMechanic]:
	if selection != null:
		return selection.providers(profile)
	var providers: Array[RaceMechanic] = []
	var through = ORDER.find(profile)
	if through < 0:
		return providers
	for identity in ORDER.slice(0, through + 1):
		providers.append(registered(identity))
	return providers

static func registered(identity: String) -> RaceMechanic:
	# Only engine-reviewed providers. Never interpret a content string as a path.
	match identity:
		"strategy": return StrategyMechanic.new()
		"weather": return WeatherMechanic.new()
		"recovery": return RecoveryMechanic.new()
		"practice": return PracticeMechanic.new()
	return null
