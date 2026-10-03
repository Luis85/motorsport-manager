# Programmatic world renderers

The shipped **basic** renderer remains the default, including graphics compatibility fallback. A trusted browser script can use the typed `LWRendererHost.player()` controller to replace it without changing simulation rules, saves, scenarios or fixed-step scheduling. Imported scenario/story JSON never installs executable factories.

The global `LWRenderers` registry exposes `list()`, `validate(metadata)` and `register(metadata, factory)`. Registration returns an unregister function. Renderer IDs are unique lowercase names, up to 64 characters; `basic` is reserved. Metadata declares the capabilities the renderer presents. Registration can happen before or after creating a host. The Node SDK exposes the same registry metadata; activation requires a browser DOM host.

A factory receives only a canvas, an abort signal, `query.frame()`, `commands.submit(command)`, and `onDispose(cleanup)`. It receives no live engine, simulation clock, storage or mutable world state. Frames support the admitted maximum of 49 islands (17,689 tile values) and retain the shared 250,000-value copy bound. Frames contain bounded, detached and recursively frozen actor/object/terrain/environment values and presentation state. Construction designs and interior layouts/locations are projected in the separate `construction` and `interiors` frame documents. Camera, preview, renderer selection and animation time belong to presentation and are excluded from authoritative state.

Every instance implements `mount()`, `draw(frame)`, `resize(viewport)` and `dispose()`. Optional `hitTest(point, frame)`, `project(tile, frame)`, `toTile(point, frame)` and `cameraChanged(camera)` integrate existing world controls. The host supplies a simple map projection when these optional methods are absent. Advertise `hit-test`, `camera`, `terrain-preview`, `construction-preview`, `resource-lens` or `interiors` when implemented. The shared interior header and workstation controls remain accessible; renderers advertising `interiors` draw the selected room instead of the built-in interior canvas. `frame.room` and `frame.interiorView` describe that room and floor. `query.buildingInterior(id)`, `query.creatureDefinition(id)` and `query.asset(category,id)` return bounded, detached, frozen definitions on demand. Actor frames include visual asset bindings, personality/equipment and authoritative terrain height; `frame.tiles` gives base terrain plus edited height/ground at every island tile.

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
