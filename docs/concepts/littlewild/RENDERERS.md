# Programmatic world renderers

The shipped **basic** renderer remains the default, including graphics compatibility fallback. A trusted browser script can use the typed `LWRendererHost.player()` controller to replace it without changing simulation rules, saves, scenarios or fixed-step scheduling. Imported scenario/story JSON never installs executable factories.

The global `LWRenderers` registry exposes `list()`, `validate(metadata)` and `register(metadata, factory)`. Registration returns an unregister function. Renderer IDs are unique lowercase names, up to 64 characters; `basic` is reserved. Metadata declares the capabilities the renderer presents. Registration can happen before or after creating a host. The Node SDK exposes the same registry metadata; activation requires a browser DOM host.

A factory receives only a canvas, an abort signal, `query.frame()`, `commands.submit(command)`, and `onDispose(cleanup)`. It receives no live engine, simulation clock, storage or mutable world state. Frames support the admitted maximum of 49 islands (17,689 tile values) and retain the shared 250,000-value copy bound. Frames contain bounded, detached and recursively frozen actor/object/terrain/environment values and presentation state. Construction designs and interior layouts/locations are projected in the separate `construction` and `interiors` frame documents. Camera, preview, renderer selection and animation time belong to presentation and are excluded from authoritative state.

Every instance implements `mount()`, `draw(frame)`, `resize(viewport)` and `dispose()`. Optional `hitTest(point, frame)`, `project(tile, frame)`, `toTile(point, frame)` and `cameraChanged(camera)` integrate existing world controls. The host supplies a simple map projection when these optional methods are absent. Advertise `hit-test`, `camera`, `terrain-preview`, `construction-preview`, `resource-lens` or `interiors` when implemented. The shared interior header and workstation controls remain accessible; renderers advertising `interiors` draw the selected room instead of the built-in interior canvas. `frame.room` and `frame.interiorView` describe that room and floor. `query.buildingInterior(id)`, `query.creatureDefinition(id)` and `query.asset(category,id)` return bounded, detached, frozen definitions on demand. Actor frames include visual asset bindings, personality/equipment and authoritative terrain height; `frame.tiles` gives base terrain plus edited height/ground at every island tile.

Authored `scene.graph.rendering.rendererId` accepts the same stable IDs as the trusted registry, including custom 3D renderers. Declare `dimensions: ['3d']` (or `['2d', '3d']`) in registration metadata; known incompatible dimensions fail pack validation. The editor discovers registered names and dimensions through the pure `LWRendererCatalog.list()` inventory. Unknown extension IDs remain portable authored data, but activating their scene fails explicitly with “Renderer is unavailable” and preserves the previous presentation. Register the compiled extension before validating and playing its scenes or cutscenes. JSON only references the ID and cannot provide executable factories. Unregistering withdraws the extension metadata and prevents future activation.

The application owns the only animation loop. Renderers must not create a second RAF loop. Draw, mount, resize and query callbacks observe the world; command submission during renderer observation callbacks is rejected. User input handlers can submit the existing typed commands through the shared validator and command router. Rendering never advances the simulation. Register listeners with `context.signal` and register external resources with `context.onDispose` immediately, including during factory construction. Cleanup callbacks run even if construction or mount fails.

```ts
// See source/renderer-contracts.d.ts for the stable public types.
const unregister = LWRenderers.register({
  id: 'my-map', name: 'My map', description: 'A top-down view.',
  capabilities: ['camera'],
}, context => {
  const ink = context.canvas.getContext('2d');
  if (!ink) throw new Error('Canvas 2D is unavailable.');
  context.canvas.addEventListener('click', () => {
    const actor = context.query.frame().actors[0];
    if (actor) context.commands.submit({ id: 'select-creature', args: [actor.id] });
  }, { signal: context.signal });
  return {
    mount() {}, resize() {}, dispose() {},
    draw(frame) {
      ink.fillStyle = '#e7eadc';
      ink.fillRect(0, 0, frame.viewport.width, frame.viewport.height);
    },
  };
});
const switched = LWRendererHost.player().selectRenderer('my-map');
if (!switched.ok) throw new Error(switched.reason);
// Restore the default and then unregister the factory.
LWRendererHost.player().selectRenderer('basic');
unregister();
```

