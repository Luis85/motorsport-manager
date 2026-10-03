class_name EntrantIdentity
extends RefCounted


## Pure identity projection for typed entrants and detached presentation records.
static func players(cars: Array) -> Array:
	var ids: Array = []
	for car in cars:
		if car.player:
			ids.append(int(car.id))
	return ids


static func team(car: Variant) -> String:
	return str(car.get("team_key", car.get("team", ""))) if car is Dictionary else car.team


static func same_team(left: Variant, right: Variant) -> bool:
	return team(left) == team(right)
