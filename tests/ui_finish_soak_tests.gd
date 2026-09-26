extends "res://tests/ui_finish_guide_tests.gd"
## The default bounded native workload is registered in verify.py.
## -- soak_seconds=1800 runs the same controls for the named 30-minute release gate.
var frame_samples: Array = []
var observations: Array = []
var refresh_samples: Array = []
var session_results: Array = []

func quantiles(values: Array) -> Dictionary:
	if values.is_empty():return {}
	var sorted=values.duplicate();sorted.sort()
	return {"samples":sorted.size(),"median_us":sorted[sorted.size()/2],"p95_us":sorted[mini(sorted.size()-1,int(sorted.size()*0.95))],"max_us":sorted.back()}

func long_race(seed_value: int) -> void:
	model=PracticeRaceSim.new(TrackGeometry.new(app.library[7]),{"laps":100,"scenario":"changeable","intensity":"calm","seed":seed_value})
	check(model.command("prepare_race"),"G17 soak uses supported generated-grid preparation")
	model.paused=true;await reset();await click(view.primary_button)
	check(await advance_until(func():return model.phase=="grid_ready",240),"G17 soak formation remains physical")
	view.refresh();await click(view.primary_button)
	check(await advance_until(func():return model.phase=="race",10),"G17 soak lights start through native approval")
	view.refresh();view.set_process(true);await settle()

func run() -> void:
	var seconds=30.0
	for arg in OS.get_cmdline_user_args():
		if arg.begins_with("soak_seconds="):seconds=clampf(arg.trim_prefix("soak_seconds=").to_float(),30,3600)
	root.size=Vector2i(1100,720);root.content_scale_size=root.size
	game=load("res://scenes/main.tscn").instantiate();root.add_child(game);app=root.get_node("App");await settle();app.settings.pitwall_text_scale=1.3
	await long_race(7314)
	# Prewarm all composed pages/styles before testing steady refresh resource growth.
	for topic in [0,1,2,3,4,5,6,7,8,9]:view.open_topic(topic);view.refresh();await settle(2)
	view.close_detail();await settle()
	var baseline_nodes=get_node_count();var baseline_styles=PitwallDesign.race_styles.size()
	var baseline_memory=Performance.get_monitor(Performance.MEMORY_STATIC)
	var start=Time.get_ticks_msec();var last=Time.get_ticks_usec();var next_action=0.0;var next_checkpoint=0.0;var frame=0;var route=0
	var sequence=[1,2,3,4,5,6,8,9,7,0]
	await key(KEY_SPACE)
	check(not model.paused,"G17 only the explicit native pause control starts the soak clock")
	while (Time.get_ticks_msec()-start)/1000.0<seconds:
		await process_frame
		var now=Time.get_ticks_usec()
		if frame%6==0:
			frame_samples.append(now-last)
			if frame_samples.size()>20000:frame_samples.pop_front()
		last=now;frame+=1
		var elapsed=(Time.get_ticks_msec()-start)/1000.0
		if model.phase=="results":
			session_results.append({"seed":model.seed_value,"time":model.total_time,"phase":model.phase,"hash":race_fingerprint().sha256_text()})
			await long_race(7315+session_results.size());await key(KEY_SPACE)
			baseline_nodes=get_node_count();baseline_styles=PitwallDesign.race_styles.size()
		if elapsed>=next_action:
			await key(KEY_SPACE);check(model.paused,"G17 test explicitly pauses before the observational inspection checkpoint")
			var before=race_fingerprint()
			view.close_session_workspace();view.open_topic(sequence[route%sequence.size()]);await settle()
			if route%2==0:await click(view.focus_button)
			if sequence[route%sequence.size()]==1:
				view.telemetry_inspector.chart.grab_focus();await key(KEY_HOME);await key(KEY_RIGHT)
			elif sequence[route%sequence.size()]==8:
				await click(view.team_panel.topic_buttons[3]);view.team_panel.intent_timeline.grab_focus();await key(KEY_DOWN)
			check(before==race_fingerprint(),"G17 repeated native chart/layout inspection leaves the paused race untouched")
			var focused=root.gui_get_focus_owner()
			for i in range(15):
				var update_started=Time.get_ticks_usec();view.refresh();refresh_samples.append(Time.get_ticks_usec()-update_started)
				if refresh_samples.size()>20000:refresh_samples.pop_front()
			check(root.gui_get_focus_owner()==focused,"G17 refresh cannot steal the active inspection focus")
			check(get_node_count()==baseline_nodes,"G17 steady native inspection does not grow the node tree")
			observations.append({"wall_seconds":elapsed,"race_seconds":model.total_time,"phase":model.phase,"speed":model.speed,"nodes":get_node_count(),"race_styles":PitwallDesign.race_styles.size(),"static_memory_bytes":Performance.get_monitor(Performance.MEMORY_STATIC)})
			view.close_detail();await settle();view.watch_button.grab_focus()
			var next_speed=1 if route%2==0 else 16
			await key(KEY_1 if next_speed==1 else KEY_5)
			check(model.speed==next_speed and model.paused,"G17 explicit native speed selection preserves pause until resumed")
			await key(KEY_SPACE);route+=1;next_action=elapsed+15.0
		if elapsed>=next_checkpoint:
			Storage.write_json("res://reports/ui-finish-soak-progress.json",{"target_wall_seconds":seconds,"elapsed_wall_seconds":elapsed,"frames":frame,"observations":observations,"failures":failures})
			if next_checkpoint==0.0 or elapsed>seconds-31:await capture("soak-%d" % int(elapsed),"Physical changeable-weather race under the production native frame loop; explicit pause checkpoints, no synthetic sporting events")
			next_checkpoint=elapsed+30.0
	await key(KEY_SPACE);view.set_process(false)
	check(PitwallDesign.race_styles.size()<=baseline_styles+4,"G17 cached race styles remain bounded after the sustained workload")
	var report={"passed":failures.is_empty(),"checks":checks,"errors":failures,"captures":captures,"screenshots":captures.size(),"engine":Engine.get_version_info().string,"cpu":OS.get_processor_name(),"renderer":RenderingServer.get_video_adapter_name(),"display":DisplayServer.get_name(),"viewport":"1100x720","text_scale":1.3,"wall_seconds":(Time.get_ticks_msec()-start)/1000.0,"target_wall_seconds":seconds,"frames":frame,"frame_sample_every":6,"frame_distribution":quantiles(frame_samples),"refresh_distribution":quantiles(refresh_samples),"baseline_nodes":baseline_nodes,"baseline_static_memory_bytes":baseline_memory,"observations":observations,"completed_physical_sessions":session_results,"final_race_time":model.total_time,"final_hash":race_fingerprint().sha256_text(),"limitations":"Native Linux Xvfb / Mesa llvmpipe, Alternating 1x/16x real frame-loop input with explicit pause inspections and a separately sampled refresh workload. Contending CI/test workloads may affect throughput. Not physical-controller, Windows, export-build or broad-hardware certification; not a deterministic fixed-delta throughput comparison."}
	Storage.write_json("res://reports/ui-finish-soak.json",report);print("UI_FINISH_SOAK ",JSON.stringify(report));quit(0 if failures.is_empty() else 1)