`LWRendererExample.register()` installs the complete `field-map` example from [source/renderer-example.ts](source/renderer-example.ts). Then call `LWRendererHost.player().selectRenderer('field-map')`. Or call `LWRendererExample.activate()` to register and select it. It draws actors, nodes, buildings, edited terrain, terrain previews and the selected interior floor using the public frame alone.

Switching prepares, resizes and draws the candidate before activation. A failed factory/mount/first draw cleans up and leaves the previous renderer active. Failure during an active draw or resize restores basic. The basic adapter is suspended while a custom renderer runs: its input listeners and ResizeObserver are removed, and its presentation overlays are hidden. One basic resource set is retained for immediate rollback. Switching disposes the outgoing custom instance, aborts its listeners and disconnects its observer. `host.dispose()` releases both custom and basic resources. Unregistering a factory prevents future activation; it does not interrupt an already mounted instance.

The built-in 2D options are actual PixiJS 8.22.0 and ExcaliburJS 0.32.0 adapters. They share a detached canonical asset projector, and render through each library's own graphics API. Their vendored browser distributions and licenses are documented in `vendor/RENDERER-VENDORS.md`. Pixi uses its official static CSP polyfills; the player keeps its existing CSP without unsafe-eval or network access. Neither adapter creates a ticker, game Engine, simulation, input clock, or persistence service.

```ts
const host = LWRendererHost.player();
const result = await host.selectRendererAsync('pixi-2d');
if (!result.ok) throw new Error(result.reason);
await host.selectSceneRendering({dimension: '2d', rendererId: 'excalibur-2d'});
await host.selectSceneRendering({dimension: '2d', rendererId: 'basic'}); // retained Canvas
await host.selectSceneRendering({dimension: '3d', rendererId: 'basic'}); // retained Three
```

`selectRenderer` keeps its synchronous transaction contract. Selecting an asynchronous factory through it returns a failure explaining that `selectRendererAsync` is required, while preserving the active renderer. Trusted developers can register an asynchronous factory with `LWRenderers.registerAsync`; `prepare` is the matching registry operation. Player preparation is bounded to ten seconds. A later selection, engine replacement, or disposal aborts preparation, runs registered cleanup, disposes any late instance, and prevents late activation or command authority. Factories should register resources with `onDispose` immediately and honor `context.signal` across asynchronous work.

Authored scene metadata chooses `graph.rendering.dimension` and a stable registered renderer ID. The built-in PixiJS and ExcaliburJS adapters support `2d`; compiled extensions declare their own supported dimensions. A scene can declare up to four named 2D `embeds` with a `minimap` or `panel` role and bounded anchor/size. References, dimensions, duplicates, dangling targets, and cycles are validated as authored data. The player creates a separate scoped canvas and read-only context for each embed, and updates it under the existing UI draw loop. Embeds observe the current native owner or a dormant owner's saved checkpoint/initial state; they never import or tick another Engine. Their command sink rejects mutation. Dormant interiors retain canonical floor layout and persisted actor locations/work progress. Scene bounds constrain detached custom/embedded frames and their 2D viewports. The retained basic Canvas/Three compatibility backends fit or focus the selected bounds while preserving the native owner world geometry; native workers continue under the existing authority. Compiled slots reflow within the available width on small screens.

Cutscene previews use `LWStorytellingRenderer.create(container, pack, sceneId, playback)`. Its `ready` result includes bounded renderer preparation; `draw(time, delta)` samples externally advanced playback and `dispose()` releases the scoped Three/Canvas/Pixi/Excalibur instance and animation layer. `snapshot()` returns the detached frozen frame. Draft assets come from the supplied pack; previews never import an Engine, swap the live asset catalog, spend resources, advance workers, or save. `LWRendererHost.player().setPlayback(playback)` applies the same sampled presentation to the mounted player. `setPreview(source)` accepts a trusted detached `LWStorytellingPreview.create(pack, sceneId)` source. Passing `null` restores ordinary presentation. Playback advancement remains in application composition under the existing RAF.

