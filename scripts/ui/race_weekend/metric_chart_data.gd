class_name RaceMetricChartData
extends Control
## Observed sample domains and independent categories are never interchangeable.
## Null samples keep their original position. Inspection is UI-only and focus-stable.
var title = ""
var unit = ""
var series: Array = []
var comparison: Array = []
var comparison_name = ""
var minimum = 0.0
var maximum = 1.0
var categories: Array = []
var x_values: Array = []
var x_labels: Array = []
var domain = "Sample"
var mode = "trace"
var cursor = -1
var update_count = 0
var panel_style: StyleBoxFlat


static func finite_value(value: Variant) -> bool:
	return (typeof(value) == TYPE_FLOAT or typeof(value) == TYPE_INT) and is_finite(float(value))


static func padded_range(values: Array) -> Vector2:
	var valid: Array = []
	for value in values:
		if finite_value(value):
			valid.append(float(value))
	if valid.is_empty():
		return Vector2(0, 1)
	var low = float(valid.min())
	var high = float(valid.max())
	var pad = maxf((high - low) * 0.12, maxf(absf(high) * 0.002, 0.05))
	return Vector2(low - pad, high + pad)


func present(
	next_title: String, next_unit: String, next_series: Array, low: float, high: float
) -> void:
	_set_data(next_title, next_unit, next_series, low, high, [], "trace", {}, "Sample", {})


func present_samples(
	next_title: String,
	next_unit: String,
	values: Array,
	low: float,
	high: float,
	positions: Array,
	labels: Array = [],
	axis: String = "Elapsed s",
	secondary: Array = [],
	secondary_name: String = ""
) -> void:
	_set_data(
		next_title,
		next_unit,
		values,
		low,
		high,
		[],
		"trace",
		{"positions": positions, "labels": labels},
		axis,
		{"values": secondary, "name": secondary_name}
	)


func present_cases(
	next_title: String, labels: Array, values: Array, low: float = 0.0, high: float = 100.0
) -> void:
	_set_data(next_title, "% water", values, low, high, labels, "cases", {}, "Independent case", {})


func _set_data(
	next_title: String,
	next_unit: String,
	values: Array,
	low: float,
	high: float,
	labels: Array,
	next_mode: String,
	sample_domain: Dictionary,
	axis: String,
	secondary_data: Dictionary
) -> void:
	var positions: Array = sample_domain.get("positions", [])
	var sample_labels: Array = sample_domain.get("labels", [])
	var secondary: Array = secondary_data.get("values", [])
	var secondary_name: String = secondary_data.get("name", "")
	var safe_values: Array = []
	for i in range(maxi(values.size(), labels.size())):
		var value: Variant = values[i] if i < values.size() else null
		safe_values.append(float(value) if finite_value(value) else null)
	if not is_finite(low) or not is_finite(high):
		low = 0.0
		high = 1.0
	if high <= low:
		var bounds = padded_range([low])
		low = bounds.x
		high = bounds.y
	var safe_positions: Array = []
	if positions.size() == safe_values.size():
		for i in range(positions.size()):
			if (
				not finite_value(positions[i])
				or (i > 0 and float(positions[i]) < float(positions[i - 1]))
			):
				safe_positions.clear()
				break
			safe_positions.append(float(positions[i]))
	var safe_comparison: Array = []
	if not secondary_name.is_empty():
		for i in range(safe_values.size()):
			var value: Variant = secondary[i] if i < secondary.size() else null
			safe_comparison.append(float(value) if finite_value(value) else null)
	var safe_axis = axis if not safe_positions.is_empty() or next_mode == "cases" else "Sample"
	if (
		[
			title,
			unit,
			series,
			minimum,
			maximum,
			categories,
			mode,
			x_values,
			x_labels,
			domain,
			comparison,
			comparison_name
		]
		== [
			next_title,
			next_unit,
			safe_values,
			low,
			high,
			labels,
			next_mode,
			safe_positions,
			sample_labels,
			safe_axis,
			safe_comparison,
			secondary_name
		]
	):
		return
	var follow_latest = cursor < 0 or cursor == series.size() - 1
	title = next_title
	unit = next_unit
	series = safe_values
	minimum = low
	maximum = high
	categories = labels.duplicate()
	mode = next_mode
	x_values = safe_positions
	x_labels = sample_labels.duplicate()
	domain = safe_axis
	update_count += 1
	comparison = safe_comparison
	comparison_name = secondary_name
	call("_update_minimum")
	cursor = series.size() - 1 if follow_latest else clampi(cursor, -1, series.size() - 1)
	tooltip_text = (
		title
		+ (
			". Independent same-horizon stress cases; not probabilities or a timeline."
			if mode == "cases"
			else ". Recorded evidence; gaps are unavailable, not zero. No future prediction."
		)
		+ " Left/Right inspect; Home/End select first/latest."
	)
	accessibility_name = title
	call("_update_description")
	queue_redraw()


static func align_recordings(
	first_x: Array, first_y: Array, second_x: Array, second_y: Array
) -> Dictionary:
	# Exact common coordinates only: never interpolate an absent measurement.
	# Duplicate/invalid coordinates are ambiguous; preserve the unpaired first series.
	var maps: Array = []
	for pair in [[first_x, first_y], [second_x, second_y]]:
		if pair[0].size() != pair[1].size():
			return {}
		var values: Dictionary = {}
		for i in range(pair[0].size()):
			if not finite_value(pair[0][i]) or values.has(float(pair[0][i])):
				return {}
			values[float(pair[0][i])] = pair[1][i]
		maps.append(values)
	var positions = maps[0].keys()
	for at in maps[1]:
		if not positions.has(at):
			positions.append(at)
	positions.sort()
	return {
		"x": positions,
		"first": positions.map(func(at): return maps[0].get(at)),
		"second": positions.map(func(at): return maps[1].get(at))
	}
