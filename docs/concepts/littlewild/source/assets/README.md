# Littlewild 3D assets

Every visible gameplay model is isolated under one of three asset families:

- `buildings/<id>/asset.json`
- `items/<id>/asset.json`
- `actors/<id>/asset.json`

The runtime never imports executable code from an asset. Each manifest is declarative data containing primitive geometry, material roles, named handles, bounds, optional animation anchors, and rig/socket metadata. `asset-catalog.ts` validates and freezes the bundled definitions; `asset-renderer.ts` is the only generic interpreter.

Building assets own their complete world mesh plus door/rotor/smoke anchors. Item assets may expose `world`, `depleted`, `carry`, or `equipped` models as appropriate. Actor assets own body geometry and named rig sockets; `world-fidelity.ts` only applies animation state and attaches item assets.

These files are build-time bundled content. Scenario/story imports cannot add, replace, or execute 3D assets.
