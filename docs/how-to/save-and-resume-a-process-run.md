# Save and resume a process run

Save a simulated process run where it stands and continue it later, in the studio or from the
command line, exactly as if it had never stopped. A run checkpoint is one JSON file; the studio stores
nothing in the browser for it. The file format, what it carries and every check are in the
[run checkpoints reference](../reference/business-process-engine.md#run-checkpoints).

## Before you start

- A built studio (a process game such as `demos/agency-delivery.html`, or your own file from
  `bin/wildlands process build`), or the checked-in `bin/wildlands` with Node.js 22+.
- The process **definition the run belongs to**. A checkpoint does not contain the definition; it
  names its id and fingerprint, and only a run of that exact definition can be continued. Keep the
  `.process.json` (or the built HTML) beside the checkpoint.
- In the studio, a run past minute 0: there is nothing to save at minute 0.

## Save a run in the studio

1. Run the process to the minute you want to keep, with **Run simulation** and **Pause**, **Advance
   30 min** or **Run to end**. The process selected in the **Process** selector is the one that is
   saved.
2. Open **Export ▾** (on a phone, **⋯**) and choose **Export run checkpoint…**. The browser saves
   `<process-id>.minute-<M>.checkpoint.json`, and the status line names the process, the minute and
   the seed. At minute 0 the item says "Run the process first: a run checkpoint saves a run that has
   started (past minute 0)."

Saving never advances or pauses the run, and it does not save an unapplied draft: use **Export draft
JSON** for that.

## Resume a run in the studio

1. Open the studio with the same definition applied. If you changed and applied the process since
   you saved, import or apply the definition the checkpoint was saved from first.
2. In a game with several processes, choose the process the checkpoint belongs to with the
   **Process** selector.
3. Choose **Export ▾** (or **⋯**) and **Load checkpoint…**, then pick the file.
4. Read the question "Load checkpoint into <process>?". It names the current minute, the
   checkpoint's minute, its seed and run length, and says that the definition and any unapplied
   draft stay. It starts on **Cancel**; choose **Load checkpoint** to continue.
5. The run is now paused at the checkpoint's minute with its own seed and run length ("Loaded …:
   <process> is paused at minute M (seed S)."). Choose **Run simulation**, **Advance 30 min** or **Run
   to end** to continue it. The Dashboard shows the whole run from minute 0, as an uninterrupted run
   would; earlier What-if results are dropped, and the **Activity** feed starts afresh.

**Cancel**, Escape and **Close** keep the current run as it was and return focus to the menu button.

## Save and continue from the command line

```sh
F=docs/concepts/agency-delivery/content/agency.process.json
bin/wildlands process run --input $F --minutes 100 --output /tmp/run-a.json --checkpoint-out /tmp/agency.checkpoint.json
bin/wildlands process run --input $F --minutes 140 --output /tmp/run-b.json --checkpoint /tmp/agency.checkpoint.json
```

The first command runs 100 minutes and saves the run (`checkpointOut` names the file and the
minute). The second continues it from minute 100 with the checkpoint's seed and run length and
prints `checkpoint` with the input file and the minute it started from; `advancedMinutes` counts
from there. Its report's snapshot equals the snapshot of one uninterrupted `--minutes 240` run with
the same seed. With `--event-log`, the continued run's log holds only the events after the
checkpoint minute. Both flags can be combined to save again where the continued run ends.

## If loading is refused

Nothing changes when a checkpoint is refused; the message says why:

- **Another process.** In the studio, switch to that process with the **Process** selector, or import
  its definition first if it is not open. From the command line, pass that process's definition as
  `--input`.
- **Another definition** (the message names both fingerprints): the process changed since the run
  was saved, even if only its description changed. Import or apply the definition the checkpoint was
  saved from, then load the checkpoint again. A run cannot be moved onto a new revision.
- **Not a run checkpoint, another version, or a damaged file**: the message names the first problem
  (a missing or unknown field, a value out of range, a reference to a step that does not exist). Use
  an unedited file saved by the studio or the CLI.
- **`--seed` with `--checkpoint`**: the checkpoint keeps its own seed; leave `--seed` out.
- **`--minutes` past the run length**: the message says how many more minutes can run.

## Limits

- A checkpoint holds one run of one process. Other processes, drafts, the selection, the light
  theme and Dashboard choices are not saved.
- The file holds the run's case data as the run wrote it and is not encrypted or signed; treat it
  like the definition. Files larger than 16 MiB are not read.
- Only version 1 files of the same definition can be read. A checkpoint is not a save game for a
  changed model and not a way to migrate a run to a new design.
- A continued run is the same simulated run, not a measurement or a forecast.

## Confirm the result

- In the studio, after **Load checkpoint**, the clock shows the checkpoint's minute and the run is
  paused; running on gives the same numbers as the run you saved would have.
- From the command line, compare the two reports: `--minutes 100` plus `--minutes 140` from the
  checkpoint gives the same `snapshot` as one `--minutes 240` run with the same seed.
