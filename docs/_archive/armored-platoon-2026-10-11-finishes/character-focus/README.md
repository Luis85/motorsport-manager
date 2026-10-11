# Character Studio queued-close focus repair — 11 October 2026

Historical evidence for implementation `de06f7c353e0a170f8f9f9681a28f2544c9393c2`.
This directory records a diagnosed product focus race and its local verification;
subsequent committed-source CI is separate evidence.

The [receipt](receipt.json) identifies sources, generated executable, environments
and results. Character Studio CI on `e9c5571c` failed the keyboard chapter journey:
Enter reopened Accessibility and the heading remained Identity. The other two
browser checks passed. The original failed log and terminal metadata are retained.

A passive trace of twenty real Escape → chapter focus → Enter transitions
reproduced three failures. Native Escape had closed the modal and restored its
invoker; then its queued close event stole a newer deliberate chapter focus.
The product fix respects newer outside focus and reopened modals while retaining
normal invoker restoration. The identical bounded transition diagnostic passed
20/20 afterward. The existing journey now also deterministically exercises both
queued-event cases, without removing the original keyboard assertion or changing
timeouts. All three browser checks, 52 unit checks, two integration checks,
standalone handoff, type checking and bundle freshness passed locally.

The local browser was system Chromium 151 with Playwright 1.63.0. CI installed
Chromium 153; its selected executable was not printed. The local reproduction is
not presented as the same browser build. Every local browser was closed before
the separate Armored observation restarted.

[Selection and hashes](selection.json) map original files to deterministic gzip
copies. Decompress `.gz` files to inspect them. Diagnostic scripts end in `.txt.gz`
and remain historical evidence; they contain original workspace paths and require
path adaptation in a separate copy. The prelaunch parse error is retained as a
scratch harness mistake, not a product failure. `SHA256SUMS` covers every stored
file except itself.
