# Troubleshoot opening, controls and local saves

Use the symptom below that matches the failure. For the intended session
sequence, see [the first-weekend tutorial](../tutorials/getting-started.md). These checks
address the desktop application and source project; they do not establish support
for mobile or touch-only use.

| Symptom | What to check |
|---|---|
| Blank or black game viewport | Keep the configured Compatibility renderer and use a supported desktop OpenGL driver. Try a separate game window if the embedded Godot viewport fails. |
| Script-class errors on a fresh checkout | Open the project in the pinned Godot editor and wait for import. For CLI use, run `godot --headless --editor --path . --quit` from the project root first. |
| Standalone executable cannot find its game data | Extract both the artifact ZIP and its inner archive. Keep `Motorsport Manager.pck` beside the executable. See [standalone validation](standalone-validation.md). |
| Cars remain still after Send out | Choose **Play**. Send out releases the selected driver but does not unpause the session. A restored active checkpoint opens paused. |
| Send out or Box this lap is disabled | Read the tooltip/rejection reason. Send out is limited to a usable garage car in practice or qualifying. A race pit call needs a reachable entry this lap and a usable replacement set. |
| End practice or End qualifying does not immediately open the next session | Wait for an already-started measured/flying lap and the physical garage returns. Closing the session resumes playback if it was paused; the next session still needs your approval. |
| An expected specialist panel is absent | Minimal exposes the focused driver controls and read-only Strategy comparison. Select **Advanced** in Settings and **Apply** for its next weekend-screen opening. See [current capabilities](../reference/current-state.md). |
| Custom circuit is missing or invalid | Read **Library needs attention** on the main menu. The library loads valid `.json` authoring files; a baked runtime file is not an authoring file. Inspect **Checks** in the editor. |
| A save fails | Open Settings to find the actual user-data directory and ensure it is writable. Keep the reported error; the app reports failure rather than claiming success. Retain any unsaved editor work for retry. |
| Campaign departure is blocked | Read the readiness error. Campaign time must reach the registered departure and entrant, availability, configuration and finance requirements must pass. See [event readiness](../reference/campaign/event-readiness-departure.md). |
| Campaign says its weekend checkpoint is unavailable | Preserve the campaign and available save files. An active manifest freezes the campaign at departure; do not fabricate a replacement result or delete the campaign to bypass the error. |
| The game is silent | The current game has no audio engine or soundtrack. |
| Controls do not fit | Use a desktop window of at least 1100×720. Settings offers 100%, 115% and 130% interface text; compact layouts can scroll. |

When reporting a problem, include the source revision or standalone artifact,
Godot version (for source runs), operating system, visible error, reproduction
steps and whether the problem survives a restart. If sharing save data, copy it
first and exclude unrelated local files. The [verification guide](verification.md)
describes developer checks and the limits of automated evidence.
