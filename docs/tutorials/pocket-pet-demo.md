# Raise a Pocket Pet

This tutorial uses the TypeScript Wildlands maker in
[`source/wildlands/`](../../source/wildlands/README.md). Pocket Pet is an
original virtual-pet demonstration in the tamagotchi genre. It runs on the same
ECS as the colony and RTS demos, but owns its own catalog, clock and checkpoints.
Every 3D model in its room was authored in
[Scene Forge](../../source/scene-forge/README.md). See the
[Pocket Pet reference](../reference/pet-engine.md) for exact rules and limits.

## Build and open the maker

From the repository root:

```sh
cd source/wildlands
npm ci
npm run build
```

Open `littlewild.html` in a desktop browser with WebGL 2. Click **Pet demo** in
the maker toolbar. A pink device frame shows a 3D room with a spotted egg on the
rug. The panel lists **Fullness**, **Happiness**, **Energy**, **Cleanliness** and
**Health**, the pet's mood, age, stage, weight and care mistakes.

## Hatch the egg

1. Press **Cuddle**. The egg wobbles and a heart floats above it. Cuddling warms
   the egg and shortens the remaining incubation by four game minutes.
2. Focus **Meal** with the keyboard. It is marked unavailable and its reason reads
   *The egg can only be cuddled or cleaned*. Pressing it repeats that reason in
   the status line without changing the pet.
3. Wait, or choose **Speed 4×**. When the egg hatches, a star sparkles and the
   diary records *Mochi hatched!*. The needs now start to fall.

## Keep every need balanced

- **Meal** fills Fullness; a bowl appears in front of the pet while it eats.
- **Snack** raises Happiness but more than three snacks in one game hour cause a
  tummy ache. **Medicine** is only accepted while the pet is sick.
- **Play ball** raises Happiness and spends Energy. **Cuddle** gives a smaller boost.
- Meals are digested into little messes. **Clean up** removes every mess and
  restores Cleanliness.
- **Lights off** sends the pet to bed. It wakes by itself when rested and turns the
  lights back on. A pet that runs out of energy collapses, which is a care mistake.

Actions take game minutes. While one runs, the other buttons explain that the pet
is busy. Drag the room or use the arrow keys on the focused view to look around;
**+** and **−** zoom. Camera changes never advance the simulation.

## Grow an adult

The baby becomes a teen after four game hours and an adult after ten more. At most
one care mistake before adulthood grows the **Bloom** form with a blossom crown;
more mistakes grow the thorny **Bramble** form. Use **Speed 16×** to reach
adulthood within a few minutes of real time. If health reaches zero after long
neglect, the pet departs; **Adopt a new egg** then lets you choose Mochi or Pebble.

## Dress your pet

Caring earns coins: the badge beside the clock shows the balance. Open **Shop &
wardrobe** in the side panel. **Buy for 30 coins** buys the **Party hat**; press
**Wear** and the hat appears on your pet's head in the 3D room. Offers you cannot
afford say how many coins are missing. Skins such as **Mint** recolour the pet;
**Classic** returns to the species' own colours.

Premium offers such as the **Golden crown** show **Unlock in store…**. The
confirmation names the store and starts on **Cancel**. The bundled demo store is
simulated and takes no payment. Your wardrobe stays when you adopt a new egg or
start over.

## Save, restore and return

**Export checkpoint** downloads the exact ECS state. Choose **Import → Checkpoint**
and **Open JSON** to restore it; the pet opens paused. **Return to colony** closes
the demo and stops its clock. The colony story is not advanced while the pet runs.

## Run a headless experiment

The CLI runs bounded, deterministic caretakers through the same commands:

```sh
npm run pet -- simulate attentive 900 mochi
npm run pet -- simulate casual 900 pebble pebble.checkpoint.json
```

`attentive` reaches the Bloom form; `casual` skips bedtime and reaches Bramble.
The optional output file is a checkpoint you can open in the browser. These runs
check rules, not human enjoyment or balance.
