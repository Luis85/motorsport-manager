# Strategic Duels — final acceptance follow-through

This note supplements [the 0.15 behavior and experiment handoff](race-weekend-strategic-duels.md). It distinguishes development evidence from the final exact-head CI result recorded on PR #13.

## Imported physical-order consistency

After integration commit `cebece3f1ce3016641c3ac515d9283f9b7e6642e`, an adversarial import check reproduced a gap: a valid tactical record could be edited to claim an accepted order despite there being no matching physical pit transaction. Restoring that contradictory record could leave the pit mandate waiting for an order the car never received.

Validation now cross-checks active stages with the actual phase, route, pit-order flag, order identity and entry gate. Approved/preparing stages cannot claim an issued order; ordered and executing states must reference the current physical transaction. An untruncated event trail must agree with its latest status, explanation and time. Ended/review records may still preserve an accepted stop, because ending the tactical mandate does not cancel a physical commitment.

The focused native domain suite now passes **98 checks**, superseding the earlier 91-check development count. Added negative tests reject invented orders, mismatched order identity/gates/stages and inconsistent event text. Positive tests restore actual accepted orders before entry, cars physically executing pit service, completed visits and independent two-driver continuations. Existing replay, ownership, stock and later-stint tests remain. The change strengthens import validation; it does not tune race behavior.

## Supplemental routes

Before this import-hardening change, a separate complete normal-weekend harness passed 24 checks through optional measured practice, measured qualifying, preparation, formation, lights, a 24-lap race and final result/notebook export. It also compared 240 matched fixed steps with and without read-model observation. A separate native route check passed 12 assertions from the main scenario menu into preparation, Strategy / Tactics and the existing guide target. These supplemental harnesses are not added to the registered full-runner count. Final source reruns and their provenance belong with the completion evidence.

## Acceptance remains source-specific

All prior suites are retained. New registered suites cover the 98 domain checks, 31 synthetic contract boundaries, 149 full-race comparisons and 73 native interaction checks/nine captures. A repeated local or hosted execution is not an additional distinct check. Read the current PR head, workflow run and `reports/verification.json` together rather than treating this document or an earlier green revision as the current CI verdict.

The bounded experiment results and open gates in the behavior handoff remain unchanged: the tested extension was not best in the four comparative fixtures; broader extension-favorable contexts, forecast calibration, human comprehension/enjoyment and platform/hardware validation are still required. No tuning was introduced solely to manufacture a preferred winner.

## Focused tactics return regression

The resumed exact-source review reproduced an ordering defect in the existing full-size analysis route: closing it reparented the inspector, but its invoker row was still hidden when focus restoration selected its fallback. The next telemetry refresh made the row visible without correcting keyboard focus. At the paused test boundary, the player returned to Race view rather than the Focus button that opened the task.

The close operation now restores that row before deciding the focus target. No simulation, ownership, save model or timing rule changed. The registered tactical native suite adds the real post-service Focus/compare/return route at 1100×720 and 130% text. It checks useful scroll height, both drivers and time controls, fixed actions, retained unapplied draft, unchanged full authoritative snapshot/RNG and exact invoker focus without depending on a telemetry refresh. The resumed supplemental reproduction is retained separately, including its original failing assertion. Final counts and the new head's hosted status belong to its reports and PR metadata rather than an earlier passing head.
