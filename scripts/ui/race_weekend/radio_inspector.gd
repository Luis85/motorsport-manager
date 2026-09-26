class_name RaceRadioInspector
extends VBoxContainer
## Bounded native message cards. History is explicitly a fixed reading snapshot.
signal filter_changed(index: int)
var model: RaceSim
var source: RichTextLabel
var rows: Array = []
var caption: Label
var live: Button
var older: Button
var newer: Button
var category = 0
var page = 0
var frozen: Array = []
var history_mode = false
var last_stamp: Array=[]
var update_count=0
func configure(value: RaceSim) -> void: model=value
func _ready() -> void:
	var nav = UI.hbox(self)
	live = UI.button("Live",func(): history_mode=false;page=0;present()); nav.add_child(live)
	nav.add_child(UI.button("History",func(): frozen=model.events.duplicate(true);history_mode=true;page=0;present()))
	var filter = UI.option(["All events","Flags & incidents","Pit decisions","Tyre condition","Weather"],_filter); filter.size_flags_horizontal=Control.SIZE_EXPAND_FILL;nav.add_child(filter)
	caption=UI.paragraph(""); add_child(caption)
	for i in range(8):
		var panel=PitwallDesign.race_panel(false,7); add_child(panel)
		var body=UI.vbox(panel)
		var title=UI.label("",11,UI.ACCENT);body.add_child(title)
		var text=UI.paragraph("",UI.INK);body.add_child(text)
		rows.append({"panel":panel,"title":title,"text":text})
	var pages=UI.hbox(self)
	newer=UI.button("Newer",func(): page=maxi(0,page-1);present());pages.add_child(newer)
	older=UI.button("Older",_older);pages.add_child(older)
	# Compatibility mirror for logs/tests; the actual presentation is structured cards.
	source=RichTextLabel.new();source.hide();add_child(source)
func _filter(index: int) -> void: category=index;page=0;filter_changed.emit(index);present()
func _older() -> void:
	if not history_mode: frozen=model.events.duplicate(true);history_mode=true
	page+=1;present()
func present() -> void:
	if caption==null:return
	var events=frozen if history_mode else model.events
	var stamp=[events.size(),str(events.back()) if not events.is_empty() else "",history_mode,category,page]
	if stamp==last_stamp:return
	last_stamp=stamp;update_count+=1
	var matches: Array=[]
	var kinds=[[],["flag","incident","finish"],["pit","radio"],["tyre"],["weather"]][category]
	for i in range(events.size()-1,-1,-1):
		if category==0 or events[i].kind in kinds: matches.append(events[i])
	page=clampi(page,0,maxi(0,int(ceil(matches.size()/8.0))-1))
	for i in range(8):
		var at=page*8+i;rows[i].panel.visible=at<matches.size()
		if at>=matches.size():continue
		var e=matches[at]
		rows[i].title.text="%02d:%02d  /  %s" % [int(e.time/60),int(fmod(e.time,60)),str(e.kind).to_upper()]
		rows[i].text.text=e.text
	caption.text=("HISTORY SNAPSHOT" if history_mode else "LIVE · newest first")+" · %d messages · page %d/%d\n%d retained events (limit 2000); earliest retained %.1fs." % [matches.size(),page+1,maxi(1,ceili(matches.size()/8.0)),events.size(),float(events.front().time) if not events.is_empty() else 0.0]
	if matches.is_empty():caption.text+=" · No matching messages"
	newer.disabled=page==0;older.disabled=(page+1)*8>=matches.size();UI.set_active(live,not history_mode)
