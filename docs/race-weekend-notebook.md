# Circuit notebook and remembered challenges — 0.14.0

## Design basis and integration

This increment implements the Race Weekend GDD v1.0 section **20.4**, with the RW-19 replay/scenario foundation and RW-16 interaction contracts. The player can retain what actually happened, write a personal interpretation, and revisit it before another weekend. It introduces no campaign economy, rewards, automatic performance prior, extra physics, driver-pressure gauge or RW-20 ruleset.

At inspection on 24 September 2026, `main` was `455728df4ff08108f604596770d3a760238c1464`, containing 0.11. PR #8 had merged into the former rivals feature branch; PR #9 had merged into the replay feature branch. Their combined **0.13** tree was `fe3f4fd5e85b248ce7f652d1ee884925d030909a` at `c873823c25199a4131dd047ac596cc2bf75c6aa1`, not main. This increment preserves that complete tree and history on `feat/race-weekend-mastery` using integration commit `0b40f22055bb70de101923bec1992e7df86c402c`, whose parents are main and the combined replay branch. Its PR targets **main directly**. No existing PR or main was automatically merged or reset.

The recovered 0.13 additions include frozen-state authoring with a title, public briefing, two approaches, a hint and one supported final goal; scenario import; explicit sandbox goal assessment; stronger result validation and recorder detachment. They are retained work, not new notebook authorship. Their original PR did not wire dedicated authoring tests into the runner; the new domain and native suites exercise those paths as well as the notebook.

## Play

In a recording-capable pit wall, choose **Weekend → Circuit notebook**, or **Find / Ctrl+K → Review / Circuit notebook**. At a completed original or sandbox result, **Remember completed run** records a compact observation. It does not accept a result, create a receipt, change an order, or grant rewards. Recording is opt-in: no history file is created merely by opening the notebook.

The main menu's **Replays & experiments → Circuit notebook** opens retained history without attaching a current run. To remember another result, open that completed pit wall and its notebook. Existing earlier-model scenario views remain playable but do not acquire a fabricated recording history; continue a supported raw save through the existing migration path when a recording is needed.

Entries are newest-first, with stable event identity and explicit **Standalone / Legacy / Sandbox** labels. The circuit filter uses the exact snapshot hash, not just a reused circuit name. A changed document, including its stored metadata, can therefore require the All recorded circuits view even when it depicts the same geometry. The details preserve vehicle, configured race distance, weather/incident setup, rule modes, model/engine, both drivers' finishing positions, completed laps, retirement/finish status, actual pit count, measured qualifying best and practice-lap count. A lapped finish is not silently treated as an equal-distance time comparison. The snapshot/model context stays visible so results under different rules are not presented as controlled experiments.

**Your note** is explicitly personal interpretation, separate from observed facts. Save it deliberately; routine refresh never applies it. Close, selecting another run, and changing the filter guard a dirty draft. Cancel defaults to **Stay and review**. A stale revision or invalid storage leaves the draft intact. Reopen after explicitly discarding a draft to inspect another saved revision. Saved notes survive restart; unsaved text does not.

**Forget entry** confirms removal of that notebook entry and note only. It never removes an original/sandbox continuation, replay file or accepted-result receipt. **Export notebook** exports saved observations and notes; its title/status disclose that an unsaved draft is excluded. There is no notebook import/merge UI in this slice and no competitive leaderboard.

## Challenge outcomes without rewards

The inherited authoring goals are observation-only, finish both player cars, Mercer in the top six, and Moreau in the top six. The notebook stores their outcome only after the source finishes. A top-six goal additionally requires the named car to have finished; a retired car is not awarded success merely for a numeric position. A lapped but classified finisher can satisfy the stated finish goal.

Each authored challenge is associated with a fingerprint of its brief and frozen starting sporting state. Different starts or briefs remain distinct. Separate sandbox attempts have separate event IDs; repeated recording of the same attempt is idempotent. Outcomes are **observation / met / not met**, not points or repeatable achievements. An ordinary weekend receives no invented authored goal. A sandbox can be remembered, but still cannot use **Accept original result** or duplicate campaign consequences.

The notebook does not prove a strategy caused a result. It does not average incompatible runs into a forecast, claim an unexecuted counterfactual, or improve tyres, grip, staff or car setup. Knowledge belongs to the player. No controls are locked behind collecting entries.

## Data and persistence contract

`NotebookEntry` builds compact facts from the existing final `WeekendResult` and the corresponding simulation. It checks the frozen track/roster/rules context against the initial recording. Its facts include the original result digest, so a changed result under the same event ID cannot silently become the same historical entry. Only the personal note and its revision are mutable.

