class_name RaceDecisionQueue
extends PanelContainer
## Stable driver slots: neither priority changes nor acknowledgement move a focused button.
signal review_requested(id: int)
signal hold_requested(id: int)
var slots: Dictionary = {}
var count: Label
var entries: Dictionary = {}
var update_count = 0
var pending_count = 0

func _ready() -> void:
	add_theme_stylebox_override("panel", UI.box(PitwallDesign.RACE_CREAM, UI.LINE, 5, 6))
	var row = UI.hbox(self)
	count = UI.label("DECISIONS  0", 11, UI.ACCENT); row.add_child(count)
	for id in [3,6]:
		var group = UI.hbox(row); group.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var badge = RaceStatusBadge.new(); group.add_child(badge)
		var review = UI.button("", func(): review_requested.emit(id)); group.add_child(review)
		review.clip_text = true; review.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		var hold = UI.button("Keep", func(): hold_requested.emit(id)); group.add_child(hold)
		hold.tooltip_text = "Acknowledge this driver's current issue without changing the plan or time controls."
		slots[id] = {"review":review,"hold":hold,"badge":badge,"stamp":[]}

func present(model: StrategyRaceSim, forecasts: Dictionary) -> void:
	if count == null: return
	var total = 0
	for id in slots:
		if not forecasts.has(id): continue
		var list = DecisionFeed.for_driver(model,id,model.policy(id),forecasts[id])
		var card = DecisionFeed.primary(list); entries[id] = card
		var driver_count = 0
		for item in list:
			if not item.acknowledged: driver_count += 1
		total += driver_count
		var slot = slots[id]
		var severity = "CRITICAL" if card.get("priority",0) >= 90 else ("REVIEW" if driver_count > 0 else "CLEAR")
		var text = "%s · %d %s" % [model.cars[id].short, driver_count, "decisions" if driver_count != 1 else "decision"] if driver_count > 0 else model.cars[id].short + " · On plan"
		var stamp = [text,card.get("key",""),card.is_empty(),severity]
		if stamp != slot.stamp:
			slot.stamp = stamp; update_count += 1
			slot.badge.present(severity, "danger" if severity == "CRITICAL" else ("warning" if driver_count > 0 else "neutral"))
			slot.badge.visible = driver_count > 0
			slot.review.text = text
			slot.review.tooltip_text = (severity + " · " + card.get("title", "") + " · " + card.get("evidence", "No unacknowledged issue. Review current strategy at any time."))
			slot.review.accessibility_name = text
			slot.hold.disabled = card.is_empty()
			slot.hold.accessibility_name = "Keep " + model.cars[id].short + " plan"
	pending_count = total
	count.text = "DECISIONS  %d" % total
