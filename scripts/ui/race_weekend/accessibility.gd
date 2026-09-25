class_name RaceAccessibility
extends RefCounted
## Native Control metadata plus text alternatives for custom charts.
## No claim of OS/screen-reader certification; semantic names are exercised by tests.
static func describe(root: Node) -> void:
	if root is Control:
		if root is BaseButton and "text" in root and str(root.text).is_empty() and root.accessibility_name.is_empty(): root.accessibility_name=root.tooltip_text
		if not root.tooltip_text.is_empty():root.accessibility_description=root.tooltip_text
		if root is LineEdit and root.get_parent() is SpinBox:root.accessibility_name=root.get_parent().tooltip_text
		if root is Label:root.focus_mode=Control.FOCUS_ACCESSIBILITY
	for child in root.get_children():describe(child)
