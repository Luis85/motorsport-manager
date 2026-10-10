# Armored Platoon

An original browser tank-platoon development build using Wildlands' versioned
armored runtime. Directly operate or command three tanks through the Orchard Road,
Pine Ridge and Iron Counterattack scenarios. The original M4 Sherman and Panzer IV
studies have separately articulated hull, turret, gun, recoil and road-wheel groups.

From the repository root:

```sh
bin/wildlands validate-game --game docs/concepts/armored-platoon
bin/wildlands build-game --game docs/concepts/armored-platoon --output /tmp/armored-platoon.html
```

Open the resulting HTML in a WebGL2 browser. See the in-game controls for driving,
aiming, camera switching and platoon orders. The two armies and three scenarios
are development content; this is not a completed reference-game recreation.

`content/catalog.json` is the gameplay source. `content/visuals.json` embeds actual
Scene Forge exports and semantic bindings. This is a data-only game folder.
[Authoring and regeneration](../../how-to/armored-platoon-authoring.md) describes
the guarded source workflow. [Provenance](PROVENANCE.md) and [license](LICENSE)
cover all authored content. [Parity ledger](../../reference/armored-platoon-parity.md)
records scope and remaining gaps.
