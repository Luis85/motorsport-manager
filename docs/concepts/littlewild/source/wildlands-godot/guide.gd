extends VBoxContainer
## Authored guidance is observational; selecting advice never grants progress or rewards.
var steps: Array = []
var scene_id := ""
var scenario_id := ""
var picker := OptionButton.new()
var text := Label.new()
var body := VBoxContainer.new()
var signature := ""

func configure(project: Dictionary) -> void:
	scenario_id = str(project.scenarioId)
	scene_id = str(project.sceneId)
	steps = project.get("pack", {}).get("tutorial", [])
	var disclosure := Button.new()
	disclosure.text = "Littlewild guide · " + str(steps.size()) + " steps"
	disclosure.pressed.connect(func(): body.visible = not body.visible)
	add_child(disclosure)
	body.visible = false
	add_child(body)
	for index in range(steps.size()):
		picker.add_item(str(index + 1) + ". " + str(steps[index].title))
	picker.item_selected.connect(_select)
	body.add_child(picker)
	text.autowrap_mode = TextServer.AUTOWRAP_WORD_SMART
	body.add_child(text)
	if not steps.is_empty():
		_select(0)
	visible = not steps.is_empty()

func update_view(view: Dictionary) -> void:
	var snapshot: Dictionary = view.get("snapshot", {})
	visible = not steps.is_empty() and str(snapshot.get("scenarioId", "")) == scenario_id
	if not visible:
		return
	var progress: Dictionary = view.get("state", {}).get("progression", {}).get("tutorial", {})
	var next := JSON.stringify([snapshot.get("sceneId"), progress])
	if next != signature:
		signature = next
		var index := clampi(int(progress.get("step", 0)), 0, steps.size() - 1)
		picker.select(index)
		_select(index)

func _select(index: int) -> void:
	if index >= 0 and index < steps.size():
		text.text = str(steps[index].body) + "\n\nUse the world normally. This guide does not perform actions or change saved tutorial progress."
