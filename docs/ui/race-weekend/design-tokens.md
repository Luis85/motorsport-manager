# Design language and tokens

`PitwallDesign` is the single owner of the race palette and race-specific state/surface helpers. `UI` aliases/delegates preserve existing callers without maintaining a second palette implementation.

Structural chrome uses deep racing green; neutral/decision surfaces use warm cream; brass denotes active selection/primary calls. Green, warning brass and danger red are accompanied by text, symbols or borders. Driver/team identity never substitutes for severity.

Typography roles (`TYPE`) define display, heading, driver, position, metric, body and caption. Shared controls capture their base sizes once, then apply 100/115/130% idempotently. Header height remains content-driven; the earlier unused hard-coded header/toolbar/decision-height prototypes were removed rather than forcing inaccessible geometry.

Spacing is 4/8/12/16/24 px. Race inspector/timing widths and shared radii are named tokens. Custom charts use shared cached surfaces, scale text where drawn and provide text alternatives. Fonts are resolved through the native theme; no external font assets are required.

Normal, hover, pressed, disabled and keyboard focus are all defined. No hover causes layout movement. Repeated state application is change-only. Component signatures include displayed content rather than only arbitrary simulation ticks.
