# Pocket Pet provenance

## 3D presentation definitions

Every file under `assets/pets/` is generated, not hand-written. The models were
authored as recipes in the
[Scene Forge pocket-pet project](../../../source/scene-forge/examples/pocket-pet/)
(`source/scene-forge/examples/pocket-pet/`, 26 recipes under `models/`: reusable
face, leaf, sprout, petal and flower parts; the egg, baby, teen and two adult
forms with `rig:<role>` accessory sockets; the room, bed, bowl, snack, ball,
mess, medicine, bubbles, heart and star props; and six accessories). The
project's
[`littlewild.export.json`](../../../source/scene-forge/examples/pocket-pet/littlewild.export.json)
publishes them as two species (`mochi`, `pebble`), ten props (`pet-*`) and six
accessories (`acc-*`) into this folder's `assets/`.

To change a model, edit its recipe in Scene Forge, then republish and check the
bridge from the repository root:

```sh
bin/scene-forge -p source/scene-forge/examples/pocket-pet littlewild sync --file source/scene-forge/examples/pocket-pet/littlewild.export.json
bin/scene-forge -p source/scene-forge/examples/pocket-pet littlewild sync --file source/scene-forge/examples/pocket-pet/littlewild.export.json --check
```

`--check` fails when a definition here differs from what the recipes produce.
See [author Littlewild assets in Scene Forge](../../how-to/scene-forge-littlewild-assets.md).

## Catalog and licence

`content/pet.json` and the recipes are original work authored for this
repository as part of the Wildlands and Scene Forge projects (MIT, see the
repository [LICENSE](../../../LICENSE)). Pocket Pet illustrates reusable
virtual-pet genre mechanics; it does not reproduce a licensed product's
content, names or rules.
