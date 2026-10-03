# Building visits and floor production

Inspect a completed building and choose **Visit building**, or choose **Visit**
from its tile actions. The interior replaces the map with a cutaway floor view.
Choose a floor to see the companions actually occupying it, their current work,
remaining work time and carried supplies. The shared simulation continues; the
existing time controls still pause or change its speed. **Back to world map** or
**Escape** restores the map camera and keyboard focus.

Inside a manufacturing floor, choose its workstation, item or equipment recipe
and one to twelve batches. This submits the existing building production request,
with an exact building, floor and workstation binding. Creatures still obtain,
carry and reserve ingredients; the existing paid job performs the work and places
its output in that building. No inventory appears in the warehouse until a
companion physically collects and deposits it. Locked recipes and unsupported
stations reject before requests are changed.

**Suggest a floor visit** requests a real companion visit. The companion finishes
its current task, walks along the ordinary map path, enters the actual building
approach and follows connected room cells and stairs. Each stair traversal takes
its authored time. Needs continue to change while walking inside. The visit lasts
eight seconds after arrival, then ordinary decisions resume. Production workers
also traverse those routes before work progress can advance. Pausing freezes both
travel and work. Inspection and rendering never change these records.

## Authoring and authority

`source/content/building-interiors.json` contains reusable home, workshop, study,
kitchen, growing and store-room layouts. Building-kind bindings select templates;
there are no scenario-ID branches. Each layout has stable floor and workstation
IDs, an entry point, bounded dimensions and timed stair connections. Optional
`cells` and `edges` describe custom room shapes and wall/window/door boundaries.
Every cell, workstation, entry and stair must be reachable, and every floor must
have a route back to the entry floor. Walls and windows block movement; doors
permit it. The cutaway renderer displays those same cells and edges.

The single world-owned construction design uses the same `LWInterior.Layout`.
`LWInteriors.forBuilding` resolves an installed design before a template. A design
change is staged through the construction authority; observing a different floor
never installs a design or pays for construction.

The root saved state `interiors` embeds its validated template catalog plus bounded
companion locations, visit intents, workstation batch bindings and paid-job
bindings. Native saves, portable stories and captured scenarios carry this state.
Older saves without it initialize it on their first domain step or accepted
interior command. Custom construction layouts remain in their construction
design record rather than being duplicated in the interior catalog.

Locations retain the companion's ordinary outdoor approach position and a real
logical indoor floor position. Route and job validation reject unknown buildings,
floors or stations, wall-crossing routes, skipped stairs, mismatched paid-job
stations, physically remote occupants and excessive future batches. Exterior
walking uses the shared geography graph, including terrain and constructed
footprints. Existing production reservations, settlement, outputs and transfer
journals remain the inventory authority.

The standard ground workstation and transfer point share the entry cell, preserving
the ordinary ground-task timing. Upper floors and custom room workstations add
real room and stair travel before paid work advances.

Authored onsite quests resolve their worksite through the shared role/deal venue
query. They retain their actual interior position while the existing quest
authority advances checks, energy use and rewards. Calls show their actual name,
progress and return time. Offsite quests remain away.

The projector returns detached display values. The interior canvas has no live
actor or aggregate reference. Actor assets, fixture types, task progress and
transfer indicators are presentation of the existing state. The UI stores only
its visited building, selected floor, form drafts and return camera.

Custom renderers may advertise the `interiors` capability. Their detached frame
contains the current building query, selected floor and available room surface
bounds; the common accessible floor controls and production forms remain visible.
The plugin projects the same persisted occupant locations and paid tasks as the
built-in renderer.

Compiled world commands are `visit-building-floor` with arguments
`[actorId, buildingId, floorId]` and `order-building-production` with arguments
`[buildingId, floorId, stationId, recipeId, batches]`. Creature visit requests use
`commandActor`, sharing away-state and paired-interaction locks. The detached
`buildingInterior(buildingId)` query exposes the same view used by the player UI.

## Verification

`test-building-interiors.cts` verifies catalog connectivity and descriptor guards,
query detachment, atomic rejection, upstairs item and equipment production,
physiological change during stair travel, actual floor visits, pause behavior,
malformed native saves, portable continuation and clearing future work while
preserving the paid batch. Browser verification uses a freshly assembled HTML
artifact and covers default and Office building visits, keyboard return, camera
restoration, production forms, live occupants and responsive controls.
