class_name TrackEditorSelectionInspector
extends RefCounted
## Builds draft controls for a cohesive editor workspace.


static func point(editor: Control) -> VBoxContainer:
	var point = editor.inspector_page("Point")
	if editor.canvas.selection_ids.size() > 1:
		point.add_child(
			UI.label(
				(
					"%d %s ITEMS"
					% [editor.canvas.selection_ids.size(), editor.canvas.selection_kind.to_upper()]
				),
				16,
				UI.ACCENT
			)
		)
		point.add_child(
			UI.paragraph(
				(
					"Drag any selected item to move the selection. Shift-click toggles membership. "
					+ "Road handles move with their points; widths and elevations stay unchanged."
				)
			)
		)
		var turn = UI.spin(15, -180, 180, 1, func(_value): pass)
		UI.field(point, "Rotation °", turn)
		point.add_child(
			UI.button(
				"Rotate selection",
				func():
					editor.apply_selection_result(
						TrackEdit.transform(
							editor.document,
							editor.canvas.selection_kind,
							editor.canvas.selection_ids,
							Vector2.ZERO,
							turn.value
						)
					),
			)
		)
		var factor = UI.spin(1.1, 0.1, 4, 0.1, func(_value): pass)
		UI.field(point, "Scale factor", factor)
		point.add_child(
			UI.button(
				"Scale selection",
				func():
					editor.apply_selection_result(
						TrackEdit.transform(
							editor.document,
							editor.canvas.selection_kind,
							editor.canvas.selection_ids,
							Vector2.ZERO,
							0,
							factor.value
						)
					),
			)
		)
		point.add_child(
			UI.button("Distribute horizontally", func(): editor.selection_action("distribute_x"))
		)
		point.add_child(
			UI.button("Distribute vertically", func(): editor.selection_action("distribute_y"))
		)
		(
			point
			. add_child(
				(
					UI
					. paragraph(
						(
							"Transforms are one undo step. Alignment uses item centres; grouping is flat and "
							+ "applies to scenery only."
						)
					)
				)
			)
		)
	elif (
		editor.canvas.selected_object >= 0
		and editor.canvas.selected_object < editor.document.objects.size()
	):
		var object = editor.document.objects[editor.canvas.selected_object]
		point.add_child(UI.label("SCENERY / " + str(object.type).to_upper(), 16, UI.ACCENT))
		editor.coordinate_fields(point, object, false)
		UI.field(
			point,
			"Rotation °",
			UI.spin(
				object.get("rotation", 0),
				-360,
				360,
				1,
				func(value): editor.perform(func(): object.rotation = value)
			)
		)
		UI.field(
			point,
			"Scale",
			UI.spin(
				object.get("scale", 1),
				0.2,
				8,
				0.1,
				func(value): editor.perform(func(): object.scale = value)
			)
		)
		point.add_child(UI.button("Delete scenery", editor.delete_point))
		point.add_child(
			UI.paragraph(
				(
					"Drag this object in Select / move. Rotation and scale affect its drawn "
					+ "footprint; this is scenery, not a collision body."
				)
			)
		)
	elif (
		editor.canvas.mode == "pit"
		and editor.canvas.selected_pit >= 0
		and not editor.document.pits.is_empty()
		and editor.canvas.selected_pit < editor.document.pits[0].nodes.size()
	):
		var node = editor.document.pits[0].nodes[editor.canvas.selected_pit]
		point.add_child(UI.label("PIT POINT %d" % (editor.canvas.selected_pit + 1), 16, UI.ACCENT))
		editor.coordinate_fields(point, node, false)
		point.add_child(
			UI.button(
				"Delete pit point",
				func():
					editor.perform(
						func():
							editor.document.pits[0].nodes.remove_at(editor.canvas.selected_pit)
							editor.canvas.selected_pit = -1,
						true
					),
			)
		)
		(
			point
			. add_child(
				(
					UI
					. paragraph(
						(
							"Drag the gold pit handles. Shift-click empty space to append a point. Entry and "
							+ "exit gates are edited in Track."
						)
					)
				)
			)
		)
	elif editor.canvas.selected >= 0 and editor.canvas.selected < editor.document.nodes.size():
		var node = editor.document.nodes[editor.canvas.selected]
		point.add_child(UI.label("CONTROL POINT %d" % (editor.canvas.selected + 1), 16, UI.ACCENT))
		editor.coordinate_fields(point, node, true)
		point.add_child(
			UI.check(
				"Aligned handles",
				node.get("mode", "aligned") == "aligned",
				func(value): editor.perform(func(): node.mode = "aligned" if value else "free")
			)
		)
		point.add_child(
			UI.button(
				"Smooth this corner",
				func():
					editor.perform(
						func(): TrackDocument.smooth_node(editor.document, editor.canvas.selected),
						true
					),
			)
		)
		point.add_child(
			UI.button(
				"Make a sharp corner",
				func():
					editor.perform(
						func():
							node.mode = "free"
							TrackDocument.set_handle(node, "in", Vector2.ZERO)
							TrackDocument.set_handle(node, "out", Vector2.ZERO),
						true
					),
			)
		)
		point.add_child(
			UI.button(
				"Split next segment",
				func():
					editor.perform(
						func():
							editor.canvas.selected = TrackDocument.split_segment(
								editor.document, editor.canvas.selected
							),
						true
					),
			)
		)
		point.add_child(UI.button("Delete control point", editor.delete_point))
		point.add_child(
			UI.paragraph(
				(
					"The square handles shape the exact Bézier curve. Insertion splits that curve "
					+ "without changing its shape. Banking and height are interpolated along the "
					+ "circuit."
				)
			)
		)
	else:
		point.add_child(UI.label("DIRECT MANIPULATION", 16, UI.ACCENT))
		point.add_child(
			UI.paragraph(
				(
					"Click a control point to inspect it. Drag the point or its square handles. "
					+ "Double-click the road to insert a shape-preserving point."
				)
			)
		)
		(
			point
			. add_child(
				(
					UI
					. paragraph(
						(
							"New circuits begin as a four-corner starter. Draw points appends new corners; "
							+ "the circuit stays closed. Use Smooth all only on a new rough outline—not on a "
							+ "surveyed template."
						)
					)
				)
			)
		)
		point.add_child(
			UI.button(
				"Smooth all points",
				func():
					editor.perform(
						func():
							for i in range(editor.document.nodes.size()):
								TrackDocument.smooth_node(editor.document, i),
					),
			)
		)
		point.add_child(
			UI.paragraph(
				(
					"Navigation\nWheel: zoom at cursor\nRight or middle drag: pan\nCtrl while "
					+ "dragging: snap to 5 m\nF: fit\nCtrl+Z / Ctrl+Y: undo / redo\nCtrl+S: "
					+ "save\nDelete: delete selected point"
				)
			)
		)
	return point
