extends SceneTree
var checks = 0
var failures: Array[String] = []


func _initialize() -> void:
	call_deferred("run")


func check(value: bool, message: String) -> void:
	checks += 1
	if not value:
		failures.append(message)
		push_error(message)


func run() -> void:
	preload("res://tests/support/campaign_finance_balance_contracts.gd").run(check)
	preload("res://tests/support/race_presentation_balance_contracts.gd").run(check)
	var report = {"passed": failures.is_empty(), "checks": checks, "failures": failures}
	Storage.write_json("res://reports/balance-campaign-presentation-tests.json", report)
	print("BALANCE_CAMPAIGN_PRESENTATION_TESTS ", JSON.stringify(report))
	quit(0 if failures.is_empty() else 1)
