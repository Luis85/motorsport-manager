# Author a Wildlands RTS mission

Use the browser mission editor to change an RTS scenario without editing the
running match. Start with a working catalog from the [RTS demo tutorial](../tutorials/rts-demo.md).
The editor authors mission records; unit tuning, faction policies and other
definition families remain editable through complete catalog JSON. The
[RTS reference](../reference/rts-engine.md#mission-authoring-boundary) describes
the validation and ownership contract.

## Open a separate draft

1. Build the RTS studio from the repository root and open `rts-studio.html` in a
   desktop browser (the published `demos/rts-frontier.html` is a play build
   without the editor):

   ```sh
   bin/wildlands build-game --game docs/concepts/rts-frontier --profile studio --output rts-studio.html
   ```

2. Choose **Mission editor** in the RTS toolbar. The map now shows authored terrain
   and placements, including records that fog would hide during play.
3. Select the mission to edit. Expand **Clone mission**, provide **New mission
   ID** and **New mission name**, and choose **Clone mission** when you want to
   retain the original in the exported catalog.

Opening the editor suspends match advancement. Its draft is separate from the
match checkpoint; selection, inspection and editing do not issue gameplay orders.
The draft persists in memory while switching between the editor and match. Export
it before closing or reloading the page.

## Paint and place content

Under **Map tools**, select **Paint terrain** and a terrain definition. Set **Brush
width**, **Brush height**, **Tile X** and **Tile Y**, then choose **Apply map tool**.
You can also click or tap the map; dragging paints a rectangle. The displayed map
should reflect the accepted edit.

Select **Place unit / building / creature**, choose **Faction**, **Archetype** and
**Count**, then apply at a map position. Archetypes come from the catalog and must
be permitted for that faction. **Place resource deposit** uses **Resource** and
**Deposit amount**; **Place item** uses an existing item definition.

Use **Inspect tile** or the **Placements** list to select an existing record for
editing. Change its coordinates or authored values and choose **Update placement**. Use
the list's **Remove** action or **Remove placement** tool to remove a placement.
The numeric coordinate controls and placement list support keyboard authoring
without a pointer gesture.
With the map focused, arrow keys choose a tile and Enter applies the selected map
tool. Escape cancels a gesture. **Fit map** restores a view of the whole mission.

Terrain and placement changes use whole-catalog validation. A unit must fit its
movement terrain, a building needs its complete valid footprint, and expanded
spawn groups must remain inside the map. A rejected edit reports its reason and
keeps the previous draft and history. Change the proposal and apply again; do not
assume a rejected placement was partially accepted.

## Set mission rules

Expand **Mission settings**, then edit the name, description, map dimensions, player
faction, default terrain, seed or **Fog of war**, then choose **Apply mission
settings**. Width and height must each be 8–256 tiles. Shrinking the map or
changing terrain is rejected if existing content becomes invalid. Move or remove
affected placements first. The mission must retain a spawn for its player faction.

Expand **Objectives** to edit or add a goal. Choose **Eliminate faction**,
**Stockpile resource** or **Survive seconds**, provide its ID, name, target and
**Required amount / seconds**, and choose **Save objective**. Survival uses
simulated seconds accumulated through the RTS clock, not elapsed browser time.
The editor requires objective IDs to be unique within each mission.

Use **Undo** and **Redo** to revisit accepted edits. History retains the latest
64 edits; it is not a saved checkpoint. A new edit after undo replaces the redo
branch.

## Export, import and try the mission

Choose **Export game data** to keep your draft as JSON. The file contains all catalog
families and missions, so it can also be validated with:

```sh
node .generated/tools/rts-cli.cjs validate wildlands-rts.game.json
```

Choose **Import game data** to admit a complete catalog before replacing the draft.
An invalid file leaves the previous draft available for retry. A match checkpoint
is a different format; use the match's checkpoint import controls to resume play.
Editing while a file is pending invalidates the import proposal; choose the file
again against the current draft.

Choose **Play mission** to construct a fresh paused RTS match. Resume
when you are ready to observe its authored spawns, terrain, economy and objectives.
This replaces the previous match; export its checkpoint beforehand if you need
to resume it later. Returning from the editor without playing keeps the previous
match checkpoint unchanged. **Return to match** leaves the editor without playing.

The editor is a browser authoring surface for the TypeScript maker. It does not
establish native Godot RTS export support, multiplayer, balance or human usability
validation.