`CircuitNotebook` owns `user://circuit-notebook.json`, kind `motorsport-manager-circuit-notebook`, **version 1**. It reads/validates the latest file before each explicit change. A repeated event/facts digest is a no-op that preserves the existing note and file bytes. A different digest for the same event fails. Note writes and deletion validate the expected entry revision to protect against stale windows. This is a local serial read/write guard, not a multi-process database transaction guarantee.

Limits: **128 entries**, **1,200 note characters**, unique event IDs, bounded finite measurements, strict shape/enums, known goal outcomes and integrity digests. A full notebook refuses new entries without evicting anything. Export then explicitly forget entries to free space. Malformed files are reported rather than reset. Existing `Storage` uses temporary/backup replacement and its 16 MB ceiling. Checksums detect accidental modification; this local editable history is not authenticated anti-cheat evidence.

Application **0.14.0**, notebook **v1**, replay/session **v1**, scenario **v1**, result/receipt **v1**, native checkpoint **v10**, and replay model **race-weekend-0.12-v1** are deliberately distinct. Neither the simulation snapshot schema nor sporting behavior changed. Existing raw saves retain their established migrations; the notebook does not automatically import older results or fabricate missing history. Backups remain manual recovery artifacts.

## Native interaction and implementation boundaries

`NotebookWindow` is composed into the existing application. It reads historical data and writes the notebook service, never the simulation or accepted-result ledger. Menu and Find access share one implementation; no new permanent pit-wall navigation row or driver gauge was added. The main menu can read history without constructing a race.

| Action | State and feedback |
|---|---|
| Open history | Observational, opt-in, no result/physics changes |
| Remember completed run | Revalidates final facts; duplicates preserve notes; unavailable before completion |
| Edit a note | Local draft with character count and unsaved status |
| Save note | Revision check, atomic storage, preserved draft on failure |
| Select/filter/close while dirty | Explicit discard confirmation, safe Stay default |
| Forget | Separate confirmation, removes only this notebook entry |
| Export | Saved notebook only; no reward authority or hidden draft application |

Opening this history window **does not pause a running race**. The header explicitly says when the live weekend keeps running. The existing pit wall can advance normally behind it; the notebook polls only the completion status at a modest presentation cadence. Its primary save/forget/export/close controls remain outside scrolling evidence. Users needing reading time should pause explicitly before opening history. This is a modal history workspace, not a replacement for the live two-car command view.

Keyboard focus returns to the invoking Weekend/Find/main-menu control. Race shortcut characters typed into notes belong to the text editor. The native theme and existing 100/115/130% text preference are retained. The evidence pane can scroll; control bounds, nested confirmations and draft safety are tested separately from text readability. No participant accessibility certification or controller/screen-reader completeness is inferred from native widgets.

## Inspection findings and corrections

The integration gap was an observed repository fact, not a hypothetical defect: completed PR merges had not delivered their source to main. A two-parent feature-branch integration preserves both histories and makes the next PR reviewable against main.

The first notebook list used multi-line labels which the native ItemList condensed. The revised list puts origin and event identity first and keeps the full circuit/context in the selected detail, rather than relying on a hidden identifier at the truncated end. This is an observed native layout correction, not evidence of human enjoyment.

Supplementary native menu navigation exposed an inherited Replays & experiments MenuButton that could not receive ordinary keyboard focus when the notebook returned to it. Its focus mode is now explicit, and the main suite asserts it. The full revised run was restarted after this correction rather than presenting its earlier partial run as final evidence.

An initial native-test attempt compiled an App-dependent view before the test application's autoload was ready; runtime scene loading corrected that harness setup. Another early input helper double-counted coordinates for a nested embedded dialog. The corrected helper targets the actual root-space Window position, and the cancellation test now also asserts that the confirmation was dismissed. No production safety assertion was removed to hide either failure.

## Verification and remaining gates

The existing full verifier remains the entry point. New notebook domain/storage checks include malformed data, full retention, all supported goal outcomes, duplicate writes, stale edits, corruption preservation and unchanged source state. Existing complete replay races now also exercise notebook recording of an actual original and an actual altered, lapped sandbox finish. Native tests use mouse/key events, enlarged/compact and wide layouts, personal-note persistence, confirmation cancellation, stale/corrupt saves, focus return and authoring validation.

See [current executed evidence](notebook-verification.md) for exact revisions, counts, screenshots, measured costs and limitations. Prior 0.12/0.13 reports are historical, not substitutes for this run. No broad strategy calibration, human comprehension/accessibility study, unrestricted scenario editor, full replay timeline, new sporting ruleset, component engineering or actual campaign settlement is claimed. Stage D and the full GDD remain open.
