# Accessibility implementation and acceptance

Controls use native focus plus semantic names/descriptions. Static labels use accessibility-only focus; changing text buttons retain native dynamic labels rather than stale construction-time names. Icon-only controls receive explicit labels. Custom trace, categorical weather, strategy and stint charts expose textual data alternatives. Status uses words and borders as well as color; tyre compound letters remain present.

Keyboard routes and native focus restoration are retained. Hover help has a focused F1 route. Gamepad global controls are modal-aware, and native A activation is covered through synthetic InputEventJoypadButton tests. Reduced-motion follow behavior remains available.

Text scales 100%, 115% and 130% are supported and used by both controls and custom chart typography. Compact layouts reduce padding/redundant navigation or offer full analysis rather than removing necessary commit actions. Unavailable states have explanations.

Implemented semantics and synthetic events are not a claim of OS screen-reader certification, physical gamepad testing, support above 130%, or human usability validation. Those remain explicit external acceptance tasks.

Controller A/B and D-pad bindings are installed additively and idempotently through InputMap for all devices; existing keyboard mappings remain. Hidden hosts and modal windows cannot dispatch global race commands. Hardware-independent native-input tests exercise D-pad focus, A confirmation, shoulders, X/B/Start and modal isolation.


## Finishing acceptance

Native keyboard and synthetic gamepad events, visible focus, non-color trace markers, meaningful unavailable/status text and scaled guide/command footers are verified separately from actual assistive technology. The production state fixture tests selected text pairs against a documented 4.5:1 engineering target. This is not Windows screen-reader or physical-controller certification. See [manual gates](verification-finish.md).
