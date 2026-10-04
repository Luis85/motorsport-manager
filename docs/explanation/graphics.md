# Graphics and presentation

## Art direction

Native application chrome uses the shared dark `GameTheme`: dark blue-green surfaces, light text, mint selection/action accents and explicit warning/error colors. `UI`, `MinimalRaceStyle`, `DirectorStyle` and `PitwallDesign` adapt these tokens across screens. The illustrated circuit keeps its separate light `CircuitPalette`: warm paper terrain, muted green asphalt, cream road edging, sage vegetation, pale sand runoff and restrained terracotta curbs. Form and spacing carry detail rather than bloom, noisy textures or rapid animation. Cars stay dots at all zoom levels; colored bodies, contrasting rims, identity chips and a static selected ring support reading traffic.

The World inspector selects **Meadow**, **Woodland**, or **Coastal**, and **Summer** or **Autumn**. Coastal water is an authored illustration outside the circuit bounds, not a reconstruction of the venue's real coast. Existing authored props retain their positions; procedurally scattered ambient trees are not editable individual assets. Use Place scenery to add an individually editable Tree, Grandstand, Garage, Tower, Yacht, Water, Tent or Cafe.

The layer visibility/lock controls affect only the editor workspace. Hiding a road does not delete it, and hiding scenery does not remove it from the eventual weekend. The construction grid can be hidden for an uncluttered preview. Layer state currently resets when the editor is recreated.

## Rendering ownership

`CircuitWorld` is a Node2D below `TrackCanvas` drawing, owned by that canvas. It caches world-space road, pit, scenery and illustration commands. The parent applies the camera position and scale. A camera gesture redraws lightweight canvas guides, not the world's static geometry. Reference imagery is drawn before the road in the world layer, so tracing does not cover control geometry. Its world placement uses the same editor coordinate transform.

A separate overlay draws car dots, labels and the editor's reference-lap dot. A separate surface overlay reads detached observations of the authoritative surface field. Decoration generation uses a private seeded generator derived from `document.visual.seed`; RaceSim and its PRNG never receive graphics inputs. Shapes and trees have bounded populations, and road/pit samples populate a spatial index for decorative tree exclusion.

Geometric edits use the coalesced preview/full-bake flow. The reference-lap dot follows the committed speed envelope only; it stops for geometry changes. It does not claim tyre-dependent or traffic-aware lap-time accuracy.

## Preferences and readability

Settings persist rich/simple scenery density, normal/large/larger dot sizes (1.0/1.3/1.6) and reduced motion. Reduced motion switches selected-car follow to direct positioning instead of camera damping; it does not freeze moving cars or alter timing. Manual navigation still cancels following. The application does not use camera shake or decorative flashing. Actual start signals remain functional.

The shared native theme uses Godot’s default font; no font files are bundled. `GameTheme` supplies scalable body text, pressed/selected/disabled ink, focus outlines, list selection and dialog styling. Keep full labels and the selected text scale when adapting a layout. Map-label ink comes from `CircuitPalette`; team/tyre identity colors remain separate from native chrome, with `GameTheme.ink_on` choosing contrast for semantic fills. Current source references: [Game theme](../reference/components/game-theme.md), [Circuit palette](../reference/components/circuit-palette.md) and [Native control helpers](../reference/components/ui.md).

## Verification and limits

Native UI smoke tests render the menu, settings, the editor, Minimal and Advanced workspaces, and compact layouts. A 45-frame camera sample logs median/p95 frame intervals and static redraw counters in `reports/render-performance.json`. A cache regression asserts no world regeneration or draw-command reissue on camera transforms, and no advancement of a paused race. Timings are local software-rendered samples, not performance budgets proven on target machines.

Soft shadows are stylized flat silhouettes, not dynamic lights. Buildings and bridges are top-down illustrations, not meshes. No real asset packs, race-car sprites, official logos, external font files or network imagery are shipped. The seven geographic track outlines retain their existing source notices; new illustration geometry is original project code.

Technical reference: Godot's official custom 2D drawing documentation describes retained draw calls and explicit `queue_redraw` invalidation: https://docs.godotengine.org/en/stable/tutorials/2d/custom_drawing_in_2d.html . The implementation uses native CanvasItem/Node2D drawing and explicit anti-aliased outline calls with the Compatibility renderer.
