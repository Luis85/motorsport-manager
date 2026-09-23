# Graphics and presentation

## Art direction

A calm, illustrated motorsport venue: warm paper UI, muted green asphalt, cream road edging, sage terrain, pale sand runoff and restrained terracotta curbs. Form and spacing carry detail rather than bloom, noisy textures or rapid animation. Cars stay dots at all zoom levels; colored bodies, contrasting rims, identity chips and a static selected ring support reading traffic.

The World inspector selects **Meadow**, **Woodland**, or **Coastal**, and **Summer** or **Autumn**. Coastal water is an authored illustration outside the circuit bounds, not a reconstruction of the venue's real coast. Existing authored props retain their positions; procedurally scattered ambient trees are not editable individual assets. Use Place scenery to add an individually editable Tree, Grandstand, Garage, Tower, Yacht, Water, Tent or Cafe.

The layer visibility/lock controls affect only the editor workspace. Hiding a road does not delete it, and hiding scenery does not remove it from the eventual weekend. The construction grid can be hidden for an uncluttered preview. Layer state currently resets when the editor is recreated.

## Rendering ownership

`CircuitWorld` is a Node2D below `TrackCanvas` drawing, owned by that canvas. It caches world-space road, pit, scenery and illustration commands. The parent applies the camera position and scale. A camera gesture redraws lightweight canvas guides, not the world's static geometry. Reference imagery is drawn before the road in the world layer, so tracing does not cover control geometry. Its world placement uses the same editor coordinate transform.

A separate overlay draws car dots, labels and the editor's reference-lap dot. A separate surface overlay reads actual simulation water. Decoration generation uses a private seeded generator derived from `document.visual.seed`; RaceSim and its PRNG never receive graphics inputs. Shapes and trees have bounded populations, and road/pit samples populate a spatial index for decorative tree exclusion.

Edits still use the v0.2 coalesced preview/full-bake flow. The reference-lap dot follows the committed speed envelope only; it stops for geometry changes. It does not claim tyre-dependent or traffic-aware lap-time accuracy.

## Preferences and readability

Settings persist rich/simple scenery density, normal/large/larger dot sizes (1.0/1.3/1.6) and reduced motion. Reduced motion switches selected-car follow to direct positioning instead of camera damping; it does not freeze moving cars or alter timing. Manual navigation still cancels following. The application does not use camera shake or decorative flashing. Actual start signals remain functional.

Body text uses Godot's default font. Headings request a system serif fallback (Georgia, Noto Serif, DejaVu Serif); no fonts are included in the repository. Heading appearance may therefore differ by platform. The light theme explicitly sets pressed/selected text colors and timing-header styles to avoid white text on light selected surfaces. Player-name text is darker than its corresponding dot color for readability.

## Verification and limits

Native UI smoke tests render the menu, settings, both workspaces and small-window layout. A 45-frame camera sample logs median/p95 frame intervals and static redraw counters in `reports/render-performance.json`. A cache regression asserts no world regeneration or draw-command reissue on camera transforms, and no advancement of a paused race. Timings are local software-rendered samples, not performance budgets proven on target machines.

Soft shadows are stylized flat silhouettes, not dynamic lights. Buildings and bridges are top-down illustrations, not meshes. No real asset packs, race-car sprites, official logos, external font files or network imagery are shipped. The seven geographic track outlines retain their existing source notices; new illustration geometry is original project code.

Technical reference: Godot's official custom 2D drawing documentation describes retained draw calls and explicit `queue_redraw` invalidation: https://docs.godotengine.org/en/stable/tutorials/2d/custom_drawing_in_2d.html . The implementation uses native CanvasItem/Node2D drawing and explicit anti-aliased outline calls with the Compatibility renderer.
