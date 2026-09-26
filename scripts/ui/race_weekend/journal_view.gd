class_name RaceJournalView
extends VBoxContainer
## Structured accepted-command and observed-outcome evidence, never counterfactual results.
var model: StrategyRaceSim
var table: Tree
var rows: Array[TreeItem]=[]
var caption: Label
var rendered_sequence=-1
var update_count=0
func configure(value: StrategyRaceSim) -> void:model=value
func _ready() -> void:
	caption=UI.paragraph("Commands and observations are different evidence. Pit duration is not net race-time loss.");add_child(caption)
	table=Tree.new();table.columns=5;table.hide_root=true;table.column_titles_visible=true;table.size_flags_vertical=Control.SIZE_EXPAND_FILL;table.custom_minimum_size.y=250;add_child(table)
	for i in range(5):table.set_column_title(i,["TIME","DRIVER","EVIDENCE","ACTION / OUTCOME","PRIOR ESTIMATE"][i])
	var root=table.create_item()
	for i in range(100):rows.append(table.create_item(root));rows[-1].visible=false
	table.accessibility_name="Accepted decisions and observed outcomes"
func present() -> void:
	if table==null or rendered_sequence==int(model.strategy_state.sequence):return
	rendered_sequence=int(model.strategy_state.sequence);update_count+=1
	var entries: Array=[]
	for r in model.strategy_state.records:
		if r.driver_id in [-1,3,6] and r.kind in ["command","pit_exit","handback","strategy_order","plan_blocked","warning","team_order_outcome","pass_completed"]:entries.append(r)
	entries=entries.slice(maxi(0,entries.size()-100));entries.reverse()
	caption.text="Latest %d team records · command / model estimates are distinct from observed outcomes. Pit duration is not net race-time loss." % entries.size()
	if model.strategy_state.truncated:caption.text+=" Journal capacity reached; later records are unavailable."
	for i in range(rows.size()):
		rows[i].visible=i<entries.size()
		if i>=entries.size():continue
		var r=entries[i];var e=r.evidence
		rows[i].set_metadata(0,r.id)
		rows[i].set_text(0,"%.1fs" % r.time)
		rows[i].set_text(1,"TEAM" if r.driver_id<0 else model.cars[int(r.driver_id)].short)
		rows[i].set_text(2,"OBSERVED" if r.provenance=="observed" else "COMMAND / MODEL")
		rows[i].set_text(3,("Pit visit %.1fs" % e.get("visit_seconds",0)) if r.kind=="pit_exit" else e.get("action",e.get("reason",r.kind.replace("_"," "))))
		rows[i].set_text(4,("%.1f–%.1fs; residual %+.1f" % [e.predicted_low,e.predicted_high,e.residual]) if e.has("predicted_low") else "—")
		for column in range(5):rows[i].set_tooltip_text(column,r.id+" · "+r.kind+" · "+str(e))
