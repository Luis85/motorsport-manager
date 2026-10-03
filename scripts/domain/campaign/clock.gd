class_name CampaignClock
extends RefCounted
## Deterministic civil calendar expressed in dated fifteen-minute slots.
const KIND = "motorsport-manager-campaign-clock"
const VERSION = 1
const SLOT_MINUTES = 15
const SLOTS_PER_DAY = 96
const MIN_YEAR = 1900
const MAX_YEAR = 2399
const MAX_ELAPSED_SLOTS = SLOTS_PER_DAY * 366 * 200

var start_year: int
var start_month: int
var start_day: int
var start_slot: int
var year: int
var month: int
var day: int
var slot_of_day: int
var elapsed_slots: int = 0


static func create(start: Dictionary) -> CampaignClock:
	if not _valid_point(start):
		return null
	var result = CampaignClock.new()
	result.start_year = int(start.year)
	result.start_month = int(start.month)
	result.start_day = int(start.day)
	result.start_slot = int(start.slot)
	result.year = result.start_year
	result.month = result.start_month
	result.day = result.start_day
	result.slot_of_day = result.start_slot
	return result


func advance(slots: int) -> bool:
	if slots < 0 or elapsed_slots + slots > MAX_ELAPSED_SLOTS:
		return false
	var total = slot_of_day + slots
	var days = int(total / SLOTS_PER_DAY)
	var projected = _date_after_days(year, month, day, days)
	if projected.is_empty():
		return false
	year = projected.year
	month = projected.month
	day = projected.day
	slot_of_day = total % SLOTS_PER_DAY
	elapsed_slots += slots
	return true


func day_key() -> String:
	return "%04d-%02d-%02d" % [year, month, day]


func snapshot() -> Dictionary:
	return {
		"kind": KIND,
		"version": VERSION,
		"start": {"year": start_year, "month": start_month, "day": start_day, "slot": start_slot},
		"current": {"year": year, "month": month, "day": day, "slot": slot_of_day},
		"elapsed_slots": elapsed_slots
	}


static func validate(data: Variant) -> String:
	if not data is Dictionary or data.size() != 5:
		return "Campaign clock has an unsupported shape."
	if (
		data.get("kind") != KIND
		or not RaceCheckpoint.integral(data.get("version"), VERSION, VERSION)
	):
		return "Unsupported campaign clock format."
	if not _valid_point(data.get("start")) or not _valid_point(data.get("current")):
		return "Campaign clock has an invalid civil date or slot."
	if not RaceCheckpoint.integral(data.get("elapsed_slots"), 0, MAX_ELAPSED_SLOTS):
		return "Campaign elapsed time is invalid."
	var expected = create(data.start)
	if expected == null or not expected.advance(int(data.elapsed_slots)):
		return "Campaign clock exceeds its supported calendar range."
	if (
		expected.year != int(data.current.year)
		or expected.month != int(data.current.month)
		or expected.day != int(data.current.day)
		or expected.slot_of_day != int(data.current.slot)
	):
		return "Campaign clock date disagrees with its elapsed slots."
	return ""


static func restore(data: Variant) -> CampaignClock:
	if not validate(data).is_empty():
		return null
	var result = create(data.start)
	return result if result.advance(int(data.elapsed_slots)) else null


static func _valid_point(value: Variant) -> bool:
	if not value is Dictionary or value.size() != 4:
		return false
	if not RaceCheckpoint.integral(value.get("year"), MIN_YEAR, MAX_YEAR):
		return false
	if not RaceCheckpoint.integral(value.get("month"), 1, 12):
		return false
	var year_value = int(value.year)
	var month_value = int(value.month)
	if not RaceCheckpoint.integral(value.get("day"), 1, _days_in_month(year_value, month_value)):
		return false
	return RaceCheckpoint.integral(value.get("slot"), 0, SLOTS_PER_DAY - 1)


static func _date_after_days(
	year_value: int, month_value: int, day_value: int, days: int
) -> Dictionary:
	var next_year = year_value
	var next_month = month_value
	var next_day = day_value
	var remaining = days
	while remaining > 0:
		var left_in_month = _days_in_month(next_year, next_month) - next_day
		if remaining <= left_in_month:
			next_day += remaining
			remaining = 0
		else:
			remaining -= left_in_month + 1
			next_day = 1
			next_month += 1
			if next_month > 12:
				next_month = 1
				next_year += 1
				if next_year > MAX_YEAR:
					return {}
	return {"year": next_year, "month": next_month, "day": next_day}


static func _days_in_month(year_value: int, month_value: int) -> int:
	if month_value == 2:
		return 29 if _leap_year(year_value) else 28
	return 30 if month_value in [4, 6, 9, 11] else 31


static func _leap_year(year_value: int) -> bool:
	return year_value % 4 == 0 and (year_value % 100 != 0 or year_value % 400 == 0)
