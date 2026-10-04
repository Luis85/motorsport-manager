# Save and test a custom circuit

Use this recipe to make a small change to an existing circuit, save an independent
library copy and drive that copy. You need the game running and a mouse/keyboard.
Starting with a valid library circuit keeps road and pit construction out of this
first editing task.

1. Choose **Track Editor** from the main menu and open a library circuit.
2. In Select/move mode, drag one road point a short distance. Its Bézier handles
   control the incoming and outgoing curve. Use the **Point** inspector for exact
   coordinates when needed.
3. Release the drag to commit it. Use **Ctrl+Z** to undo or **Ctrl+Y** to redo;
   pressing **Escape** during a drag cancels that gesture.
4. Set a distinctive circuit name in **Track**, then inspect **Checks**. Correct
   any blocking finding before testing. A same-level road crossing blocks Test
   weekend; a warning still needs your review.
5. Choose **Save to library**. Editing a packaged circuit saves a custom copy
   rather than changing the packaged catalog. Check that the editor reports it
   saved successfully.
6. Choose **Test weekend**. Review the copied draft in the weekend selector and
   start a short dry weekend using the [first-weekend tutorial](../tutorials/getting-started.md).
7. Use **Return to editor** to continue editing the retained draft.

The saved custom circuit also becomes a choice for future Grand Prix weekends.
A test weekend owns a separate compiled snapshot; later editor changes cannot
reshape an active race. The retained editor draft is an in-memory convenience:
**save before closing the application**.

For file exchange, **Export JSON** writes editable authoring data. **Bake runtime**
writes a consumer-oriented runtime file and cannot replace the authoring file for
future editing. See [the editor reference](track-editor.md) for pits, sectors,
reference-image calibration and tracing, and [track format](../reference/track-format.md) for
file structure. Use [troubleshooting](troubleshooting.md) for failed saves or
invalid library entries.
