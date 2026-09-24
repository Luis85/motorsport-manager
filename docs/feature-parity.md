# Prototype-to-Godot feature parity

**0.11 update:** [Contextual rivals](race-weekend-rivals.md), [workspace specification](design/pitwall-workspace.md) and [verification evidence](rivals-verification.md) supersede older UI/checkpoint statements where noted. The current native checkpoint is v10; old saves retain classic rivals. No new simulation/view inheritance layer or pressure mechanic is added.

Current native release: **0.4.0**. Scope: **race weekend and track editor** only.

This is a behavior-level map, not a percentage score. “Adapted” means the decision or interaction exists natively, with a different implementation or explicitly reduced model. It does not claim identical lap times, complete compatibility with every embedded prototype revision, or compliance with real-series sporting rules.

## Race weekend

| Prototype capability | Godot status | Native behavior / remaining difference |
|---|---|---|
| Briefing, qualifying, preparation, formation, grid approval, lights, race, debrief | Implemented | Full physical session lifecycle; one qualifying session |
| Out/hot/in laps, manual release/recall, hot-lap completion after chequered | Implemented | Measured three-sector timing and valid/invalid run history |
| Top-down dot cars, selection/follow, speed/pause | Implemented | Native cached 2D world; manual navigation releases follow |
| Reactive qualifying courtesy and blue flags | Adapted | Persistent priority identity/side; simplified lane occupancy |
| Physical pit entry, limiter, shared boxes, queue, safe exit | Adapted | Real alternate route and frozen service plan; scalar repair model |
| Finite twelve-set driver allocation | Implemented | 3S/3M/2H/2I/2W, stable driver-owned identities; no real-series rules inferred |
| Individual wheel temperature, tread and retained blemishes | Adapted in v0.4 | FL/FR/RL/RR, core/surface, load, normalized pressure, grain, blister, flat spot, puncture; bounded gameplay coefficients |
| Five setup controls and live brake bias | Adapted in v0.4 | Same source field names/ranges; native trade-offs; no setup familiarity or full vehicle equations |
| Patient/balanced/assertive racecraft | Adapted in v0.4 | Passing-intent/risk modifiers, not a complete battle-state machine |
| Scheduled pit lap and actual stint feedback | Implemented, limited | One pending stop; physical gate, cancel/reschedule, no multi-stop optimizer |
| Multi-lane surface field and laboratory | Adapted in v0.4 | 96×7 native cells versus 128×7 in the inspected prototype; seven stored channels and derived grip |
| Per-component quality/durability/wear, blueprint/manufacture/fit | Not ported | Native health/damage are still scalar; tyres do not become an engineering inventory |
| People, stress, skills, crew progression and team orders | Not ported | Fictional roster attributes and delegation exist; full people model does not |
| Forecast uncertainty, strategy comparison, rich driver analysis | Partial | Scenario weather, measured timing and current-rate advice; no full forecast/analysis desk |
| Incidents, local yellows, safety-car neutralization | Adapted | Simplified virtual neutralization; no separate safety-car body, red flags or comprehensive penalties |
| Full browser campaign/session saves | Not compatible | Native versioned checkpoints only; explicit native v1–v3 migration |
| Resumable contextual help | Implemented in v0.4 | Real native controls, persistent step, dismiss/resume; no implicit pause |

## Track authoring

| Prototype capability | Godot status | Native behavior / remaining difference |
|---|---|---|
| Shared library, custom circuits, import/export, test weekend | Implemented | Independent race snapshot; original bundled library protected |
| Cubic control points, handles, exact insertion, sharp/smooth edits | Implemented | Same authoring/compiled circuit used by editor and race |
| Width, elevation, banking, start/finish, two sector boundaries | Implemented / limited | No constraint-based vertical engineering; invalid boundaries warn/fall back |
| Separate pit route, entry/exit/limiter, service-box stations | Implemented | Generated fallback is a starting point requiring author review |
| Reference-image import, pan, opacity, two-point scale calibration | Implemented | Embedded image; no network imagery or georeferencing service |
| Layer visibility/locks, grid, pan/zoom, undo/redo | Implemented | Workspace-local locks; coalesced drag preview and Escape rollback |
| Multi-selection, marquee, planar transform, alignment/distribution | Adapted in v0.4 | Road/scenery transactions; road widths/heights preserved by planar transforms |
| Scenery grouping, duplication and transforms | Adapted in v0.4 | Flat optional group IDs, not hierarchical assets or arbitrary matrices |
| Connected freehand/pen sketch, simplify, close, preview, apply | Adapted in v0.4 | Separate transient trace; explicit replacement; no full prototype workspace serialization |
| Curbs, runoff, barriers, bridges/tunnels and decorative props | Partial | Range annotations and stylized drawing; not constructed 3D or collision geometry |
| Racing line and reference lap | Adapted | Bounded candidate-time heuristic with centreline fallback, not global optimum |
| Diagnostics and validation | Partial | Schema checks and sampled centerline crossings; not full-width/vehicle/tunnel clearance certification |
| Specialized corner/chicane/arc helpers, terrain sculpting | Not ported | Existing Bezier tools remain the authoring mechanism |
| Full mesh/collision/interchange export and editor round-trip | Not ported | Native sampled runtime v2, not the prototype's complete interchange bundle |

## Source anchors and interpretation

The supplied `index(1).html` contains the `OMMTyres` allocation/wheel helpers, `SETUP` bounds, `battle-mode`, `schedule-pit`, `cancel-schedule`, `NX=128,NY=7` surface implementation, Track Studio layer gates, and the connected-sketch workspace functions. Those are the source-derived targets. Godot's 96-station grid, staged Apply/Revert form, stable topic selectors and lightweight preview are native design decisions. The surrounding Living Works management shell and its proposed GDD are not specifications for this release.

Next parity work should preserve the current tests while addressing a clearly named missing behavior. New visual polish must not be presented as completion of an unimplemented simulation system.
