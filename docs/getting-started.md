# Getting started

## Import

1. Install the **standard Godot 4.7.2 editor**, not the .NET variant. Official release: https://github.com/godotengine/godot/releases/tag/4.7.2-stable.
2. Clone or extract the repository into a writable directory.
3. In Godot's project manager choose **Import**, select the root `project.godot`, and open it.
4. Wait for script import, then press **F5**. The configured main scene is `res://scenes/main.tscn`.

The UI is created from native Controls when the scene runs; the editor's saved scene tree is intentionally small. The game does not require an asset download, package-install command, or network access at runtime. Built-in Godot fonts are used.

## First weekend

Choose **Grand Prix Weekend → Pinecrest Motor Park → Formula → Dry → 3 laps**. Keep incident intensity at **Calm / testing** for an unobstructed first run. Open the briefing and start qualifying. The default engineers release the cars, drive an out-lap, measure a flying lap, and return them to the garage. A second run follows. Qualifying closes on its clock; **Close qualifying** closes new attempts while existing flying laps finish.

Review the grid, choose **Prepare race**, pick starting tyres, then **Start formation lap**. Formation completes a real lap and returns the cars to their assigned grid slots without counting a race lap. Approve the starting lights. You now manage both Obsidian cars. Their buttons and colors identify them throughout the timing tower and circuit view.

Manual pace, engine, or pit commands disable the selected car's delegated engineer. Enable **Delegate to engineer** to hand strategy back. Selecting another team's car is for inspection only. Select tyres before calling **Box this lap**; when already moving, the selection is a next-stop plan, not an instantaneous tyre change.

Space pauses/resumes active sessions. Keys 1, 2, 3, 4, 5 select 1×, 2×, 4×, 8×, 16×. Right- or middle-drag pans, the wheel zooms, and **F** fits the track. **Save weekend** creates a checkpoint; returning to the main menu pauses and saves. **Continue Weekend** resumes the loaded or saved session. A checkpoint restored from disk opens paused when the session is active.

## First custom circuit

Open **Track Editor**, select a library circuit or **New circuit**, and drag a road point. Its Bézier handles control the incoming and outgoing curve. Use the **Point** inspector for exact X/Y coordinates, height, width, and banking. Double-clicking the road inserts a point without changing that cubic's shape. Use **Save to library** to create an independent custom file. It immediately becomes a weekend choice.

**Test weekend** carries a copy of the editor draft into the weekend selector; it does not mutate a live simulation. **Return to editor** restores the draft. Save important edits before closing the app: the draft is an in-memory convenience, not a persistent recovery file.

## Troubleshooting

- A black or blank game viewport: use the configured Compatibility renderer and a supported desktop OpenGL driver. Test running the project in a separate game window when troubleshooting an embedded editor viewport.
- Script-class errors on a fresh checkout: open the project in the editor once and wait for import. CLI users should run `godot --headless --editor --path . --quit` first.
- A missing or invalid custom track: inspect the warning on the main menu. Only valid `.json` authoring files are loaded. Baked runtime files are not authoring files.
- Save failure: Settings displays the actual user-data directory. Ensure it is writable. The app reports the error rather than claiming the save succeeded.
- Quiet game: this iteration intentionally has no audio engine or soundtrack.
- Smaller screens: the designed viewport is 1440×900, minimum window 1100×720. At the minimum size the UI scales down and the pit-wall inspector scrolls. Touch-only/mobile input is not a verified target.

The engine was exercised on Linux with software OpenGL. Windows and macOS project opening are intended through Godot's platform-independent APIs but were not independently tested in this implementation environment. No platform export binary is claimed to have been verified.
