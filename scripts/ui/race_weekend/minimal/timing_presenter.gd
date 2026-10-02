class_name MinimalRaceTimingPresenter
extends RefCounted
## Presentation-only timing table diff/reorder logic for the Minimal pitwall.
static func present(host) -> void:
	var rows = host.frame.timing_rows
	var timed = host.frame.phase in MinimalRaceTiming.TIMED
	var grid = host.frame.phase in MinimalRaceTiming.GRID
	host.tower.set_column_title(2, "BEST" if timed else ("GRID" if grid else "GAP"))
	host.timing_caption.text = "Best measured laps" if timed else ("Starting order" if grid else ("Final classification" if host.frame.phase == "results" else "Gap to leader"))
	host.tower.set_block_signals(true)
	var previous: TreeItem = null
	var reorder = not Input.is_mouse_button_pressed(MOUSE_BUTTON_LEFT)
	if reorder: host.rank_rows.clear()
	for data in rows:
		var item: TreeItem = host.items_by_id[data.id]
		var selected = data.id == host.selected_id
		if reorder:
			if previous == null:
				var first = host.tower.get_root().get_first_child()
				if item != first: item.move_before(first)
			elif previous.get_next() != item:
				item.move_after(previous)
			previous = item
			host.rank_rows.append(item)
		var key = [data, selected]
		if host.rendered_rows.get(data.id) != key:
			host.rendered_rows[data.id] = key
			host.table_updates += 1
			item.set_text(0, str(data.position))
			item.set_text(1, data.name)
			item.set_text(2, data.time)
			item.set_text(3, data.tag)
			for column in range(4):
				item.set_tooltip_text(column, data.tooltip)
				item.set_selectable(column, data.player)
				var color = MinimalRaceStyle.ACCENT if data.player else (MinimalRaceStyle.MUTED if column in [0, 3] else MinimalRaceStyle.TEXT)
				if column == 3 and data.tag in ["PIT", "BOX", "RET"]: color = MinimalRaceStyle.WARNING
				item.set_custom_color(column, color)
				item.set_custom_bg_color(column, MinimalRaceStyle.SELECTED if selected else (Color("1d3033") if data.player else MinimalRaceStyle.PANEL))
			if selected and not item.is_selected(0): item.select(0)
		if host.driver_cards.has(data.id):
			host.driver_cards[data.id].present(host.frame.readouts[data.id], data.position, selected)
	host.tower.set_block_signals(false)
