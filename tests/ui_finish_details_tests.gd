extends "res://tests/ui_finish_populated_tests.gd"
## Inspect the below-fold analytical evidence with real native scrolling.
## Reuse hash-checked physical captures from the preceding suite, or generate
## the same physical lineage when this script is run independently.

func load_lineage() -> void:
	var manifest=Storage.read_json("res://reports/physical-provenance.json")
	if not manifest.ok:
		await generate_lineage();return
	provenance=manifest.data
	for label in ["weather","practice-results","service","results"]:
		var source=Storage.read_json("res://reports/physical-"+label+".json")
		check(source.ok,"G18 detail capture restores retained physical source: "+label)
		if not source.ok:quit(1);return
		check(JSON.stringify(source.data,"",false,true).sha256_text()==provenance[label].sha256,"G18 source provenance matches before native inspection: "+label)
		states[label]=source.data

func run() -> void:
	root.size=Vector2i(1440,900);root.content_scale_size=root.size
	game=load("res://scenes/main.tscn").instantiate();root.add_child(game);app=root.get_node("App");await settle();app.settings.pitwall_text_scale=1.0
	await load_lineage()
	for profile in [[1440,900,1.0],[1280,800,1.15],[1100,720,1.3]]:
		root.size=Vector2i(profile[0],profile[1]);root.content_scale_size=root.size;app.settings.pitwall_text_scale=profile[2]
		await restore_state("weather");view.open_weather(3);await click(view.focus_button);await settle()
		var before=race_fingerprint();var panel=view.weather_panel
		await scroll_to(panel.outlook_chart)
		check(reachable(panel.outlook_chart) and reachable(panel.box) and reachable(panel.hold),"G07 scrolled stress chart and fixed decisions remain reachable "+str(profile))
		panel.outlook_chart.grab_focus();await key(KEY_HOME);await key(KEY_RIGHT)
		check(panel.outlook_chart.selected_text().contains("Drier"),"G07 native category inspection names an independent case")
		await shoot("weather-cases","weather")
		await scroll_to(panel.options[1]);await settle()
		check(reachable(panel.options[1]) and reachable(panel.box),"G07 estimated alternative and gate deadline can be read without losing Box "+str(profile))
		await shoot("weather-alternatives","weather")
		check(before==race_fingerprint(),"G07 native scrolling/case inspection does not issue a weather order or change the clock")
		await restore_state("practice-results");view.open_practice_workspace();await settle();before=race_fingerprint()
		for id in [3,6]:
			var programme=view.practice_workspace.panels[id]
			await scroll_to(programme.evidence)
			check(reachable(programme.evidence),"G05 observed cost and sample-quality text is reachable for "+model.cars[id].short+str(profile))
		check(reachable(view.practice_workspace.finish),"G05 scrolling both evidence panes retains continuation")
		await shoot("practice-cost-evidence","practice-results")
		check(before==race_fingerprint(),"G05 reading completed practice does not apply its retained draft")
		await restore_state("service");await open_box();await click(view.focus_button);await settle();before=race_fingerprint()
		await scroll_to(view.team_panel.service_view.cards[6].detail)
		check(reachable(view.team_panel.service_view.cards[6].detail),"G11 second driver's physical service evidence is reachable "+str(profile))
		for id in [3,6]:check(reachable(view.team_panel.cancel_stop_buttons[id]),"G11 shared service scrolling retains both cancellation states "+str(profile))
		await shoot("service-second-driver","service")
		check(before==race_fingerprint(),"G11 scrolling does not prioritize or reorder physical cars")
		await restore_state("results");view.open_results_workspace();await click(view.results_workspace.buttons[1]);await settle();before=race_fingerprint()
		await scroll_to(view.results_workspace.sectors)
		check(reachable(view.results_workspace.sectors) and reachable(view.results_workspace.next_button),"G14 complete measured sector table and fixed Next are reachable "+str(profile))
		await shoot("result-sectors","results")
		check(before==race_fingerprint(),"G14 reading sector evidence cannot settle or replace the result")
	var report={"passed":failures.is_empty(),"checks":checks,"errors":failures,"captures":captures,"screenshots":captures.size(),"physical_states":provenance,"engine":Engine.get_version_info().string}
	Storage.write_json("res://reports/ui-finish-details.json",report)
	print("UI_FINISH_DETAILS ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