`rotation` is radians, `scale` multiplies canonical geometry, and `opacity` is 0..1. Creature `pose` is a normalized gesture phase: canonical arm handles swing by `sin(phase * 2π) * 1.1` radians and the head tilts by `sin(phase * 2π) * 0.15`. The shared 2D projector and detached Three observer apply those values to their own geometry without editing assets or authoritative actor coordinates.

Actual p5.js 2.3.4 supplies reusable animation overlays. `LWAnimations.list()` and the pure `LWAnimationCatalog.list()` inventory expose preset IDs, descriptions, parameter bounds and optional source provenance. Authored timelines reference compiled presets by ID; imported JSON cannot register functions. General descriptor inputs are bounded to 16 animations, count 1..128 and radius 1..1000 pixels. Positions are scene-local coordinates projected by the selected renderer. Presets receive explicit sampled time, normalized phase and a stable seed, independent of frame rate and gameplay RNG. They draw in instance mode with `noLoop()`; the existing host calls `redraw()` and removes the sketch on disposal or cancelled preparation. p5 layers are pointer transparent and work over 2D and 3D scenes.

```ts
/// <reference path="./source/animation-contracts.d.ts" />
const unregister = LWAnimations.register({
  id: 'gentle-pulse', name: 'Gentle pulse', description: 'A breathing ring.',
  source: 'extensions/gentle-pulse.ts'
}, ({p5, center, radius, color, phase}) => {
  p5.noFill(); p5.stroke(color); p5.strokeWeight(3);
  const size = radius * (1 + 0.2 * Math.sin(phase * Math.PI * 2));
  p5.ellipse(center.x, center.y, size, size * 0.5);
});
// Use presetId: 'gentle-pulse' in a validated cutscene animation descriptor.
// Keep the compiled extension module with source exports; JSON contains no callback.
```

The compilable example is `source/renderer-animation-example.ts`. Custom presets use the same bounded descriptor and timeline/toolbox path as builtins. Register their compiled modules before validating or launching documents that reference them. Source exports record custom module provenance/manual port requirements. The separate replaceable p5 runtime, complete LGPL license, editable corresponding source archive, hashes and rebuild steps are documented in `vendor/P5-VENDOR.md`. The shipping offline CSP remains unchanged.

For general animation outside a cutscene, mount a canvas in your own presentation container, call `LWAnimationExample.register()` once, then `LWAnimationExample.create(canvas, (point, frame) => LWRendererScene2D.project(point, frame))`. Await `layer.ready`. Forward a detached renderer `frame` and explicit seconds from your existing host cadence to `layer.draw(frame, seconds)`; the example feeds a validated descriptor and wraps its four-second phase. Call `layer.dispose()` when closing the view, then the registration's returned cleanup when the extension is no longer used. The example creates no RAF or simulation clock. A 3D host can provide its own read-only projection function instead. The browser gate executes this exact compiled example and checks actual p5 canvas pixels and disposal.

The mounted player also supports general animation directly:

```ts
const unregister = LWAnimationExample.register();
const host = LWRendererHost.player();
host.setAnimations([{id: 'pulse', presetId: 'gentle-pulse', start: 0,
  duration: 4, x: 9, y: 9, radius: 80, color: '#dfab58', count: 1, seed: 42}]);
// The established player RAF samples the overlay; no caller loop is necessary.
host.setAnimations(null); // release the layer when finished
unregister();
```

`host.snapshot()` supplies a frozen detached frame and `host.project(point)` supplies read-only screen projection. General animation time starts at installation and uses the existing host render time; cutscene playback supplies its explicit sample time while active. Replacing the engine or disposing the host clears presentation layers.
