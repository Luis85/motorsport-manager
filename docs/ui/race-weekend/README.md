# Native Race Weekend UI

The native Godot 0.14.0 weekend is the implementation target. This directory describes the integrated game, not a browser prototype or a proposed second race engine.

## Current handover

- [Finishing ledger](finish-ledger.md): G01–G18 / WP00–WP15, implementation, native, visual and platform evidence kept separate.
- [Screen and state specification](finish-specification.md): SC00–SC14, exact information sources, legal actions and empty/terminal states.
- [Visual acceptance](finish-visual-acceptance.md): the three original concept boards translated into native screens; six review dimensions per screen.
- [Player guide](player-guide.md): a complete weekend, inspection, explicit commitments and recovery routes.
- [Verification and platform gates](verification-finish.md): runner isolation, physical/synthetic fixtures, full regression, soak reproduction and environment limitations.
- [Implementation status](implementation-status.md): preserved architecture and integrated increments.

The earlier [completion report](verification-completion.md) and [repair report](verification-repair.md) are historical evidence. Their counts and publication status belong to their stated source, not the latest head. Current machine results are produced by `scripts/verify.py`; the final delivery receipt and PR identify the exact source and CI run.

## Shared contracts

[Design tokens](design-tokens.md), [layout](layout-system.md), [components](component-catalog.md), [interaction](interaction-model.md), [accessibility](accessibility.md), and [responsive behavior](responsive-behaviour.md) apply across screens. Individual screen notes remain useful summaries; the finishing specification records subsequent detail.

The handoff ZIP's `assets/` and `sources/` stay external references. Its original C01–C03 boards supply hierarchy and visual direction. Their crops are excerpts, not extra approved screens. The final screenshot-comparison bundle pairs those references with actual native renders and retains physical-state provenance. No generated artwork substitutes for native acceptance.

No production domain/service file, save schema, RNG, tyre identity, physical pit routing, sporting rule or balance is changed by this finishing work. Physical controllers, Windows-specific accessibility/DPI, exported builds and broad hardware profiling remain separately stated gates.
