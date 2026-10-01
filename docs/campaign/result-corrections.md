# Provisional result correction and replacement deltas

Campaign settlement still consumes final race results only. A later steward correction is a separate explicit workflow; it never silently replays the weekend or adds a second award/payment.

`CampaignCorrectionQuery.preview()` validates the original frozen manifest and replacement `WeekendResult`, then computes detached sporting, cash and returned-inventory deltas. The preview is labelled provisional and mutates no campaign authority.

`CampaignWeekendTransaction.correct()` applies the accepted replacement atomically. It replaces the current settlement receipt, event awards, event cash postings and returned inventory under the original campaign policy, rebuilds standings, preserves authoritative campaign time and appends an immutable old-result/new-result correction journal entry.

The transaction rejects a different manifest or policy, an active weekend, an unsettled event, and an event whose result-contingent sponsor bonus has already been claimed. Reapplying the current corrected result is an exact no-op.

This is a correction workflow for final classifications, not a live-race steward simulation. The race engine remains the sole producer of ordinary weekend facts.